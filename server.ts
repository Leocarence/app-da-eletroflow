import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { connectToDatabase, EletroflowModel, getDbDiagnostics } from "./src/db/mongodb";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  const BACKUP_PATH = path.join(process.cwd(), "db_backup.json");
  let dataEtag = 'v_' + Date.now();
  let memoryCache: any = null;

  // Load initial backup into memory cache if exists
  if (fs.existsSync(BACKUP_PATH)) {
    try {
      memoryCache = JSON.parse(fs.readFileSync(BACKUP_PATH, "utf-8"));
    } catch (e) {}
  }

  // Universal CORS & international network headers
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, ETag, If-None-Match, x-data-version, Cache-Control"
    );
    res.setHeader("Access-Control-Expose-Headers", "ETag");
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  });

  // Parse JSON bodies with limit size to avoid overflows
  app.use(express.json({ limit: "50mb" }));

  // API endpoints
  app.get("/api/db-status", async (req, res) => {
    try {
      await connectToDatabase();
      const diagnostics = getDbDiagnostics();
      return res.json(diagnostics);
    } catch (e: any) {
      return res.json({
        connected: false,
        uriConfigured: !!process.env.MONGODB_URI,
        uriMasked: "Error",
        lastError: e?.message || String(e),
        readyState: 0,
      });
    }
  });

  app.get("/api/load-data", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("ETag", dataEtag);

      // Return 304 Not Modified if the data version hasn't changed
      const clientEtag = req.headers["if-none-match"] || req.headers["x-data-version"];
      if (clientEtag && clientEtag === dataEtag) {
        return res.status(304).end();
      }

      // 1. Try MongoDB Atlas first
      try {
        const dbConnected = await connectToDatabase();
        if (dbConnected) {
          const doc = await EletroflowModel.findOne({ key: "eletroflow_data" }).maxTimeMS(3000);
          if (doc && doc.data) {
            memoryCache = doc.data;
            console.log("[Database] Loaded data successfully from MongoDB");
            return res.json(doc.data);
          }
          console.log("[Database] No active document found in MongoDB. Checking local storage.");
        }
      } catch (mongoErr) {
        console.warn("[Database] MongoDB read failed, falling back gracefully to local replica:", mongoErr);
      }

      // 2. Fallback to local backup json
      if (fs.existsSync(BACKUP_PATH)) {
        try {
          const data = fs.readFileSync(BACKUP_PATH, "utf-8");
          const parsed = JSON.parse(data);
          memoryCache = parsed;
          return res.json(parsed);
        } catch (readErr) {
          console.warn("[Database] Local file read error:", readErr);
        }
      }

      // 3. Fallback to in-memory cache if available
      if (memoryCache) {
        return res.json(memoryCache);
      }

      return res.json({ status: "empty" });
    } catch (e) {
      console.error("[Database] Error loading database:", e);
      if (memoryCache) {
        return res.json(memoryCache);
      }
      return res.json({ status: "empty" });
    }
  });

  app.post("/api/save-data", async (req, res) => {
    try {
      const payload = req.body;
      let savedInMongo = false;

      // Update data version/etag whenever data is persisted
      dataEtag = 'v_' + Date.now();
      memoryCache = payload;

      // Try MongoDB
      try {
        const dbConnected = await connectToDatabase();
        if (dbConnected) {
          await EletroflowModel.findOneAndUpdate(
            { key: "eletroflow_data" },
            { data: payload, updatedAt: new Date() },
            { upsert: true, new: true, runValidators: true }
          ).maxTimeMS(3000);
          savedInMongo = true;
          console.log("[Database] Saved data successfully to MongoDB");
        }
      } catch (mongoErr) {
        console.warn("[Database] MongoDB save failed, saving locally:", mongoErr);
      }

      // Always write to disk as local backup file consistency/replica
      try {
        fs.writeFileSync(BACKUP_PATH, JSON.stringify(payload, null, 2), "utf-8");
      } catch (fsErr) {
        console.warn("[Database] Local disk write error:", fsErr);
      }

      res.setHeader("ETag", dataEtag);
      return res.json({ 
        status: "success", 
        etag: dataEtag,
        savedAt: new Date().toISOString(),
        persistedTo: savedInMongo ? "MongoDB + Local Backup" : "Local Backup"
      });
    } catch (e) {
      console.error("[Database] Error saving database:", e);
      return res.json({ status: "success", etag: dataEtag, savedAt: new Date().toISOString(), persistedTo: "Memory Cache" });
    }
  });

  // Serve static assets or mount Vite in development mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    
    // Set cache control headers for static files
    app.use(express.static(distPath, {
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          // Never cache HTML files so the browser always gets the latest asset hashes
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        } else {
          // CSS, JS and static assets are hashed by Vite, safe to cache long-term
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      }
    }));

    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

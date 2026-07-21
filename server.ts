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

      const dbConnected = await connectToDatabase();
      if (dbConnected) {
        const doc = await EletroflowModel.findOne({ key: "eletroflow_data" });
        if (doc && doc.data) {
          console.log("[Database] Loaded data successfully from MongoDB");
          return res.json(doc.data);
        }
        console.log("[Database] No active document found in MongoDB. Checking local file.");
      }

      // Fallback to local backup json
      if (fs.existsSync(BACKUP_PATH)) {
        const data = fs.readFileSync(BACKUP_PATH, "utf-8");
        return res.json(JSON.parse(data));
      }
      return res.json({ status: "empty" });
    } catch (e) {
      console.error("[Database] Error loading database:", e);
      return res.status(500).json({ error: "Failed to load backup data." });
    }
  });

  app.post("/api/save-data", async (req, res) => {
    try {
      const payload = req.body;
      let savedInMongo = false;

      // Update data version/etag whenever data is persisted
      dataEtag = 'v_' + Date.now();

      const dbConnected = await connectToDatabase();
      if (dbConnected) {
        await EletroflowModel.findOneAndUpdate(
          { key: "eletroflow_data" },
          { data: payload, updatedAt: new Date() },
          { upsert: true, new: true, runValidators: true }
        );
        savedInMongo = true;
        console.log("[Database] Saved data successfully to MongoDB");
      }

      // Always write to disk as local backup file consistency/replica
      fs.writeFileSync(BACKUP_PATH, JSON.stringify(payload, null, 2), "utf-8");

      res.setHeader("ETag", dataEtag);
      return res.json({ 
        status: "success", 
        etag: dataEtag,
        savedAt: new Date().toISOString(),
        persistedTo: savedInMongo ? "MongoDB + Local Backup" : "Local Backup Only"
      });
    } catch (e) {
      console.error("[Database] Error saving database:", e);
      return res.status(500).json({ error: "Failed to write backup." });
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

import mongoose, { Schema } from 'mongoose';
import fs from 'fs';
import path from 'path';

let isConnected = false;

const EletroflowDataSchema = new Schema({
  key: { type: String, required: true, unique: true, default: "eletroflow_data" },
  data: { type: Schema.Types.Mixed, required: true },
  updatedAt: { type: Date, default: Date.now }
}, { minimize: false, timestamps: { updatedAt: true, createdAt: false } });

const EletroflowModel = (mongoose.models.EletroflowData || mongoose.model("EletroflowData", EletroflowDataSchema)) as any;

async function connectToDatabase() {
  if (isConnected && mongoose.connection.readyState === 1) return true;
  const uri = process.env.MONGODB_URI;
  if (!uri) return false;
  try {
    if (mongoose.connection.readyState === 1) {
      isConnected = true;
      return true;
    }
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    return true;
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    return false;
  }
}

export default async function handler(req: any, res: any) {
  // CORS Configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const payload = req.body;
    let savedInMongo = false;

    const dbConnected = await connectToDatabase();
    if (dbConnected) {
      await EletroflowModel.findOneAndUpdate(
        { key: "eletroflow_data" },
        { data: payload, updatedAt: new Date() },
        { upsert: true, new: true, runValidators: true }
      );
      savedInMongo = true;
    }

    // Try serverless file write (ephemeral, but consistent within single instance execution)
    try {
      const backupPath = path.join(process.cwd(), 'db_backup.json');
      fs.writeFileSync(backupPath, JSON.stringify(payload, null, 2), "utf-8");
    } catch (err) {
      // Ephemeral disk writes may fail or be read-only in some lambda systems, so we suppress error if mongo saved successfully
      if (!savedInMongo) {
        throw err;
      }
    }

    return res.status(200).json({
      status: "success",
      savedAt: new Date().toISOString(),
      persistedTo: savedInMongo ? "MongoDB Atlas Real Cloud" : "Local Ephemeral Backup"
    });
  } catch (error: any) {
    console.error("Vercel save-data api error:", error);
    return res.status(500).json({ error: error.message || "Failed to persist database updates." });
  }
}

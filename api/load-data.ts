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

  try {
    const dbConnected = await connectToDatabase();
    if (dbConnected) {
      const doc = await EletroflowModel.findOne({ key: "eletroflow_data" });
      if (doc && doc.data) {
        return res.status(200).json(doc.data);
      }
    }
    
    // Serverless fallback to local JSON template if db is not connected or empty
    const backupPath = path.join(process.cwd(), 'db_backup.json');
    if (fs.existsSync(backupPath)) {
      const data = fs.readFileSync(backupPath, "utf-8");
      return res.status(200).json(JSON.parse(data));
    }
    return res.status(200).json({ status: "empty" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}

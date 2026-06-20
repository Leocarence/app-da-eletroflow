import mongoose, { Schema } from 'mongoose';

let isConnected = false;
let lastError: string | null = null;

async function connectToDatabase() {
  if (isConnected && mongoose.connection.readyState === 1) return true;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    lastError = "Variável de ambiente MONGODB_URI não definida no servidor.";
    isConnected = false;
    return false;
  }
  try {
    if (mongoose.connection.readyState === 1) {
      isConnected = true;
      lastError = null;
      return true;
    }
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    lastError = null;
    return true;
  } catch (error: any) {
    isConnected = false;
    lastError = error?.message || String(error);
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

  await connectToDatabase();

  const uri = process.env.MONGODB_URI;
  let uriMasked = "Não definida";
  if (uri) {
    try {
      if (uri.includes('@')) {
        const parts = uri.split('@');
        uriMasked = `mongodb+srv://***:***@${parts[parts.length - 1]}`;
      } else {
        uriMasked = uri.substring(0, 15) + "...";
      }
    } catch (e) {
      uriMasked = "Configured";
    }
  }

  return res.status(200).json({
    connected: isConnected && mongoose.connection.readyState === 1,
    uriConfigured: !!uri,
    uriMasked,
    lastError,
    readyState: mongoose.connection.readyState,
  });
}

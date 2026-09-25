import mongoose, { Schema } from 'mongoose';

let isConnected = false;
let lastError: string | null = null;
let lastAttemptTime = 0;
const RETRY_COOLDOWN_MS = 15000;

/**
 * Returns connection diagnostics and status.
 */
export function getDbDiagnostics() {
  const uri = process.env.MONGODB_URI;
  let uriMasked = "Não definida";
  if (uri) {
    try {
      const url = new URL(uri);
      // mask username/password but keep database name and host
      uriMasked = `${url.protocol}//***:***@${url.host}${url.pathname}`;
    } catch (e) {
      // Fallback simple mask if it's not a standard URL structure (e.g. standard connection strings)
      if (uri.includes('@')) {
        const parts = uri.split('@');
        uriMasked = `mongodb+srv://***:***@${parts[parts.length - 1]}`;
      } else {
        uriMasked = uri.substring(0, 15) + "...";
      }
    }
  }

  let networkTip: string | null = null;
  if (lastError && (lastError.includes('whitelisted') || lastError.includes('ServerSelection') || lastError.includes('timeout') || lastError.includes('ENOTFOUND') || lastError.includes('ETIMEDOUT'))) {
    networkTip = "Seu cluster MongoDB Atlas pode estar restringindo IPs. Para acesso de qualquer país ou nuvem, acesse o painel do MongoDB Atlas > Network Access > adicione 0.0.0.0/0 (Allow access from anywhere).";
  }

  return {
    connected: isConnected && mongoose.connection.readyState === 1,
    uriConfigured: !!uri,
    uriMasked,
    lastError,
    networkTip,
    readyState: mongoose.connection.readyState,
  };
}

/**
 * Connects to MongoDB if MONGODB_URI is defined.
 * Returns true if connection is active/successful, false otherwise.
 * Includes a smart cooldown to prevent blocking requests when network or whitelist restricts access.
 */
export async function connectToDatabase(): Promise<boolean> {
  if (isConnected && mongoose.connection.readyState === 1) return true;
  
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    lastError = "Variável de ambiente MONGODB_URI não definida no servidor. Certifique-se de adicioná-la nas configurações do Google AI Studio.";
    isConnected = false;
    return false;
  }

  // Avoid spamming slow connection attempts if we recently failed
  const now = Date.now();
  if (!isConnected && now - lastAttemptTime < RETRY_COOLDOWN_MS) {
    return false;
  }
  lastAttemptTime = now;

  try {
    // Avoid re-connecting if already open
    if (mongoose.connection.readyState === 1) {
      isConnected = true;
      lastError = null;
      return true;
    }

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
      dbName: 'eletroflow',
    });
    
    isConnected = true;
    lastError = null;
    console.log("[Database] Connected successfully to MongoDB!");
    return true;
  } catch (error: any) {
    isConnected = false;
    lastError = error?.message || String(error);
    console.error("[Database] Error connecting to MongoDB:", error);
    return false;
  }
}

// Single cohesive document to hold the entire administrative state
const EletroflowDataSchema = new Schema({
  key: { 
    type: String, 
    required: true, 
    unique: true, 
    default: "eletroflow_data" 
  },
  data: { 
    type: Schema.Types.Mixed, 
    required: true 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { minimize: false, timestamps: { updatedAt: true, createdAt: false } });

export const EletroflowModel = (mongoose.models.EletroflowData || mongoose.model("EletroflowData", EletroflowDataSchema)) as any;

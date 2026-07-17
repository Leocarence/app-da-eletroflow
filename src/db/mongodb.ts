import mongoose, { Schema } from 'mongoose';

let isConnected = false;
let lastError: string | null = null;

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

  return {
    connected: isConnected && mongoose.connection.readyState === 1,
    uriConfigured: !!uri,
    uriMasked,
    lastError,
    readyState: mongoose.connection.readyState,
  };
}

/**
 * Connects to MongoDB if MONGODB_URI is defined.
 * Returns true if connection is active/successful, false otherwise.
 */
export async function connectToDatabase(): Promise<boolean> {
  if (isConnected && mongoose.connection.readyState === 1) return true;
  
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    lastError = "Variável de ambiente MONGODB_URI não definida no servidor. Certifique-se de adicioná-la nas configurações do Google AI Studio.";
    console.warn("[Database] MONGODB_URI environment variable not defined. Using local file storage fallback.");
    isConnected = false;
    return false;
  }

  try {
    // Avoid re-connecting if already open
    if (mongoose.connection.readyState === 1) {
      isConnected = true;
      lastError = null;
      return true;
    }

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
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

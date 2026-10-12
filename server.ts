import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
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

  // Gestor IA (Skywalker) endpoint with Gemini API integration
  app.post("/api/gestor-ia/chat", async (req, res) => {
    try {
      const { message, history, context } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Mensagem é obrigatória." });
      }

      const rawApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY || "";
      const apiKey = typeof rawApiKey === "string" ? rawApiKey.trim() : "";
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.json({
          reply: "Chave da API do Gemini não detectada no ambiente. Adicione sua GEMINI_API_KEY no painel de Secrets ou de variáveis de ambiente para ativar o Skywalker plenamente!",
          functionCalls: []
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      // Context formatted without omitting ANY data
      const dataSnapshot = JSON.stringify(context || memoryCache || {}, null, 2);

      const systemInstruction = `Você é o Skywalker, o Gestor Virtual de Inteligência Artificial da Eletroflow.
Sua saudação inicial ao usuário é: "Skywalker ao seu comando! Pronto para trabalhar!"

Você é um assistente de IA profissional integrado a um aplicativo corporativo. É fundamental que todas as suas respostas sigam rigorosamente um padrão de formatação limpo, organizado e adequado para interfaces de usuário modernas (como Markdown estruturado e legível).

DIRETRIZES OBRIGATÓRIAS DE FORMATAÇÃO:
1. ECONOMIA DE MARCAÇÃO: Use formatação Markdown (negritos, listas e títulos) apenas quando estritamente necessário para destacar informações-chave. Evite o uso excessivo de asteriscos (*) ou blocos de código desnecessários que poluem a visualização.
2. ESTRUTURA CLARA: Organize as respostas em parágrafos coesos e, quando houver múltiplos pontos, utilize listas com marcadores simples (-) bem espaçadas.
3. SEM META-COMENTÁRIOS: Nunca inclua explicações sobre o formato da resposta, saudações excessivas ou comentários técnicos sobre o prompt. Vá direto ao ponto com precisão e clareza.
4. TOM PROFISSIONAL: Mantenha um tom objetivo, empático, altamente competente e focado em resolver a demanda do usuário com excelência.

DIRETRIZES FUNDAMENTAIS DO SISTEMA:
1. Responda com elegância, agilidade, objetividade e clareza executiva.
2. Não use textos explicativos muito longos ou prolixos. Vá direto ao ponto, com conclusões assertivas e dados consolidados.
3. Organize tabelas e listas em Markdown conciso. Valores monetários devem estar formatados em Reais (R$).
4. NENHUM DADO DEVE SER OMITIDO da sua consulta. Você tem acesso completo e irrestrito a todas as abas, tabelas e registros:
   - Veículos da frota (placa, modelo, status: disponível, locado ou manutenção, valor semanal, caução, km, gastos de oficina).
   - Contratos de locação (locatários, telefones, veículos vinculados, status, valores semanais, início e fim).
   - Extrato financeiro (todas as receitas, despesas operacionais e de veículos, cauções em custódia).
   - Despesas futuras e parceladas (previsão, valores, parcelas pendentes e pagas, vencimentos).
   - Fila de espera de interessados (nome, telefone, aprovação de documentos).
   - Métricas globais (saldo em caixa real, receitas totais, despesas totais, caução retido).
5. EXECUÇÃO DE FUNÇÕES / FERRAMENTAS:
   - Você pode usar todas as funções que um usuário desenvolvedor/administrador possui.
   - Quando o usuário solicitar criação, alteração ou navegação, invoque a ferramenta correspondente:
     * add_transaction: Lança receita, despesa ou caução no extrato.
     * update_vehicle_status: Atualiza status do veículo (available, rented, maintenance).
     * add_vehicle: Cadastra novo carro na frota.
     * add_future_expense: Lança previsão de despesa futura fixa ou parcelada.
     * start_rental: Inicia novo contrato de locação.
     * terminate_rental: Encerra contrato de locação.
     * add_interested_lead: Registra novo motorista na fila de espera.
     * navigate_to_tab: Muda para a aba solicitada (dashboard, financials, transactions, vehicles, rentals, users).
6. Quando uma ferramenta for executada, forneça uma confirmação sucinta com os pontos principais.

DADOS REAIS E COMPLETOS DO SISTEMA EM TEMPO REAL:
${dataSnapshot}
`;

      const functionDeclarations = [
        {
          name: "add_transaction",
          description: "Lança uma nova receita, despesa ou caução no extrato financeiro da Eletroflow.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                description: "Tipo: 'receita', 'despesa', 'caucao_recebido' ou 'caucao_devolvido'"
              },
              value: {
                type: Type.NUMBER,
                description: "Valor em Reais (ex: 550.00)"
              },
              category: {
                type: Type.STRING,
                description: "Categoria (Aluguel Semanal, Manutenção, Combustível, Seguro, IPVA, Retenção, Outros)"
              },
              description: {
                type: Type.STRING,
                description: "Descrição da movimentação"
              },
              date: {
                type: Type.STRING,
                description: "Data YYYY-MM-DD (se omitido, hoje)"
              },
              vehiclePlateOrId: {
                type: Type.STRING,
                description: "Placa ou ID do carro se relacionado"
              }
            },
            required: ["type", "value", "category", "description"]
          }
        },
        {
          name: "update_vehicle_status",
          description: "Atualiza o status operacional de um veículo da frota.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              plateOrId: {
                type: Type.STRING,
                description: "Placa ou ID do veículo"
              },
              newStatus: {
                type: Type.STRING,
                description: "Novo status: 'available', 'rented' ou 'maintenance'"
              }
            },
            required: ["plateOrId", "newStatus"]
          }
        },
        {
          name: "add_vehicle",
          description: "Cadastra um novo veículo na frota da Eletroflow.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              brandModel: {
                type: Type.STRING,
                description: "Marca e Modelo (ex: BYD Dolphin Mini)"
              },
              plate: {
                type: Type.STRING,
                description: "Placa do veículo"
              },
              weeklyRate: {
                type: Type.NUMBER,
                description: "Valor do aluguel semanal em R$"
              },
              depositValue: {
                type: Type.NUMBER,
                description: "Valor do caução em R$"
              },
              status: {
                type: Type.STRING,
                description: "Status: 'available', 'rented' ou 'maintenance'"
              },
              mileage: {
                type: Type.NUMBER,
                description: "Quilometragem atual"
              }
            },
            required: ["brandModel", "plate", "weeklyRate", "depositValue"]
          }
        },
        {
          name: "add_future_expense",
          description: "Programa uma despesa futura fixa ou parcelada.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              description: {
                type: Type.STRING,
                description: "Descrição da despesa (ex: Seguro Anual, IPVA)"
              },
              category: {
                type: Type.STRING,
                description: "Categoria da despesa"
              },
              value: {
                type: Type.NUMBER,
                description: "Valor por parcela em R$"
              },
              installmentsCount: {
                type: Type.NUMBER,
                description: "Quantidade de parcelas"
              },
              startDate: {
                type: Type.STRING,
                description: "Data da 1ª parcela no formato YYYY-MM-DD"
              },
              dueDay: {
                type: Type.NUMBER,
                description: "Dia do vencimento no mês (1-31)"
              },
              vehiclePlateOrId: {
                type: Type.STRING,
                description: "Placa ou ID do veículo associado (opcional)"
              }
            },
            required: ["description", "category", "value", "installmentsCount"]
          }
        },
        {
          name: "start_rental",
          description: "Cria um novo contrato de locação para um veículo da frota.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              vehiclePlateOrId: {
                type: Type.STRING,
                description: "Placa ou ID do veículo a alugar"
              },
              tenantName: {
                type: Type.STRING,
                description: "Nome completo do motorista/locatário"
              },
              phone: {
                type: Type.STRING,
                description: "Telefone de contato"
              },
              startDate: {
                type: Type.STRING,
                description: "Data de início YYYY-MM-DD"
              },
              weeklyRate: {
                type: Type.NUMBER,
                description: "Valor semanal em R$"
              },
              depositValue: {
                type: Type.NUMBER,
                description: "Valor da caução em R$"
              },
              paymentDayOfWeek: {
                type: Type.NUMBER,
                description: "Dia de vencimento semanal (0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb)"
              }
            },
            required: ["vehiclePlateOrId", "tenantName", "weeklyRate", "depositValue"]
          }
        },
        {
          name: "terminate_rental",
          description: "Encerra um contrato de locação ativo.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              contractIdOrPlate: {
                type: Type.STRING,
                description: "ID do contrato ou placa do carro"
              },
              endDate: {
                type: Type.STRING,
                description: "Data de término YYYY-MM-DD"
              }
            },
            required: ["contractIdOrPlate"]
          }
        },
        {
          name: "add_interested_lead",
          description: "Cadastra um interessado na fila de espera de locação.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: "Nome do interessado"
              },
              phone: {
                type: Type.STRING,
                description: "Telefone de contato"
              },
              notes: {
                type: Type.STRING,
                description: "Observações adicionais"
              }
            },
            required: ["name", "phone"]
          }
        },
        {
          name: "navigate_to_tab",
          description: "Navega o usuário para uma aba da plataforma.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              tab: {
                type: Type.STRING,
                description: "Aba: 'dashboard', 'financials', 'transactions', 'vehicles', 'rentals', 'users'"
              }
            },
            required: ["tab"]
          }
        }
      ];

      // Formulate contents with history
      const contents: any[] = [];
      if (Array.isArray(history)) {
        for (const item of history.slice(-10)) {
          if (item && item.text && (item.role === "user" || item.role === "model")) {
            contents.push({
              role: item.role,
              parts: [{ text: item.text }]
            });
          }
        }
      }

      contents.push({
        role: "user",
        parts: [{ text: message }]
      });

      // Multi-model resilience: try fast and reliable models in order of stability
      const candidateModels = [
        "gemini-3.8-flash",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash"
      ];

      let response: any = null;
      let lastCallError: any = null;

      for (const modelName of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction,
              tools: [{ functionDeclarations }],
              temperature: 0.3,
            }
          });
          if (response) break;
        } catch (modelErr: any) {
          lastCallError = modelErr;
          console.warn(`[Gestor IA] Model ${modelName} returned error:`, modelErr?.message || modelErr);
        }
      }

      if (!response) {
        throw lastCallError || new Error("Nenhum modelo do Gemini respondeu no momento.");
      }

      const functionCalls = response.functionCalls || [];
      const reply = response.text || (functionCalls.length > 0 ? "Comando processado com sucesso pelo Skywalker." : "Entendido.");

      return res.json({
        reply,
        functionCalls
      });
    } catch (err: any) {
      console.error("[Gestor IA Error]:", err);
      const isCapacityError = err?.message?.includes("503") || err?.message?.includes("high demand") || err?.status === 503;
      const errorMessage = isCapacityError
        ? "Os servidores de inteligência artificial estão com alta demanda temporária. Por favor, aguarde alguns segundos e tente novamente."
        : (err?.message || "Falha na comunicação com o Gestor IA.");

      return res.status(500).json({
        error: errorMessage,
        details: err?.message || String(err)
      });
    }
  });

  // Serve static assets or mount Vite in development mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
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

import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import path from "path";

export default async function handler(req: any, res: any) {
  // CORS Configuration
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, ETag, If-None-Match, x-data-version, Cache-Control"
  );
  res.setHeader("Access-Control-Expose-Headers", "ETag");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (_) {
        // keep as is
      }
    }

    const { message, history, context } = body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Mensagem é obrigatória." });
    }

    // Support both GEMINI_API_KEY and API_KEY environment variables (trimmed for safety)
    const rawApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY || "";
    const apiKey = typeof rawApiKey === "string" ? rawApiKey.trim() : "";

    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      return res.status(200).json({
        reply: "Chave da API do Gemini não detectada no ambiente de produção. Adicione a variável GEMINI_API_KEY no painel de Environment Variables da Vercel para ativar o Skywalker plenamente!",
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

    // Fallback data snapshot if context wasn't passed directly
    let fallbackData = {};
    if (!context) {
      try {
        const backupPath = path.join(process.cwd(), "db_backup.json");
        if (fs.existsSync(backupPath)) {
          fallbackData = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
        }
      } catch (_) {}
    }

    const dataSnapshot = JSON.stringify(context || fallbackData || {}, null, 2);

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
   - Histórico de Manutenção de cada veículo: você tem acesso a todos os reparos, revisões, pneus e intervenções de oficina de cada carro.
   - Separação Financeira Estrita: despesas de Financiamento (aquisição, parcelas bancárias e consórcios) devem ser tratadas de forma estritamente separada das despesas de Manutenção (oficina, peças e revisões).
   - Contratos de locação (locatários, telefones, veículos vinculados, status, valores semanais, início e fim).
   - Extrato financeiro (todas as receitas de locação, despesas operacionais, parcelas de financiamento, manutenções e cauções).
   - Despesas futuras e parceladas (previsão, valores, parcelas pendentes e pagas, vencimentos).
   - Fila de espera de interessados (nome, telefone, aprovação de documentos).
   - Métricas globais (saldo em caixa real, receitas totais, despesas totais, caução retido).
5. EXECUÇÃO DE FUNÇÕES / FERRAMENTAS:
   - Você pode usar todas as funções que um usuário desenvolvedor/administrador possui.
   - Quando o usuário solicitar criação, alteração ou navegação, invoque a ferramenta correspondente:
     * add_transaction: Lança receita, despesa ou caução no extrato (use categoria 'Financiamento' para parcelas de veículos e 'Manutenção' para reparos).
     * update_vehicle_status: Atualiza status do veículo (available, rented, maintenance).
     * add_vehicle: Cadastra novo carro na frota.
     * add_future_expense: Lança previsão de despesa futura fixa ou parcelada.
     * start_rental: Inicia novo contrato de locação.
     * terminate_rental: Encerra contrato de locação.
     * add_interested_lead: Registra novo motorista na fila de espera.
     * get_vehicle_maintenance_history: Consulta o histórico de manutenção e gastos de oficina de um veículo.
     * get_financial_breakdown: Apura demonstrativo com separação entre Financiamentos e Manutenções.
     * navigate_to_tab: Muda para a aba solicitada (dashboard, financials, transactions, vehicles, rentals, users).
6. Quando uma ferramenta for executada, forneça uma confirmação sucinta com os pontos principais.

DADOS REAIS E COMPLETOS DO SISTEMA EM TEMPO REAL:
${dataSnapshot}
`;

    const functionDeclarations = [
      {
        name: "add_transaction",
        description: "Lança uma nova receita, despesa ou caução no extrato financeiro da Eletroflow. IMPORTANTE: Use categoria 'Financiamento' para parcelas de aquisição e 'Manutenção' para reparos e oficinas.",
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
              description: "Categoria: 'Aluguel Semanal', 'Financiamento', 'Manutenção', 'Combustível', 'Seguro', 'IPVA', 'Retenção', 'Outros'"
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
      },
      {
        name: "get_vehicle_maintenance_history",
        description: "Consulta o histórico detalhado de manutenções, reparos e revisões de um veículo específico na frota.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            plateOrId: {
              type: Type.STRING,
              description: "Placa ou ID do veículo a consultar (ex: 'ABC1D23')"
            }
          },
          required: ["plateOrId"]
        }
      },
      {
        name: "get_financial_breakdown",
        description: "Gera o balanço financeiro com separação obrigatória entre despesas de Financiamento e despesas de Manutenção/Oficina.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            scope: {
              type: Type.STRING,
              description: "Escopo da análise: 'geral', 'financiamentos_vs_manutencao' ou 'mensal'"
            }
          }
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

    // Multi-model resilience: strictly use active, production-ready models from Google
    const candidateModels = [
      "gemini-3.8-flash",
      "gemini-flash-latest",
      "gemini-3.1-flash-lite"
    ];

    let response: any = null;
    let lastCallError: any = null;

    for (const modelName of candidateModels) {
      // Try up to 2 attempts per candidate model with backoff
      for (let attempt = 0; attempt < 2; attempt++) {
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
          console.warn(`[Gestor IA Vercel] Model ${modelName} attempt ${attempt + 1} error:`, modelErr?.message || modelErr);
          const isRetryable =
            modelErr?.message?.includes("503") ||
            modelErr?.message?.includes("high demand") ||
            modelErr?.message?.includes("UNAVAILABLE") ||
            modelErr?.status === 503 ||
            modelErr?.status === 429;
          if (isRetryable && attempt === 0) {
            await new Promise(r => setTimeout(r, 1200));
          } else {
            break; // Proceed to next candidate model
          }
        }
      }
      if (response) break;
    }

    if (!response) {
      throw lastCallError || new Error("Nenhum modelo do Gemini respondeu no momento.");
    }

    const functionCalls = response.functionCalls || [];
    const reply = response.text || (functionCalls.length > 0 ? "Comando processado com sucesso pelo Skywalker." : "Entendido.");

    return res.status(200).json({
      reply,
      functionCalls
    });
  } catch (err: any) {
    console.error("[Gestor IA Vercel Error]:", err);
    const msg = err?.message || String(err || "");
    const isCapacityError =
      msg.includes("503") ||
      msg.includes("high demand") ||
      msg.includes("UNAVAILABLE") ||
      err?.status === 503;
    const isAuthError = msg.includes("API key not valid") || msg.includes("API_KEY_INVALID") || err?.status === 401 || err?.status === 403;

    let errorMessage = "O Skywalker encontrou uma instabilidade temporária ao conectar aos servidores de IA. Por favor, tente novamente em alguns segundos.";
    if (isCapacityError) {
      errorMessage = "Os servidores de inteligência artificial estão processando uma alta demanda momentânea. Por favor, tente novamente em instantes.";
    } else if (isAuthError) {
      errorMessage = "Chave da API do Gemini inválida ou não configurada na variável GEMINI_API_KEY.";
    }

    return res.status(200).json({
      reply: errorMessage,
      functionCalls: [],
      errorNotice: true
    });
  }
}

# Plano de Implementação: Correção do Gestor IA no Ambiente de Produção (Vercel)

## Diagnóstico do Problema
No ambiente local, as requisições para `/api/gestor-ia/chat` são atendidas diretamente pelo servidor Express em `server.ts`. Porém, na **Vercel (produção)**:
1. O roteamento de APIs serverless da Vercel busca arquivos dentro da pasta `api/`.
2. A pasta `api/` possuía apenas `db-status.ts`, `load-data.ts` e `save-data.ts`, **não existindo `api/gestor-ia/chat.ts`**.
3. Como resultado, chamadas para `/api/gestor-ia/chat` na Vercel eram redirecionadas para o fallback do SPA (`/index.html`) ou retornavam 404. O frontend recebia HTML em vez de JSON, disparando o bloco catch que exibia a mensagem *"Não consegui me comunicar com o servidor no momento. Verifique a conexão ou a chave GEMINI_API_KEY no painel de configurações."*.

---

## Proposta de Solução

### 1. Criar Função Serverless Dedicada para a Vercel
- Criar o arquivo `api/gestor-ia/chat.ts` compatível com o padrão Vercel Serverless Function (`export default async function handler(req, res)`).
- Suportar cabeçalhos CORS completos e preflight `OPTIONS`.
- Suportar tanto `process.env.GEMINI_API_KEY` quanto `process.env.API_KEY` com mensagens claras caso a chave não esteja configurada.
- Integrar a biblioteca `@google/genai` com os mesmos modelos de alta disponibilidade (`gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3.8-flash`) e todas as function declarations (lançar transações, cadastrar veículos, despesas futuras, etc.).

### 2. Sincronizar e Fortalecer o `server.ts`
- Garantir que o ambiente de desenvolvimento e testes locais (`server.ts`) também compartilhe os mesmos cabeçalhos e tolerância de variáveis (`GEMINI_API_KEY` ou `API_KEY`).

### 3. Melhorar a Resiliência e Mensagens de Erro no Frontend (`GestorIATab.tsx`)
- Detectar quando a resposta não for JSON (por exemplo, erro HTTP ou HTML inesperado) e detalhar a causa exata na mensagem para facilitar o diagnóstico rápido.

---

## Verificação e Testes
1. Testar compilação (`compile_applet`) e linting (`lint_applet`).
2. Testar chamada POST direta para o handler serverless e para o servidor de desenvolvimento.
3. Garantir conformidade com as regras de performance e cache do projeto.

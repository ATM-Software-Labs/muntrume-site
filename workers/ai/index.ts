import { handleAiRequest } from "../../src/server/ai-handler";

interface Env {
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> };
  AI_RATE_LIMIT?: {
    get: (key: string) => Promise<string | null>;
    put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<unknown>;
  };
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/api/ai") return new Response("Not found", { status: 404 });
    return handleAiRequest(request, env);
  },
};

import { handleAiRequest, type AiEnv } from "../../src/server/ai-handler";

interface PagesContext {
  request: Request;
  env: AiEnv;
}

/** Pages Function. Este repo ignora `functions/`, así que el archivo vive aquí. */
export function onRequest(context: PagesContext): Promise<Response> {
  return handleAiRequest(context.request, context.env);
}

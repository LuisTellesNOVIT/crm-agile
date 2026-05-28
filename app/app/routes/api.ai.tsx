import type { ActionFunctionArgs } from "react-router";

// Resource route for the AI Drawer. Stubbed for now — wire @anthropic-ai/sdk
// here when ANTHROPIC_API_KEY is configured.
export async function action({ request }: ActionFunctionArgs) {
  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    hint?: string | null;
  };
  const message = body.message ?? "";
  const hint = body.hint ?? null;
  const reply =
    `(IA placeholder) Recibí: "${message}".` +
    (hint ? ` Contexto: ${hint}.` : "") +
    " Conectar @anthropic-ai/sdk con ANTHROPIC_API_KEY para respuestas reales.";
  return Response.json({ reply });
}

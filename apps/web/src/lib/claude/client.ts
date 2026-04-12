import Anthropic from "@anthropic-ai/sdk";

// Centralized model ID so we only have to change it in one place. The web app
// uses the same model as the ingest pipeline — any divergence means two
// different review loops. Don't split them without a good reason.
export const CLAUDE_MODEL = "claude-sonnet-4-6";

let cachedClient: Anthropic | null = null;

// Lazy-init so importing this module doesn't throw at build time on preview
// deployments that don't have the key set (e.g. Vercel preview for a PR). The
// error only fires when something actually tries to call the model.
export function getAnthropicClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (not committed) or your Vercel project environment variables.",
    );
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

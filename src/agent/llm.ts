import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const DEFAULT_MODEL = "claude-sonnet-5-5";

export type JsonRequest<T> = {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  toolName: string;
  maxTokens?: number;
};

export type WebSearchResult = { text: string; urls: string[] };

/** The only door to the language model. Tests pass a fake implementation. */
export interface LlmClient {
  /** Forces structured output, then validates it against the schema. Throws if invalid. */
  json<T>(req: JsonRequest<T>): Promise<T>;
  /** Optional: web search. Returns findings text and the URLs that the search actually returned. */
  search?(prompt: string): Promise<WebSearchResult>;
  /** Cheap round trip used by /api/health. */
  ping(): Promise<void>;
}

export function createLlm(env: NodeJS.ProcessEnv = process.env): LlmClient | null {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const model = env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });
  const webSearchOn = env.ENABLE_WEB_SEARCH === "true";

  return {
    async json<T>({ system, user, schema, toolName, maxTokens = 2000 }: JsonRequest<T>): Promise<T> {
      const input_schema = z.toJSONSchema(schema) as Anthropic.Tool.InputSchema;
      const res = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
        tools: [{ name: toolName, description: "Return the result in this exact structure.", input_schema }],
        tool_choice: { type: "tool", name: toolName },
      });
      const block = res.content.find((b) => b.type === "tool_use");
      if (!block || block.type !== "tool_use") throw new Error("Model did not return structured output");
      return schema.parse(block.input);
    },

    search: webSearchOn
      ? async (prompt: string) => {
          const res = await client.messages.create({
            model,
            max_tokens: 3000,
            messages: [{ role: "user", content: prompt }],
            tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
          });
          const urls = new Set<string>();
          let text = "";
          for (const b of res.content) {
            if (b.type === "text") {
              text += b.text;
              for (const c of b.citations ?? []) if ("url" in c && c.url) urls.add(c.url);
            } else if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
              for (const r of b.content) if (r.type === "web_search_result") urls.add(r.url);
            }
          }
          return { text, urls: [...urls] };
        }
      : undefined,

    async ping() {
      await client.messages.create({ model, max_tokens: 8, messages: [{ role: "user", content: "ping" }] });
    },
  };
}

import { ChatOllama } from "@langchain/ollama";
import { z } from "zod";
import { logger } from "./logger";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const MODEL_NAME = process.env.LLM_MODEL || "qwen3.5:9b";

const llm = new ChatOllama({
  baseUrl: OLLAMA_BASE_URL,
  model: MODEL_NAME,
  temperature: 0,
  format: "json",
  think: false
});

const JSON_ONLY_INSTRUCTION = `Respond with a single JSON value only (object or array).
No markdown, no code fences, no headings, no commentary, no <think> blocks.`;

/**
 * Calls the local Qwen model and validates the response against a Zod schema.
 * Qwen 3.5 often emits thinking or markdown; we force JSON mode, extract a JSON
 * value if mixed text leaks through, and retry once on parse/schema failure.
 */
export async function structuredCall<T>(
  stageName: string,
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodSchema<T>
): Promise<T> {
  const start = Date.now();
  logger.stageStart(stageName, "LLM call", { model: MODEL_NAME, format: "json" });

  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: `${systemPrompt}\n\n${JSON_ONLY_INSTRUCTION}` },
    { role: "user", content: userPrompt }
  ];

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let rawText = "";
    try {
      const response = await llm.invoke(messages);
      rawText = messageText(response.content);
      logger.debug(stageName, "LLM raw output received", {
        attempt,
        chars: rawText.length,
        preview: rawText.slice(0, 240)
      });

      const parsed = extractJson(rawText);
      const validated = schema.safeParse(parsed);
      if (!validated.success) {
        lastError = new Error(`${stageName}: LLM output did not match expected schema`);
        logger.stageWarn(stageName, "LLM output failed schema validation", {
          attempt,
          zodErrors: validated.error.flatten(),
          preview: rawText.slice(0, 400)
        });
        messages.push({
          role: "user",
          content: `Your previous reply was not valid for the schema. Return ONLY corrected JSON.\nIssues: ${JSON.stringify(validated.error.issues)}\nPrevious reply:\n${rawText.slice(0, 4000)}`
        });
        continue;
      }

      logger.stageComplete(stageName, "LLM call", {
        durationMs: Date.now() - start,
        attempt
      });
      return validated.data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.stageWarn(stageName, "LLM attempt failed", {
        attempt,
        error: lastError.message,
        preview: rawText.slice(0, 240)
      });
      if (attempt === 1) {
        messages.push({
          role: "user",
          content: `The previous reply was not valid JSON. Reply with a single JSON value only, no markdown.\nPrevious reply:\n${rawText.slice(0, 4000) || lastError.message}`
        });
        continue;
      }
    }
  }

  logger.stageError(stageName, "LLM call failed", {
    durationMs: Date.now() - start,
    error: lastError?.message ?? "unknown"
  });
  throw lastError ?? new Error(`${stageName}: LLM call failed`);
}

function messageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text: unknown }).text);
        }
        return "";
      })
      .join("");
  }
  return JSON.stringify(content);
}

export function extractJson(raw: string): unknown {
  const stripped = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?/gi, "")
    .trim();

  const direct = tryParse(stripped);
  if (direct !== undefined) {
    return direct;
  }

  const slice = sliceJson(stripped);
  if (slice) {
    const parsed = tryParse(slice);
    if (parsed !== undefined) {
      return parsed;
    }
  }

  throw new Error("LLM output was not valid JSON");
}

function sliceJson(text: string): string | null {
  const objectStart = text.indexOf("{");
  const arrayStart = text.indexOf("[");
  let start = -1;
  if (objectStart === -1) {
    start = arrayStart;
  } else if (arrayStart === -1) {
    start = objectStart;
  } else {
    start = Math.min(objectStart, arrayStart);
  }
  if (start === -1) {
    return null;
  }
  const closer = text[start] === "{" ? "}" : "]";
  const end = text.lastIndexOf(closer);
  if (end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}

function tryParse(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(text.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return undefined;
    }
  }
}

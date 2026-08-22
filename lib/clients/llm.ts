import { ChatOllama } from "@langchain/ollama";
import { z } from "zod";
import { logger } from "./logger";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

function modelName(): string {
  return process.env.LLM_MODEL?.trim() || "llama3.2:latest";
}

function getLlm() {
  return new ChatOllama({
    baseUrl: OLLAMA_BASE_URL,
    model: modelName(),
    temperature: 0,
    format: "json",
    think: false
  });
}

const JSON_ONLY_INSTRUCTION = `Respond with a single JSON value only (object or array).
No markdown, no code fences, no headings, no commentary, no <think> blocks.
If the schema is a list, return a JSON array at the top level — not an object wrapper.`;

/**
 * Calls the local Ollama model and validates the response against a Zod schema.
 * Models often wrap arrays as {"competitors":[...]}; we unwrap those before validate,
 * force JSON mode, extract JSON from mixed text, and retry once on failure.
 */
export async function structuredCall<T>(
  stageName: string,
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodSchema<T>
): Promise<T> {
  const start = Date.now();
  const model = modelName();
  logger.stageStart(stageName, "LLM call", { model, format: "json" });

  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: `${systemPrompt}\n\n${JSON_ONLY_INSTRUCTION}` },
    { role: "user", content: userPrompt }
  ];

  let lastError: Error | null = null;
  const llm = getLlm();

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

      const parsed = coerceForSchema(extractJson(rawText), schema);
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

function coerceForSchema(parsed: unknown, schema: z.ZodTypeAny): unknown {
  if (schema.safeParse(parsed).success) {
    return parsed;
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    const wrapperKeys = [
      "competitors",
      "candidates",
      "companies",
      "profiles",
      "results",
      "items",
      "data",
      "output"
    ];
    for (const key of wrapperKeys) {
      if (key in record && schema.safeParse(record[key]).success) {
        logger.debug("LLM", "unwrapped object key to match schema", { key });
        return record[key];
      }
    }

    const arrayValues = Object.values(record).filter(Array.isArray);
    if (arrayValues.length === 1 && schema.safeParse(arrayValues[0]).success) {
      logger.debug("LLM", "unwrapped sole array field to match schema");
      return arrayValues[0];
    }
  }

  if (Array.isArray(parsed) && parsed.length === 1 && schema.safeParse(parsed[0]).success) {
    logger.debug("LLM", "unwrapped single-element array to match object schema");
    return parsed[0];
  }

  return parsed;
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

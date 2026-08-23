import { ChatOllama } from "@langchain/ollama";
import { z } from "zod";
import { logger } from "./logger";
import { asObjectList, repairCompanyProfile } from "./normalize-json";

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
      const response = await invokeTimed(llm, messages);
      rawText = messageText(response.content);
      logger.debug(stageName, "LLM raw output received", {
        attempt,
        chars: rawText.length,
        preview: rawText.slice(0, 240)
      });

      const parsed = coerceForSchema(extractJson(rawText), schema);
      const validated = schema.safeParse(parsed);
      if (!validated.success) {
        lastError = new Error(schemaErrorMessage(stageName, validated.error));
        logger.stageWarn(stageName, "LLM output failed schema validation", {
          attempt,
          missingFields: validated.error.issues.map((issue) => issue.path.join(".") || issue.message),
          zodErrors: validated.error.flatten(),
          preview: rawText.slice(0, 400)
        });
        if (attempt === 2) {
          break;
        }
        messages.push({
          role: "user",
          content: `That JSON did not match the schema. Reply with corrected JSON only. Do not echo source dumps. Issues: ${JSON.stringify(validated.error.issues.slice(0, 8))}`
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
          content: "The previous reply was not valid JSON. Reply with a single JSON value only."
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

async function invokeTimed(
  llm: ReturnType<typeof getLlm>,
  messages: { role: "system" | "user"; content: string }[]
) {
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS) || 90_000;
  return await Promise.race([
    llm.invoke(messages),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`The local model did not reply within ${Math.round(timeoutMs / 1000)} seconds.`));
      }, timeoutMs);
    })
  ]);
}

function schemaErrorMessage(stageName: string, error: z.ZodError): string {
  const fields = [...new Set(error.issues.map((issue) => issue.path.join(".") || "profile"))];
  return `${stageName}: the model omitted required fields (${fields.slice(0, 6).join(", ")}).`;
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

  const unwrapped = unwrapZod(schema);
  const wantsArray = unwrapped._def?.typeName === "ZodArray";

  if (wantsArray) {
    const list = asObjectList(parsed);
    if (schema.safeParse(list).success) {
      return list;
    }
    const inner = unwrapped._def?.type as z.ZodTypeAny | undefined;
    if (inner) {
      const innerShape = getZodObjectShape(inner);
      const mapped = list.map((item) => {
        // First try: extract only the schema-defined fields
        if (innerShape && Object.keys(innerShape).length > 0) {
          const extracted = extractSchemaFields(item, innerShape);
          if (inner.safeParse(extracted).success) {
            logger.debug("LLM", "extracted schema fields from item", { fields: Object.keys(innerShape) });
            return extracted;
          }
        }
        // Second try: for simple {name, domain} schemas, extract those directly
        const nameDomain = extractNameDomain(item);
        if (nameDomain && inner.safeParse(nameDomain).success) {
          logger.debug("LLM", "extracted name/domain from item");
          return nameDomain;
        }
        // Third try: repairCompanyProfile (for full CompanyProfile schemas)
        const repaired = repairCompanyProfile(item);
        if (repaired && inner.safeParse(repaired).success) {
          logger.debug("LLM", "repaired nested company fields into a profile");
          return repaired;
        }
        return inner.safeParse(item).success ? item : coerceItem(item, inner);
      });
      if (schema.safeParse(mapped).success) {
        return mapped;
      }
    }
    return list;
  }

  if (Array.isArray(parsed) && parsed.length === 1 && schema.safeParse(parsed[0]).success) {
    logger.debug("LLM", "unwrapped single-element array to match object schema");
    return parsed[0];
  }

  return parsed;
}

function extractNameDomain(item: unknown): { name: string; domain: string } | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return null;
  }
  const record = item as Record<string, unknown>;
  const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : undefined;
  const domain = typeof record.domain === "string" && record.domain.trim() ? record.domain.trim() : undefined;
  if (name && domain) {
    return { name, domain };
  }
  return null;
}

function getZodObjectShape(schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> | null {
  const unwrapped = unwrapZod(schema);
  if (unwrapped._def?.typeName === "ZodObject") {
    return unwrapped._def.shape() as Record<string, z.ZodTypeAny>;
  }
  return null;
}

function extractSchemaFields(item: unknown, shape: Record<string, z.ZodTypeAny>): Record<string, unknown> {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return {};
  }
  const record = item as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, zodType] of Object.entries(shape)) {
    if (key in record) {
      result[key] = record[key];
    }
  }
  return result;
}

function coerceItem(item: unknown, schema: z.ZodTypeAny): unknown {
  const repaired = repairCompanyProfile(item);
  if (repaired && schema.safeParse(repaired).success) {
    return repaired;
  }
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const record = { ...(item as Record<string, unknown>) };
    for (const [key, value] of Object.entries(record)) {
      if (value === null) {
        record[key] = undefined;
      }
    }
    if (schema.safeParse(record).success) {
      return record;
    }
  }
  return item;
}

function unwrapZod(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;
  for (let i = 0; i < 8; i += 1) {
    const typeName = current._def?.typeName as string | undefined;
    if (typeName === "ZodEffects") {
      current = current._def.schema as z.ZodTypeAny;
      continue;
    }
    if (typeName === "ZodOptional" || typeName === "ZodNullable" || typeName === "ZodDefault") {
      current = current._def.innerType as z.ZodTypeAny;
      continue;
    }
    break;
  }
  return current;
}

export async function jsonCall(
  stageName: string,
  systemPrompt: string,
  userPrompt: string
): Promise<unknown> {
  const start = Date.now();
  const model = modelName();
  logger.stageStart(stageName, "LLM JSON call", { model, format: "json" });

  const llm = getLlm();
  const response = await invokeTimed(llm, [
    { role: "system", content: `${systemPrompt}\n\n${JSON_ONLY_INSTRUCTION}` },
    { role: "user", content: userPrompt }
  ]);
  const rawText = messageText(response.content);
  logger.debug(stageName, "LLM raw output received", {
    chars: rawText.length,
    preview: rawText.slice(0, 400)
  });
  const parsed = extractJson(rawText);
  logger.stageComplete(stageName, "LLM JSON call", { durationMs: Date.now() - start });
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

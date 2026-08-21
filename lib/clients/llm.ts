// lib/clients/llm.ts
import { ChatOllama } from "@langchain/ollama";
import { z } from "zod";
import { logger } from "./logger";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const MODEL_NAME = process.env.LLM_MODEL || "qwen3.5:9b";

const llm = new ChatOllama({
  baseUrl: OLLAMA_BASE_URL,
  model: MODEL_NAME,
  temperature: 0.2
});

/**
 * Calls the local Qwen 3.5 model and validates the response against a Zod schema.
 * Every pipeline stage should use this rather than calling the LLM raw, so that
 * malformed output fails loudly and early instead of silently corrupting PipelineState.
 */
export async function structuredCall<T>(
  stageName: string,
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodSchema<T>
): Promise<T> {
  const start = Date.now();
  logger.stageStart(stageName, "LLM call", { model: MODEL_NAME });

  try {
    const response = await llm.invoke([
      {
        role: "system",
        content:
          systemPrompt +
          "\n\nRespond ONLY with valid JSON matching the required schema. No preamble, no markdown code fences, no explanation."
      },
      { role: "user", content: userPrompt }
    ]);

    const rawText =
      typeof response.content === "string" ? response.content : JSON.stringify(response.content);

    const cleaned = rawText.replace(/```json|```/g, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      logger.stageError(stageName, "LLM returned non-JSON output", {
        rawOutput: cleaned.slice(0, 500)
      });
      throw new Error(`${stageName}: LLM output was not valid JSON`);
    }

    const validated = schema.safeParse(parsed);
    if (!validated.success) {
      logger.stageError(stageName, "LLM output failed schema validation", {
        zodErrors: validated.error.flatten(),
        rawOutput: cleaned.slice(0, 500)
      });
      throw new Error(`${stageName}: LLM output did not match expected schema`);
    }

    const durationMs = Date.now() - start;
    logger.stageComplete(stageName, "LLM call", { durationMs });

    return validated.data;
  } catch (err) {
    const durationMs = Date.now() - start;
    logger.stageError(stageName, "LLM call failed", {
      durationMs,
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
}

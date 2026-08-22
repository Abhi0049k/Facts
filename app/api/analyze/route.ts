import { randomUUID } from "crypto";
import { logger, withPipelineRun } from "@/lib/clients/logger";
import { runPipeline } from "@/lib/pipeline/run";
import type { PipelineStreamEvent } from "@/lib/pipeline-events";
import { PipelineStageError, type AnalyzeErrorResponse, type AnalyzeRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const runId = randomUUID().slice(0, 8);
  const encoder = new TextEncoder();

  let body: AnalyzeRequest;
  try {
    body = (await request.json()) as AnalyzeRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" } satisfies AnalyzeErrorResponse, { status: 400 });
  }

  const companyUrl = normalizeCompanyUrl(body.companyUrl);
  if (!companyUrl) {
    return Response.json(
      { error: "Enter a valid company URL, for example https://company.com" } satisfies AnalyzeErrorResponse,
      { status: 400 }
    );
  }

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: PipelineStreamEvent | { type: "ping" }) => {
        try {
          const payload = event.type === "ping" ? ": ping\n\n" : `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          /* stream already closed */
        }
      };

      const ping = setInterval(() => {
        try {
          send({ type: "ping" });
        } catch {
          clearInterval(ping);
        }
      }, 12_000);

      withPipelineRun(runId, async () => {
        const completedStages: number[] = [];
        try {
          const result = await runPipeline(
            {
              runId,
              companyUrl,
              includeSentiment: Boolean(body.includeSentiment)
            },
            async (event) => {
              if (event.type === "stage" && event.status === "complete") {
                completedStages.push(event.stage);
              }
              send(event);
            }
          );
          send({
            type: "done",
            runId: result.runId ?? runId,
            state: result.state,
            completedStages: result.completedStages
          });
        } catch (error) {
          const failedStage = error instanceof PipelineStageError ? error.stage : "unknown";
          logger.pipelineFailed(
            runId,
            failedStage,
            error instanceof Error ? error.message : String(error),
            { completedStages }
          );
          send({
            type: "error",
            runId,
            error: error instanceof Error ? error.message : "Pipeline failed",
            failedStage,
            completedStages
          });
        } finally {
          clearInterval(ping);
          controller.close();
        }
      }).catch((error) => {
        logger.exception("Pipeline", error, { runId });
        clearInterval(ping);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}

function normalizeCompanyUrl(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

import { randomUUID } from "crypto";
import { logger, withPipelineRun } from "@/lib/clients/logger";
import { readWorkflowCache, writeWorkflowCache } from "@/lib/pipeline/cache";
import { withPipelineNotices } from "@/lib/pipeline/notices";
import { runPipeline } from "@/lib/pipeline/run";
import type { PipelineStreamEvent } from "@/lib/pipeline-events";
import {
  PipelineStageError,
  type AnalyzeErrorResponse,
  type AnalyzeRequest,
  type PipelineCheckpoint
} from "@/lib/types";

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

      withPipelineRun(runId, () =>
        withPipelineNotices((event) => send(event), async () => {
          const completedStages: number[] = [];
          let latestCheckpoint: PipelineCheckpoint | null = null;
          try {
            const cached = await readWorkflowCache(companyUrl, Boolean(body.includeSentiment));
            if (cached?.status === "complete" && cached.state.comparison) {
              logger.pipelineComplete(runId, 0, {
                completedStages: cached.completedStages,
                cacheHit: true
              });
              for (const stage of cached.stagePayloads.sort((a, b) => a.stage - b.stage)) {
                send({
                  type: "stage",
                  stage: stage.stage,
                  status: "complete",
                  message: `Finished ${stageLabel(stage.stage)}`,
                  payload: stage.payload
                });
              }
              send({
                type: "done",
                runId,
                state: cached.state,
                completedStages: cached.completedStages,
                databaseMatch: cached.databaseMatch
              });
              return;
            }

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
              },
              {
                resume: cached,
                onCheckpoint: async (checkpoint) => {
                  latestCheckpoint = checkpoint;
                  await writeWorkflowCache(checkpoint, "partial");
                }
              }
            );
            if (!result.halted) {
              const savedCheckpoint = latestCheckpoint as PipelineCheckpoint | null;
              const completeCheckpoint: PipelineCheckpoint = savedCheckpoint
                ? {
                    ...savedCheckpoint,
                    state: result.state,
                    completedStages: result.completedStages,
                    databaseMatch: result.databaseMatch
                  }
                : {
                    companyUrl,
                    normalizedDomain: "",
                    includeSentiment: Boolean(body.includeSentiment),
                    completedStages: result.completedStages,
                    stagePayloads: [],
                    state: result.state,
                    databaseMatch: result.databaseMatch
                  };
              await writeWorkflowCache(completeCheckpoint, "complete");
              send({
                type: "done",
                runId: result.runId ?? runId,
                state: result.state,
                completedStages: result.completedStages,
                databaseMatch: result.databaseMatch
              });
            }
          } catch (error) {
            const failedStage = error instanceof PipelineStageError ? error.stage : "unknown";
            if (latestCheckpoint) {
              await writeWorkflowCache(latestCheckpoint, "failed", {
                failedStage,
                error: publicErrorMessage(error)
              });
            }
            logger.pipelineFailed(
              runId,
              failedStage,
              error instanceof Error ? error.message : String(error),
              { completedStages }
            );
            send({
              type: "error",
              runId,
              error: publicErrorMessage(error),
              failedStage,
              completedStages
            });
          } finally {
            clearInterval(ping);
            controller.close();
          }
        })
      ).catch((error) => {
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

function stageLabel(stage: number) {
  const labels: Record<number, string> = {
    0: "Lookup",
    1: "Ingest site",
    2: "Understand company",
    3: "Discover competitors",
    4: "Rank top five",
    5: "Scrape competitors",
    6: "Extract data",
    7: "Compare market",
    8: "Sentiment"
  };
  return labels[stage] ?? `Step ${stage}`;
}

function publicErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Pipeline failed";
  if (/no data could be found/i.test(message) || /failed to scrape/i.test(message)) {
    return "No data could be found for this company.";
  }
  return message;
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

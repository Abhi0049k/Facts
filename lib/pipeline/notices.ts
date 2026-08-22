import { AsyncLocalStorage } from "async_hooks";
import { stageNumberFromName } from "@/lib/stage-number";
import type { PipelineStreamEvent } from "@/lib/pipeline-events";

const notices = new AsyncLocalStorage<(event: PipelineStreamEvent) => void>();

export function withPipelineNotices<T>(
  send: (event: PipelineStreamEvent) => void,
  fn: () => Promise<T>
): Promise<T> {
  return notices.run(send, fn);
}

export function emitPipelineNotice(stageName: string, message: string) {
  const send = notices.getStore();
  if (!send) {
    return;
  }
  send({
    type: "stage",
    stage: stageNumberFromName(stageName) ?? 0,
    status: "retry",
    message
  });
}

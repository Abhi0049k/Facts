import type { PipelineStreamEvent } from "@/lib/pipeline-events";

export async function readAnalyzeStream(
  response: Response,
  onEvent: (event: PipelineStreamEvent) => void
): Promise<void> {
  if (!response.body) {
    throw new Error("The analysis stream did not start. Is the Next.js server still running?");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const dataLine = chunk
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.startsWith("data:"));
      if (!dataLine) {
        continue;
      }
      const json = dataLine.slice("data:".length).trim();
      if (!json) {
        continue;
      }
      onEvent(JSON.parse(json) as PipelineStreamEvent);
    }
  }
}

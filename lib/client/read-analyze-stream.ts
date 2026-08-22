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

  const consume = (chunk: string) => {
    const dataLine = chunk
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("data:"));
    if (!dataLine) {
      return;
    }
    const json = dataLine.slice("data:".length).trim();
    if (!json) {
      return;
    }
    try {
      onEvent(JSON.parse(json) as PipelineStreamEvent);
    } catch (error) {
      throw new Error(
        `Could not read a pipeline event (${error instanceof Error ? error.message : "invalid JSON"}).`
      );
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      consume(chunk);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    consume(buffer);
  }
}

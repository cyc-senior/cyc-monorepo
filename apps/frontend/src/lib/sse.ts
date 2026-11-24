/**
 * Minimal Server-Sent Events reader for `fetch` responses. The browser's
 * EventSource cannot send a bearer token, so streams are read with fetch.
 */

export interface SseEvent {
  /** The `event:` field; `message` when the server sent none. */
  type: string;
  /** The `data:` field, JSON-decoded when it is JSON, else the raw text. */
  data: unknown;
}

/**
 * Parses one SSE frame. Returns null for comments, heartbeats and frames
 * without data. NestJS reports a failed stream as `event: error` with the
 * error message as plain (non-JSON) text, so non-JSON data is kept as a string.
 */
export function parseSseEvent(raw: string): SseEvent | null {
  let type = "message";
  const data: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) type = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trim());
  }
  if (type === "heartbeat" || data.length === 0) return null;
  const text = data.join("\n");
  try {
    return { type, data: JSON.parse(text) };
  } catch {
    return { type, data: text };
  }
}

/**
 * Reads `body` to the end, calling `onEvent` for every event. Returning
 * `false` from `onEvent` stops reading early.
 */
export async function readSseStream(
  body: ReadableStream<Uint8Array<ArrayBuffer>>,
  onEvent: (event: SseEvent) => boolean | void
): Promise<void> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += value.replace(/\r\n/g, "\n");
      let split: number;
      while ((split = buffer.indexOf("\n\n")) !== -1) {
        const event = parseSseEvent(buffer.slice(0, split));
        buffer = buffer.slice(split + 2);
        if (event && onEvent(event) === false) {
          // Stopping early: close the connection instead of leaving it open.
          await reader.cancel().catch(() => undefined);
          return;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** The human-readable message of an SSE `error` event's data. */
export function sseErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

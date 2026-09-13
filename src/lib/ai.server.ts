const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

type JsonSchema = Record<string, unknown>;

function requireKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Sherlock's mind is offline: missing AI credentials.");
  return key;
}

async function callGateway(body: Record<string, unknown>): Promise<string> {
  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": requireKey(),
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({ ...body, model: MODEL, stream: true }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    console.error(`AI gateway error [${response.status}]: ${detail}`);
    if (response.status === 429) throw new Error("Sherlock is thinking too fast. Try again shortly.");
    if (response.status === 402 || response.status === 403) {
      throw new Error("Sherlock's AI credits are unavailable. Check the workspace AI balance.");
    }
    throw new Error(`Sherlock could not answer (${response.status}).`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload) as {
            type?: string;
            delta?: string;
            response?: { output_text?: string };
          };
          if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
            text += event.delta;
          } else if (event.type === "response.completed" && !text) {
            text = event.response?.output_text ?? "";
          }
        } catch {
          // ignore keep-alive / partial frames
        }
      }
    }
  }

  return text.trim();
}

function messages(instructions: string, input: string) {
  return [
    { role: "developer", content: [{ type: "input_text", text: instructions }] },
    { role: "user", content: [{ type: "input_text", text: input }] },
  ];
}

export async function generateJson<T>(args: {
  instructions: string;
  input: string;
  schemaName: string;
  schema: JsonSchema;
  effort?: "low" | "medium";
}): Promise<T> {
  const raw = await callGateway({
    input: messages(args.instructions, args.input),
    reasoning: { effort: args.effort ?? "low", summary: "auto" },
    include: ["reasoning.encrypted_content"],
    store: false,
    text: {
      format: {
        type: "json_schema",
        name: args.schemaName,
        strict: true,
        schema: args.schema,
      },
    },
  });

  if (!raw) throw new Error("Sherlock returned nothing.");
  return JSON.parse(raw) as T;
}

/** Reads the text out of an image (data URL) using the vision model. */
export async function readImageText(args: {
  instructions: string;
  dataUrl: string;
}): Promise<string> {
  const text = await callGateway({
    input: [
      { role: "developer", content: [{ type: "input_text", text: args.instructions }] },
      {
        role: "user",
        content: [
          { type: "input_text", text: "Transcribe every piece of text and diagram label in this image." },
          { type: "input_image", image_url: args.dataUrl },
        ],
      },
    ],
    reasoning: { effort: "low", summary: "auto" },
    include: ["reasoning.encrypted_content"],
    store: false,
  });
  return text;
}

export async function generateProse(args: {
  instructions: string;
  input: string;
  effort?: "low" | "medium";
}): Promise<string> {
  const text = await callGateway({
    input: messages(args.instructions, args.input),
    reasoning: { effort: args.effort ?? "low", summary: "auto" },
    include: ["reasoning.encrypted_content"],
    store: false,
  });
  return text || "I need a moment to gather my thoughts — ask me again.";
}

export const SHERLOCK_VOICE_INSTRUCTIONS = `You are Sherlock Holmes reimagined as a warm, exacting tutor in an app called Sherlock Holes.
You speak plainly and briefly, in the second person, with the occasional detective turn of phrase ("the trail goes cold here").
You never flatter. You never hand over an answer the student is close to finding.`;

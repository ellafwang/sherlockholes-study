import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const speakSchema = z.object({ text: z.string().min(1).max(4000) });

const listenSchema = z.object({
  audio: z.string().min(16),
  mimeType: z
    .enum(["audio/wav", "audio/webm", "audio/webm;codecs=opus", "audio/mp4", "audio/ogg", "audio/ogg;codecs=opus"])
    .default("audio/webm"),
  /** ISO-639-3 language pinned by the speaker, e.g. "eng". */
  languageCode: z.string().min(2).max(8).default("eng"),
  /** Jargon, acronyms and names that bias the model's spelling. */
  keyterms: z.array(z.string().min(1).max(80)).max(100).default([]),
});

export type TranscriptTurn = {
  speaker: string;
  start: number;
  end: number;
  text: string;
};

export type ListenResult =
  | { ok: true; text: string; turns: TranscriptTurn[]; events: string[] }
  | { ok: false; reason: "not_connected" | "failed"; message: string };

type ScribeWord = {
  text?: string;
  type?: string;
  start?: number;
  end?: number;
  speaker_id?: string;
};

/** Groups word-level results into speaker turns with timestamps. */
function buildTurns(words: ScribeWord[]): { turns: TranscriptTurn[]; events: string[] } {
  const turns: TranscriptTurn[] = [];
  const events: string[] = [];
  for (const word of words) {
    const text = word.text ?? "";
    if (word.type === "audio_event") {
      if (text.trim()) events.push(text.trim());
      continue;
    }
    if (!text) continue;
    const speaker = word.speaker_id ?? "speaker_0";
    const last = turns[turns.length - 1];
    if (last && last.speaker === speaker) {
      last.text += text;
      last.end = word.end ?? last.end;
      continue;
    }
    if (word.type === "spacing") continue;
    turns.push({ speaker, start: word.start ?? 0, end: word.end ?? word.start ?? 0, text });
  }
  return {
    turns: turns.map((turn) => ({ ...turn, text: turn.text.replace(/\s+/g, " ").trim() })).filter((t) => t.text),
    events,
  };
}

/**
 * Transcribes a clip of the student's voice with ElevenLabs Scribe v2:
 * speaker diarization, pinned language, keyterm biasing and audio events.
 * The API key never leaves the server.
 */
export const transcribeSpeech = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => listenSchema.parse(input))
  .handler(async ({ data }): Promise<ListenResult> => {
    const apiKey = process.env["ELEVENLABS_API_KEY"];
    if (!apiKey) {
      return {
        ok: false,
        reason: "not_connected",
        message: "Transcription isn't connected yet — type your explanation instead.",
      };
    }

    const bytes = Buffer.from(data.audio, "base64");
    if (bytes.byteLength < 2_048) {
      return {
        ok: false,
        reason: "failed",
        message: "That recording was empty — please try speaking again.",
      };
    }
    if (bytes.byteLength > 24 * 1024 * 1024) {
      return {
        ok: false,
        reason: "failed",
        message: "That recording was too large — please record a shorter answer.",
      };
    }

    const baseMimeType = data.mimeType.split(";")[0];
    const extension =
      baseMimeType === "audio/wav"
        ? "wav"
        : baseMimeType === "audio/mp4"
          ? "mp4"
          : baseMimeType === "audio/ogg"
            ? "ogg"
            : "webm";

    const form = new FormData();
    form.append("file", new Blob([bytes], { type: data.mimeType }), `blurt.${extension}`);
    form.append("model_id", "scribe_v2");
    form.append("language_code", data.languageCode);
    form.append("diarize", "true");
    form.append("tag_audio_events", "true");
    form.append("timestamps_granularity", "word");
    const keyterms = data.keyterms.map((term) => term.trim()).filter(Boolean).slice(0, 100);
    if (keyterms.length > 0) {
      // Bias the model towards the meeting's own jargon, acronyms and names.
      form.append("keyterms_prompt", keyterms.join(", "));
    }

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`Transcription error [${response.status}]: ${detail}`);
      const providerMessage = (() => {
        try {
          const parsed = JSON.parse(detail) as {
            detail?: { message?: string } | string;
            error?: { message?: string };
            message?: string;
          };
          if (typeof parsed.detail === "string") return parsed.detail;
          return parsed.detail?.message ?? parsed.error?.message ?? parsed.message;
        } catch {
          return undefined;
        }
      })();
      return {
        ok: false,
        reason: "failed",
        message: providerMessage || "That clip didn't come through. Please try speaking again.",
      };
    }

    const body = (await response.json()) as { text?: string; words?: ScribeWord[] };
    const { turns, events } = buildTurns(body.words ?? []);
    return { ok: true, text: (body.text ?? "").trim(), turns, events };
  });


const VOICE_ID = "6Qg2hzCqEpqk0bR3ckiw";

export type SpeakResult =
  | { ok: true; audio: string }
  | { ok: false; reason: "not_connected" | "failed"; message: string };

export const speakAsSherlock = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => speakSchema.parse(input))
  .handler(async ({ data }): Promise<SpeakResult> => {
    const apiKey = process.env["ELEVENLABS_API_KEY"];
    if (!apiKey) {
      return {
        ok: false,
        reason: "not_connected",
        message: "Sherlock's voice isn't connected yet, so he's writing instead of speaking.",
      };
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: data.text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.75,
            style: 0.35,
            use_speaker_boost: true,
            speed: 1,
          },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`ElevenLabs error [${response.status}]: ${detail}`);
      return {
        ok: false,
        reason: "failed",
        message: "Sherlock lost his voice for a moment — his words are on screen instead.",
      };
    }

    const buffer = await response.arrayBuffer();
    return { ok: true, audio: Buffer.from(buffer).toString("base64") };
  });

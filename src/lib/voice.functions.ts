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

/** Gemini expects ISO-639-1 ("en"); the UI pins ISO-639-3 ("eng"). */
function toGeminiLanguage(code: string): string {
  const iso3ToIso1: Record<string, string> = {
    eng: "en", spa: "es", fra: "fr", deu: "de", ita: "it", por: "pt",
    nld: "nl", pol: "pl", rus: "ru", jpn: "ja", kor: "ko", zho: "zh",
    ara: "ar", hin: "hi", tur: "tr", vie: "vi", tha: "th", swe: "sv",
  };
  const normalized = code.trim().toLowerCase();
  return iso3ToIso1[normalized] ?? normalized.slice(0, 2);
}

/* Stock phrases transcribers produce when a clip holds no real speech. Kept out
   of the transcript so silence never turns into words the student never said. */
const INVENTED_LINES = [
  "thank you",
  "thank you.",
  "thanks for watching",
  "thank you for watching",
  "subtitles by the amara.org community",
  "please subscribe",
  "you",
  "bye",
  "okay",
  "mm-hmm",
  "[music]",
  "[silence]",
  "[inaudible]",
  "(silence)",
];

/** Blanks a transcript that is only filler the model invented from quiet audio. */
function dropInventedText(text: string): string {
  const bare = text.toLowerCase().replace(/[.,!?"'\u2019]/g, "").trim();
  if (!bare) return "";
  if (INVENTED_LINES.includes(bare)) return "";
  // A one-word clip is almost always a guess rather than a heard word.
  if (bare.split(/\s+/).length < 2 && bare.length < 4) return "";
  return text;
}

/**
 * Transcribes a clip of the student's voice with Gemini 3.5 Transcribe
 * through the Lovable AI Gateway, with the language pinned (never auto-detect)
 * and optional keyterm context biasing the model's spelling.
 * The API key never leaves the server.
 */
export const transcribeSpeech = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => listenSchema.parse(input))
  .handler(async ({ data }): Promise<ListenResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
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

    const keyterms = data.keyterms.map((term) => term.trim()).filter(Boolean).slice(0, 100);

    const form = new FormData();
    form.append("file", new Blob([bytes], { type: data.mimeType }), `blurt.${extension}`);
    form.append("model", "google/gemini-3.5-transcribe");
    // Pin the language explicitly — never rely on auto-detection.
    form.append("language", toGeminiLanguage(data.languageCode));
    // Tell the model to write only what it actually heard. Without this it fills
    // unclear or near-silent audio with plausible-sounding invented sentences.
    form.append(
      "prompt",
      [
        "Transcribe the spoken English word for word, exactly as heard.",
        "Do not guess, complete, correct, paraphrase or add any words that were not clearly spoken.",
        "If the audio is silence, background noise, or unintelligible, return an empty transcript.",
        keyterms.length > 0
          ? `Expected vocabulary and terminology: ${keyterms.join(", ")}.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    );

    const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: form,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`Transcription error [${response.status}]: ${detail}`);
      const providerMessage = (() => {
        try {
          const parsed = JSON.parse(detail) as { error?: { message?: string }; message?: string };
          return parsed.error?.message ?? parsed.message;
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

    const body = (await response.json()) as { text?: string };
    const text = dropInventedText((body.text ?? "").trim());
    // Gemini returns a plain transcript without diarization or word timings:
    // wrap it in a single turn so the transcript view still renders.
    const turns: TranscriptTurn[] = text ? [{ speaker: "speaker_0", start: 0, end: 0, text }] : [];
    return { ok: true, text, turns, events: [] };
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
          model_id: "eleven_turbo_v2_5",
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

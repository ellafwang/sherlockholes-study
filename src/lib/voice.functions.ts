import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const speakSchema = z.object({ text: z.string().min(1).max(4000) });

const listenSchema = z.object({
  audio: z.string().min(16),
  mimeType: z
    .enum(["audio/webm", "audio/webm;codecs=opus", "audio/mp4", "audio/ogg", "audio/ogg;codecs=opus"])
    .default("audio/webm"),
});

export type ListenResult =
  | { ok: true; text: string }
  | { ok: false; reason: "not_connected" | "failed"; message: string };

/** Transcribes a short clip of the student's voice with ElevenLabs Scribe. */
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
      baseMimeType === "audio/mp4" ? "mp4" : baseMimeType === "audio/ogg" ? "ogg" : "webm";
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: data.mimeType }), "blurt.webm");
    form.set("file", new Blob([bytes], { type: data.mimeType }), `blurt.${extension}`);
    form.append("model_id", "scribe_v2");
    form.append("tag_audio_events", "false");
    form.append("diarize", "false");

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`ElevenLabs STT error [${response.status}]: ${detail}`);
      const providerMessage = (() => {
        try {
          const parsed = JSON.parse(detail) as { detail?: { message?: string }; message?: string };
          return parsed.detail?.message ?? parsed.message;
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
    return { ok: true, text: (body.text ?? "").trim() };
  });

// George — a measured, British-sounding narrator voice for Sherlock.
const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

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

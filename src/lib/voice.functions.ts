import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const speakSchema = z.object({ text: z.string().min(1).max(4000) });

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

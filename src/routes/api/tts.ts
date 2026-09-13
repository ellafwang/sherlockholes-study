import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const VOICE_ID = "6Qg2hzCqEpqk0bR3ckiw";

const bodySchema = z.object({ text: z.string().min(1).max(4000) });

/**
 * Streams Sherlock's voice from the ElevenLabs streaming endpoint straight
 * through to the browser, so playback starts on the first audio chunk while
 * the rest of the sentence is still being generated. The API key stays
 * server-side.
 */
export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["ELEVENLABS_API_KEY"];
        if (!apiKey) {
          return Response.json(
            { error: "Sherlock's voice isn't connected yet." },
            { status: 503 },
          );
        }

        let text: string;
        try {
          text = bodySchema.parse(await request.json()).text;
        } catch {
          return Response.json({ error: "Missing text to speak." }, { status: 400 });
        }

        const upstream = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              text,
              // turbo is ElevenLabs' low-latency model: first audio bytes
              // arrive almost immediately instead of after a full render
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

        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          console.error(`ElevenLabs stream error [${upstream.status}]: ${detail}`);
          return Response.json(
            { error: "Sherlock lost his voice for a moment." },
            { status: 502 },
          );
        }

        return new Response(upstream.body, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});

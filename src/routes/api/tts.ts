import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const VOICE_ID = "6Qg2hzCqEpqk0bR3ckiw";
const speechSchema = z.object({ text: z.string().min(1).max(4000) });

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["ELEVENLABS_API_KEY"];
        if (!apiKey) {
          return Response.json(
            { message: "Sherlock's voice isn't connected yet." },
            { status: 503 },
          );
        }

        const parsed = speechSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ message: "There is nothing for Sherlock to say." }, { status: 400 });
        }

        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream?output_format=mp3_44100_128&optimize_streaming_latency=3`,
          {
            method: "POST",
            headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              text: parsed.data.text,
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

        if (!response.ok || !response.body) {
          const detail = await response.text().catch(() => "");
          console.error(`ElevenLabs streaming error [${response.status}]: ${detail}`);
          return Response.json(
            { message: "Sherlock lost his voice for a moment." },
            { status: response.ok ? 502 : response.status },
          );
        }

        return new Response(response.body, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});

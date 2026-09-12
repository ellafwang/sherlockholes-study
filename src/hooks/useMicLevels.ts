import { useCallback, useEffect, useRef, useState } from "react";

const BARS = 28;

/**
 * Opens the microphone and reports a rolling set of loudness values so the
 * recorder can draw a live waveform of the student's voice.
 */
export function useMicLevels(active: boolean) {
  const [levels, setLevels] = useState<number[]>(() => new Array(BARS).fill(0));
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const barsRef = useRef<number[]>(new Array(BARS).fill(0));

  const teardown = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close().catch(() => undefined);
    contextRef.current = null;
    barsRef.current = new Array(BARS).fill(0);
    setLevels(barsRef.current);
  }, []);

  useEffect(() => {
    if (!active) {
      teardown();
      return;
    }
    let cancelled = false;

    const run = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        const context = new Ctor();
        contextRef.current = context;
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(stream).connect(analyser);
        const buffer = new Uint8Array(analyser.fftSize);

        const tick = () => {
          analyser.getByteTimeDomainData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i += 1) {
            const value = ((buffer[i] ?? 128) - 128) / 128;
            sum += value * value;
          }
          const rms = Math.sqrt(sum / buffer.length);
          const level = Math.min(1, rms * 4);
          barsRef.current = [...barsRef.current.slice(1), level];
          setLevels(barsRef.current);
          frameRef.current = requestAnimationFrame(tick);
        };
        frameRef.current = requestAnimationFrame(tick);
      } catch {
        /* mic blocked — the waveform simply stays flat */
      }
    };

    void run();
    return () => {
      cancelled = true;
      teardown();
    };
  }, [active, teardown]);

  return levels;
}

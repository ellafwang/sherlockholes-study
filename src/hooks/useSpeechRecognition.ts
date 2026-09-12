import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import { transcribeSpeech, type TranscriptTurn } from "@/lib/voice.functions";

/* Clips are cut at natural pauses instead of on a fixed drumbeat: a very short
   clip gives the transcriber half-words to guess from, which is what makes it
   invent words. We check often, but only send once a sentence has finished. */
const TICK_MS = 250;
/** Never send a clip shorter than this — too little speech to transcribe safely. */
const MIN_CLIP_SECONDS = 1.6;
/** Send as soon as the speaker has been quiet this long (end of a sentence). */
const SILENCE_SECONDS = 0.7;
/** Send anyway after this much continuous speech, so long answers still stream. */
const MAX_CLIP_SECONDS = 12;
/** Loudness below this counts as silence rather than speech. */
const VOICE_RMS = 0.012;
const WAVEFORM_BARS = 28;

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: { isFinal: boolean; 0: { transcript: string } };
  };
};

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

async function toBase64(blob: Blob): Promise<string> {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onerror = () => reject(new Error("Could not read the recording."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function encodeWav(chunks: Float32Array[], inputRate: number): Blob {
  const outputRate = 16_000;
  const inputLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const input = new Float32Array(inputLength);
  let offset = 0;
  for (const chunk of chunks) {
    input.set(chunk, offset);
    offset += chunk.length;
  }

  const ratio = inputRate / outputRate;
  const outputLength = Math.max(0, Math.floor(input.length / ratio));
  const samples = new Int16Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += input[j] ?? 0;
    const sample = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    samples[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  const buffer = new ArrayBuffer(44 + samples.byteLength);
  const view = new DataView(buffer);
  const write = (at: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(at + i, value.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.byteLength, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, outputRate, true);
  view.setUint32(28, outputRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.byteLength, true);
  new Int16Array(buffer, 44).set(samples);
  return new Blob([buffer], { type: "audio/wav" });
}

export type SpeechOptions = {
  /** ISO-639-3 code pinned for transcription, e.g. "eng". */
  languageCode?: string;
  /** Jargon, acronyms and names that bias spelling. */
  keyterms?: string[];
};

export type SpeechState = {
  supported: boolean;
  listening: boolean;
  /** Speech confirmed by the transcriber, appended over the whole session. */
  finalText: string;
  /** Words still being recognised right now. */
  interimText: string;
  /** True while the student's voice is actually coming through. */
  speaking: boolean;
  transcribing: boolean;
  levels: number[];
  /** Diarized speaker turns with timestamps, in order. */
  turns: TranscriptTurn[];
  /** Non-speech events (laughter, applause) detected in the audio. */
  events: string[];
  error: string | null;
  start: () => void;
  /** Stops recording, waits for the final clip, and returns all unconsumed speech. */
  stop: () => Promise<string>;
  reset: () => void;
  /** Returns everything captured since the last call, and marks it consumed. */
  drain: () => string;
};

/**
 * Captures the student's voice. Clips are recorded from the microphone and
 * transcribed server-side in English only, which works in every browser.
 * The browser's own recogniser, when present, only supplies live captions
 * while a clip is still being spoken.
 */
export function useSpeechRecognition(options: SpeechOptions = {}): SpeechState {
  const transcribe = useServerFn(transcribeSpeech);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => new Array(WAVEFORM_BARS).fill(0));
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wantsListeningRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmRef = useRef<Float32Array[]>([]);
  const cycleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const consumedRef = useRef(0);
  const finalRef = useRef("");
  const speakingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTranscriptionsRef = useRef<Promise<void>>(Promise.resolve());
  /** Seconds of audio already sent, used to place each clip on one timeline. */
  const elapsedAudioRef = useRef(0);
  /** Seconds of audio waiting in the buffer, and how much of it held a voice. */
  const bufferedSecondsRef = useRef(0);
  const voicedSecondsRef = useRef(0);
  const silenceSecondsRef = useRef(0);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        !!(window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) &&
        !!navigator.mediaDevices?.getUserMedia,
    );
  }, []);

  const markSpeaking = useCallback(() => {
    setSpeaking(true);
    if (speakingTimer.current) clearTimeout(speakingTimer.current);
    speakingTimer.current = setTimeout(() => setSpeaking(false), 1200);
  }, []);

  const sendClip = useCallback(
    (blob: Blob, mimeType: string, offsetSeconds = 0) => {
      if (blob.size < 4000) return; // near-silence or an empty container
      setTranscribing(true);
      pendingTranscriptionsRef.current = pendingTranscriptionsRef.current
        .then(async () => {
          const audio = await toBase64(blob);
          const result = await transcribe({
            data: {
              audio,
              mimeType: mimeType || "audio/webm",
              languageCode: optionsRef.current.languageCode ?? "eng",
              keyterms: optionsRef.current.keyterms ?? [],
            },
          });
          if (!result.ok) {
            setError(result.message);
            return;
          }
          const text = result.text.trim();
          if (result.events.length > 0) {
            setEvents((current) => [...current, ...result.events].slice(-20));
          }
          if (result.turns.length > 0) {
            const shifted = result.turns.map((turn) => ({
              ...turn,
              start: turn.start + offsetSeconds,
              end: turn.end + offsetSeconds,
            }));
            setTurns((current) => {
              const merged = [...current];
              for (const turn of shifted) {
                const last = merged[merged.length - 1];
                if (last && last.speaker === turn.speaker) {
                  merged[merged.length - 1] = {
                    ...last,
                    text: `${last.text} ${turn.text}`.trim(),
                    end: turn.end,
                  };
                } else {
                  merged.push(turn);
                }
              }
              return merged;
            });
          }
          if (!text) return;
          setError(null);
          finalRef.current = `${finalRef.current}${text} `;
          setFinalText(finalRef.current);
          setInterimText("");
          markSpeaking();
        })
        .catch((cause) => {
          console.error(cause);
          setError("Transcription hiccuped. Please try speaking again, or type your explanation.");
        })
        .finally(() => {
          setTranscribing(false);
        });
    },
    [markSpeaking, transcribe],
  );

  const flushPcm = useCallback(() => {
    const context = audioContextRef.current;
    const chunks = pcmRef.current;
    pcmRef.current = [];
    bufferedSecondsRef.current = 0;
    silenceSecondsRef.current = 0;
    voicedSecondsRef.current = 0;
    if (!context || chunks.length === 0) return;
    // Skip clips that hold no voice at all, so silence never costs a round trip.
    let energy = 0;
    let count = 0;
    for (const chunk of chunks) {
      for (let i = 0; i < chunk.length; i += 1) {
        energy += (chunk[i] ?? 0) ** 2;
        count += 1;
      }
    }
    const duration = count / context.sampleRate;
    const offset = elapsedAudioRef.current;
    elapsedAudioRef.current += duration;
    // Too short, or too quiet, means guesswork for the transcriber — drop it.
    if (count === 0 || duration < 0.5 || Math.sqrt(energy / count) < 0.008) return;
    const blob = encodeWav(chunks, context.sampleRate);
    if (blob.size >= 2_048) sendClip(blob, "audio/wav", offset);
  }, [sendClip]);

  /** Cuts the clip at a natural pause instead of mid-word. */
  const scheduleFlush = useCallback(() => {
    if (!wantsListeningRef.current) return;
    cycleTimer.current = setTimeout(() => {
      const buffered = bufferedSecondsRef.current;
      const voiced = voicedSecondsRef.current;
      const silence = silenceSecondsRef.current;
      const finishedSentence =
        buffered >= MIN_CLIP_SECONDS && voiced >= 0.4 && silence >= SILENCE_SECONDS;
      if (finishedSentence || buffered >= MAX_CLIP_SECONDS) {
        flushPcm();
      } else if (buffered >= MIN_CLIP_SECONDS && voiced < 0.2) {
        // Nothing but room noise so far: throw it away rather than transcribe it.
        pcmRef.current = [];
        bufferedSecondsRef.current = 0;
        silenceSecondsRef.current = 0;
        voicedSecondsRef.current = 0;
      }
      scheduleFlush();
    }, TICK_MS);
  }, [flushPcm]);

  const startCaptions = useCallback(() => {
    const instance = getRecognition();
    if (!instance) return;
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = "en-US";
    instance.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result && !result.isFinal) interim += result[0].transcript;
      }
      if (interim) {
        setInterimText(interim);
        markSpeaking();
      }
    };
    instance.onerror = () => undefined;
    instance.onend = () => {
      if (!wantsListeningRef.current) return;
      try {
        instance.start();
      } catch {
        /* the browser recogniser is optional */
      }
    };
    recognitionRef.current = instance;
    try {
      instance.start();
    } catch {
      /* optional */
    }
  }, [markSpeaking]);

  const teardown = useCallback((): Promise<void> => {
    wantsListeningRef.current = false;
    if (cycleTimer.current) clearTimeout(cycleTimer.current);
    cycleTimer.current = null;
    flushPcm();
    processorRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        /* already stopped */
      }
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context) void context.close().catch(() => undefined);
    setInterimText("");
    setSpeaking(false);
    setLevels(new Array(WAVEFORM_BARS).fill(0));
    return pendingTranscriptionsRef.current;
  }, [flushPcm]);

  const start = useCallback(() => {
    if (wantsListeningRef.current) return;
    setError(null);
    wantsListeningRef.current = true;
    setListening(true);
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000,
          },
        });
        if (!wantsListeningRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) throw new Error("Audio recording is not supported in this browser.");
        const context = new Ctor();
        await context.resume();
        const source = context.createMediaStreamSource(stream);
        const processor = context.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (event) => {
          const samples = new Float32Array(event.inputBuffer.getChannelData(0));
          pcmRef.current.push(samples);
          let energy = 0;
          for (let i = 0; i < samples.length; i += 1) energy += (samples[i] ?? 0) ** 2;
          const rms = Math.sqrt(energy / samples.length);
          const chunkSeconds = samples.length / context.sampleRate;
          bufferedSecondsRef.current += chunkSeconds;
          if (rms >= VOICE_RMS) {
            voicedSecondsRef.current += chunkSeconds;
            silenceSecondsRef.current = 0;
          } else {
            silenceSecondsRef.current += chunkSeconds;
          }
          const level = Math.min(1, rms * 4);
          setLevels((current) => [...current.slice(1), level]);
          if (level > 0.048) markSpeaking();
        };
        source.connect(processor);
        processor.connect(context.destination);
        audioContextRef.current = context;
        sourceRef.current = source;
        processorRef.current = processor;
        scheduleFlush();
        startCaptions();
      } catch (cause) {
        console.error(cause);
        wantsListeningRef.current = false;
        setListening(false);
        setError("Microphone access was blocked. Allow the mic, or type your explanation instead.");
      }
    })();
  }, [markSpeaking, scheduleFlush, startCaptions]);

  const stop = useCallback(async () => {
    await teardown();
    setListening(false);
    const fresh = finalRef.current.slice(consumedRef.current);
    return fresh.trim();
  }, [teardown]);

  const reset = useCallback(() => {
    finalRef.current = "";
    consumedRef.current = 0;
    elapsedAudioRef.current = 0;
    setFinalText("");
    setInterimText("");
    setTurns([]);
    setEvents([]);
  }, []);

  const drain = useCallback(() => {
    const fresh = finalRef.current.slice(consumedRef.current);
    consumedRef.current = finalRef.current.length;
    return fresh.trim();
  }, []);

  useEffect(
    () => () => {
      void teardown();
      if (speakingTimer.current) clearTimeout(speakingTimer.current);
    },
    [teardown],
  );

  return {
    supported,
    listening,
    finalText,
    interimText,
    speaking,
    transcribing,
    levels,
    turns,
    events,
    error,
    start,
    stop,
    reset,
    drain,
  };
}

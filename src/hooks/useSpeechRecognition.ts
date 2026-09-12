import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import { transcribeSpeech } from "@/lib/voice.functions";

/* How long each recorded clip is before it is sent off for transcription. */
const CLIP_MS = 4500;

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

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
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

export type SpeechState = {
  supported: boolean;
  listening: boolean;
  /** Speech confirmed by the transcriber, appended over the whole session. */
  finalText: string;
  /** Words still being recognised right now. */
  interimText: string;
  /** True while the student's voice is actually coming through. */
  speaking: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
  /** Returns everything captured since the last call, and marks it consumed. */
  drain: () => string;
};

/**
 * Captures the student's voice. Clips are recorded from the microphone and
 * transcribed server-side (ElevenLabs Scribe), which works in every browser.
 * The browser's own recogniser, when present, only supplies live captions
 * while a clip is still being spoken.
 */
export function useSpeechRecognition(): SpeechState {
  const transcribe = useServerFn(transcribeSpeech);

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wantsListeningRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const cycleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const consumedRef = useRef(0);
  const finalRef = useRef("");
  const speakingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        typeof MediaRecorder !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia,
    );
  }, []);

  const markSpeaking = useCallback(() => {
    setSpeaking(true);
    if (speakingTimer.current) clearTimeout(speakingTimer.current);
    speakingTimer.current = setTimeout(() => setSpeaking(false), 1200);
  }, []);

  const sendClip = useCallback(
    async (blob: Blob, mimeType: string) => {
      if (blob.size < 4000) return; // near-silence or an empty container
      try {
        const audio = await toBase64(blob);
        const result = await transcribe({ data: { audio, mimeType: mimeType || "audio/webm" } });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        const text = result.text.trim();
        if (!text) return;
        setError(null);
        finalRef.current = `${finalRef.current}${text} `;
        setFinalText(finalRef.current);
        setInterimText("");
        markSpeaking();
      } catch (cause) {
        console.error(cause);
        setError("Transcription hiccuped. Keep talking, or type your explanation instead.");
      }
    },
    [markSpeaking, transcribe],
  );

  /* Records back-to-back standalone clips so each one can be transcribed on its own. */
  const runCycle = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !wantsListeningRef.current) return;
    const mimeType = pickMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recorderRef.current = recorder;
    const parts: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) parts.push(event.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || mimeType || "audio/webm";
      if (parts.length > 0) void sendClip(new Blob(parts, { type }), type);
      if (wantsListeningRef.current) runCycle();
    };
    recorder.start();
    cycleTimer.current = setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, CLIP_MS);
  }, [sendClip]);

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

  const teardown = useCallback(() => {
    wantsListeningRef.current = false;
    if (cycleTimer.current) clearTimeout(cycleTimer.current);
    cycleTimer.current = null;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* already stopped */
      }
    }
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
    setInterimText("");
    setSpeaking(false);
  }, []);

  const start = useCallback(() => {
    if (wantsListeningRef.current) return;
    setError(null);
    wantsListeningRef.current = true;
    setListening(true);
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (!wantsListeningRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        runCycle();
        startCaptions();
      } catch (cause) {
        console.error(cause);
        wantsListeningRef.current = false;
        setListening(false);
        setError("Microphone access was blocked. Allow the mic, or type your explanation instead.");
      }
    })();
  }, [runCycle, startCaptions]);

  const stop = useCallback(() => {
    teardown();
    setListening(false);
  }, [teardown]);

  const reset = useCallback(() => {
    finalRef.current = "";
    consumedRef.current = 0;
    setFinalText("");
    setInterimText("");
  }, []);

  const drain = useCallback(() => {
    const fresh = finalRef.current.slice(consumedRef.current);
    consumedRef.current = finalRef.current.length;
    return fresh.trim();
  }, []);

  useEffect(
    () => () => {
      teardown();
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
    error,
    start,
    stop,
    reset,
    drain,
  };
}

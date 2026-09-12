import { useCallback, useEffect, useRef, useState } from "react";

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

export type SpeechState = {
  supported: boolean;
  listening: boolean;
  /** Speech confirmed by the recogniser, appended over the whole session. */
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

export function useSpeechRecognition(): SpeechState {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantsListeningRef = useRef(false);
  const consumedRef = useRef(0);
  const finalRef = useRef("");
  const speakingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const instance = getRecognition();
    if (!instance) {
      setSupported(false);
      return;
    }
    setSupported(true);
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = "en-US";

    instance.onresult = (event) => {
      let interim = "";
      let added = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        const text = result[0].transcript;
        if (result.isFinal) added += text;
        else interim += text;
      }
      if (added) {
        finalRef.current = `${finalRef.current}${added} `;
        setFinalText(finalRef.current);
      }
      setInterimText(interim);
      setSpeaking(true);
      if (speakingTimer.current) clearTimeout(speakingTimer.current);
      speakingTimer.current = setTimeout(() => setSpeaking(false), 900);
    };

    instance.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed") {
        setError("Microphone access was blocked. Allow the mic, or type your explanation instead.");
        wantsListeningRef.current = false;
        setListening(false);
        return;
      }
      setError("The microphone dropped out. You can restart it or type instead.");
    };

    instance.onend = () => {
      if (wantsListeningRef.current) {
        try {
          instance.start();
        } catch {
          setListening(false);
        }
      } else {
        setListening(false);
      }
    };

    recognitionRef.current = instance;
    return () => {
      wantsListeningRef.current = false;
      instance.onresult = null;
      instance.onerror = null;
      instance.onend = null;
      try {
        instance.abort();
      } catch {
        /* already stopped */
      }
      if (speakingTimer.current) clearTimeout(speakingTimer.current);
    };
  }, []);

  const start = useCallback(() => {
    const instance = recognitionRef.current;
    if (!instance) return;
    setError(null);
    wantsListeningRef.current = true;
    try {
      instance.start();
      setListening(true);
    } catch {
      setListening(true);
    }
  }, []);

  const stop = useCallback(() => {
    const instance = recognitionRef.current;
    wantsListeningRef.current = false;
    setListening(false);
    setSpeaking(false);
    try {
      instance?.stop();
    } catch {
      /* already stopped */
    }
  }, []);

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

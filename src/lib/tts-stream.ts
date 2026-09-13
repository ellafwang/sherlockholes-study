/**
 * Progressive playback for the /api/tts stream: audio chunks are appended to
 * a MediaSource as they arrive over the network, so the first word plays
 * while the rest of the sentence is still streaming. Falls back to buffered
 * blob playback where MediaSource can't handle MP3 (e.g. Safari).
 */

export type StreamSpeechHandlers = {
  /** Fires when the speaker actually starts making sound. */
  onStart?: () => void;
  /** Fires when playback reaches the end of the stream. */
  onEnd?: () => void;
  /** Fires on network, decode, or autoplay errors. */
  onError?: (error: Error) => void;
};

export type StreamSpeechHandle = {
  /** Resolves when playback finishes, errors out, or is stopped. */
  done: Promise<void>;
  /** Aborts the network stream and silences playback immediately. */
  stop: () => void;
};

export function streamSpeech(
  text: string,
  audio: HTMLAudioElement,
  handlers: StreamSpeechHandlers = {},
): StreamSpeechHandle {
  const controller = new AbortController();
  let resolveDone!: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  let stopped = false;
  let playRequested = false;

  const finish = () => {
    if (!stopped) handlers.onEnd?.();
    resolveDone();
  };
  const fail = (error: Error) => {
    if (!stopped) handlers.onError?.(error);
    resolveDone();
  };

  const requestPlay = () => {
    if (playRequested || stopped) return;
    playRequested = true;
    audio
      .play()
      .then(() => {
        if (!stopped) handlers.onStart?.();
      })
      .catch((error: Error) => fail(error));
  };

  const stop = () => {
    stopped = true;
    controller.abort();
    audio.onended = null;
    try {
      audio.pause();
    } catch {
      /* element may not be playing yet */
    }
    resolveDone();
  };

  void (async () => {
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Voice stream failed [${response.status}]: ${detail}`);
      }

      const canStreamMp3 =
        typeof MediaSource !== "undefined" && MediaSource.isTypeSupported("audio/mpeg");

      if (!canStreamMp3) {
        // Fallback: wait for the whole clip, then play it as a blob.
        const blob = await response.blob();
        if (stopped) return;
        const url = URL.createObjectURL(blob);
        audio.src = url;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          finish();
        };
        requestPlay();
        return;
      }

      const mediaSource = new MediaSource();
      const url = URL.createObjectURL(mediaSource);
      audio.src = url;
      await new Promise<void>((resolve, reject) => {
        mediaSource.addEventListener("sourceopen", () => resolve(), { once: true });
        mediaSource.addEventListener("error", () => reject(new Error("MediaSource error")), {
          once: true,
        });
      });
      if (stopped) {
        URL.revokeObjectURL(url);
        return;
      }

      const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
      sourceBuffer.mode = "sequence";
      const pending: Uint8Array[] = [];
      let appending = false;
      let streamEnded = false;

      const pump = () => {
        if (appending) return;
        const next = pending.shift();
        if (!next) {
          if (streamEnded && mediaSource.readyState === "open") {
            mediaSource.endOfStream();
          }
          return;
        }
        appending = true;
        sourceBuffer.appendBuffer(next as unknown as BufferSource);
      };
      sourceBuffer.addEventListener("updateend", () => {
        appending = false;
        pump();
      });

      audio.onended = () => {
        URL.revokeObjectURL(url);
        finish();
      };

      const reader = response.body.getReader();
      let firstChunk = true;
      for (;;) {
        const { value, done: readerDone } = await reader.read();
        if (readerDone) break;
        if (value && value.length > 0) {
          pending.push(value);
          pump();
          if (firstChunk) {
            firstChunk = false;
            // The first bytes are buffered: start playing immediately while
            // the rest of the audio is still streaming in.
            requestPlay();
          }
        }
      }
      streamEnded = true;
      pump();
    } catch (error) {
      if (stopped || (error as Error).name === "AbortError") {
        resolveDone();
        return;
      }
      fail(error as Error);
    }
  })();

  return { done, stop };
}

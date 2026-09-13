let sharedAudioContext: AudioContext | null = null;

/** Shared playback context survives in-app navigation, so a sidebar click can unlock it. */
export function getSherlockAudioContext() {
  if (sharedAudioContext) return sharedAudioContext;
  if (typeof window === "undefined") return null;
  const AudioContextConstructor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  sharedAudioContext = new AudioContextConstructor();
  return sharedAudioContext;
}

export function unlockSherlockVoice() {
  const context = getSherlockAudioContext();
  if (context?.state === "suspended") void context.resume().catch(() => undefined);
}

/** Chrome/Edge can append ElevenLabs' chunked MP3 while the rest is still downloading. */
export function supportsStreamingSpeech() {
  return (
    typeof window !== "undefined" &&
    "MediaSource" in window &&
    MediaSource.isTypeSupported("audio/mpeg")
  );
}

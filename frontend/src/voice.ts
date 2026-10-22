// Dictation with the browser's own speech recognition. The exact words go into the
// request box for the buyer to check and edit; nothing rewrites them before the AI reads them.
export type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean; processLocally?: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};
export type RecognitionClass = {
  new (): Recognition;
  // Chrome's on-device recognition, where supported: audio stays on this computer.
  available?: (options: { langs: string[]; processLocally: boolean }) => Promise<string>;
};

export function recognitionClass(scope: Record<string, unknown> = globalThis as unknown as Record<string, unknown>): RecognitionClass | null {
  return (scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null) as RecognitionClass | null;
}

export function transcript(results: ArrayLike<ArrayLike<{ transcript: string }>>): string {
  return Array.from(results, result => result[0]?.transcript ?? '').join('').replace(/\s+/g, ' ').trim();
}

export async function onDevice(Recognizer: RecognitionClass, lang: string): Promise<boolean> {
  try {
    return typeof Recognizer.available === 'function' && await Recognizer.available({ langs: [lang], processLocally: true }) === 'available';
  } catch {
    return false;
  }
}

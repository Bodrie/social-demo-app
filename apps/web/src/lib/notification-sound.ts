/**
 * A short two-note blip made with the Web Audio API, so no audio file ships with the app.
 * Browsers only allow sound after the person interacted with the page; a refused play is
 * silently nothing.
 */
let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  context ??= new AudioContext();
  return context;
}

export function playMessageSound(): void {
  const audio = audioContext();
  if (!audio) return;
  const start = audio.currentTime;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.12, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
  gain.connect(audio.destination);
  for (const [frequency, at] of [
    [660, 0],
    [880, 0.12],
  ] as const) {
    const oscillator = audio.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start + at);
    oscillator.connect(gain);
    oscillator.start(start + at);
    oscillator.stop(start + 0.4);
  }
  if (audio.state === 'suspended') void audio.resume().catch(() => undefined);
}

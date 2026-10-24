// Local cues do not depend on a TTS network request. Unlock on the Start click.
export function createCoverTestCues() {
  let context;
  return {
    unlock() {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      context ||= new AudioContext();
      context.resume().catch(() => {});
    },
    play(kind) {
      if (!context || context.state !== 'running') return;
      const count = kind === 'complete' ? 3 : kind === 'uncover' ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime + i * 0.22;
        oscillator.frequency.value = kind === 'uncover' ? 880 : 660;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.12, start + 0.01);
        gain.gain.linearRampToValueAtTime(0, start + 0.15);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(start); oscillator.stop(start + 0.16);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      }
    },
    close() { context?.close().catch(() => {}); context = null; },
  };
}

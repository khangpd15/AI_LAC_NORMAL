// Local cues do not depend on a TTS network request. Unlock on the Start click.
export function createCoverTestCues() {
  let context;
  let generation = 0;
  const unlock = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return Promise.resolve(false);
      if (!context || context.state === 'closed') context = new AudioContext();
      return Promise.resolve(context.resume()).then(() => context?.state === 'running', () => false);
    } catch { return Promise.resolve(false); }
  };
  return {
    unlock,
    cancel() { generation++; },
    async play(kind) {
      const current = ++generation;
      if (!context || context.state !== 'running') {
        let timer;
        // Never emit a delayed "uncover" beep in the following phase.
        const ready = await Promise.race([unlock(), new Promise(resolve => {
          timer = setTimeout(() => resolve(false), 700);
        })]);
        clearTimeout(timer);
        if (!ready || current !== generation) return false;
      }
      const count = kind === 'complete' ? 3 : kind === 'uncover' ? 2 : 1;
      const freq = kind === 'uncover' ? 880 : kind === 'capture' ? 1046 : 660;
      const stopOffset = kind === 'capture' ? 0.14 : 0.26;
      for (let i = 0; i < count; i++) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime + i * 0.35;
        oscillator.frequency.value = freq;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
        gain.gain.linearRampToValueAtTime(0, start + (kind === 'capture' ? 0.12 : 0.25));
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(start); oscillator.stop(start + stopOffset);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      }
      return true;
    },
    close() { generation++; context?.close().catch(() => {}); context = null; },
  };
}

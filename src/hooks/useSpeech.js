import { useState, useCallback, useEffect } from 'react';
import audioService from '../services/audioService.js';
import { AUDIO_STATES } from '../constants/audioConfig.js';

export function useSpeech(defaultEnabled = false) {
  const [isEnabled, setIsEnabled] = useState(defaultEnabled);
  const [audioState, setAudioState] = useState(() => audioService.getSnapshot());

  useEffect(() => audioService.subscribe(setAudioState), []);

  const speak = useCallback((text) => {
    if (!isEnabled) return Promise.resolve(false);
    return audioService.speak(text);
  }, [isEnabled]);

  const cancel = useCallback(() => audioService.stop(), []);
  const pause = useCallback(() => audioService.pause(), []);
  const resume = useCallback(() => audioService.resume(), []);

  const toggleSound = useCallback(() => {
    setIsEnabled((enabled) => {
      if (enabled) audioService.stop();
      else audioService.unlock();
      return !enabled;
    });
  }, []);

  useEffect(() => () => audioService.stop(), []);

  return {
    isEnabled,
    isVoiceEnabled: isEnabled,
    toggleSound,
    speak,
    cancel,
    pause,
    resume,
    audioState: audioState.state,
    audioError: audioState.errorMessage,
    isSpeaking: audioState.state === AUDIO_STATES.SPEAKING,
    isSupported: audioState.supported,
  };
}

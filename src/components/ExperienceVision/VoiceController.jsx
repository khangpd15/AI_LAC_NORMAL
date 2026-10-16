import React, { useState, useEffect, useRef } from 'react';
import audioService from '../../services/audioService';

/**
 * VoiceController
 * Manages voice narration with strict voice-first lifecycle.
 * - Plays voice theory on stage change
 * - Fires onVoiceComplete() when done
 * - Provides subtle audio indicator & replay button
 */
export default function VoiceController({
  voiceText = '',
  playbackKey = null,
  isVoiceEnabled = true,
  onToggleVoice,
  onVoiceComplete,
  className = '',
}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const onVoiceCompleteRef = useRef(onVoiceComplete);

  useEffect(() => {
    onVoiceCompleteRef.current = onVoiceComplete;
  }, [onVoiceComplete]);

  const playbackRef = useRef(0);
  const [replayCount, setReplayCount] = useState(0);

  useEffect(() => {
    const playback = ++playbackRef.current;

    if (!voiceText || !isVoiceEnabled) {
      audioService.stop();
      setIsSpeaking(false);
      return;
    }

    const startPlayback = async () => {
      audioService.stop();
      setIsSpeaking(true);

      try {
        const completed = await audioService.speak(voiceText);
        if (playbackRef.current === playback) {
          setIsSpeaking(false);
          if (completed) onVoiceCompleteRef.current?.();
        }
      } catch (err) {
        console.warn('[VoiceController] Playback error or canceled:', err);
        if (playbackRef.current === playback) {
          setIsSpeaking(false);
        }
      }
    };

    startPlayback();

    return () => {
      playbackRef.current += 1;
      audioService.stop();
    };
  }, [voiceText, playbackKey, isVoiceEnabled, replayCount]);

  const handleReplay = () => {
    if (!voiceText || !isVoiceEnabled) return;
    setReplayCount((count) => count + 1);
  };

  return (
    <div className={`voice-hud-indicator ${isSpeaking ? 'speaking' : 'idle'} ${className}`}>
      <div className="voice-status-badge">
        {isSpeaking ? (
          <div className="voice-wave-bars" aria-label="Đang kể...">
            <span className="wave-bar b1" />
            <span className="wave-bar b2" />
            <span className="wave-bar b3" />
          </div>
        ) : (
          <span className="voice-idle-dot" />
        )}
        <span className="voice-status-text">
          {!isVoiceEnabled ? 'Đã tắt lời dẫn' : isSpeaking ? 'AI đang đọc lời dẫn…' : 'Lời dẫn hoàn tất'}
        </span>
      </div>

      <details className="stage-transcript"><summary>Đọc lời hướng dẫn</summary><p>{voiceText}</p></details>
      <div className="voice-actions-row">
        <button
          type="button"
          className="btn-voice-hud"
          onClick={handleReplay}
          disabled={!isVoiceEnabled || !voiceText}
          title="Nghe lại lời dẫn"
        >
          <span>🔄</span>
        </button>

        <button
          type="button"
          className="btn-voice-hud"
          onClick={onToggleVoice}
          title={isVoiceEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
        >
          <span>{isVoiceEnabled ? '🔊' : '🔇'}</span>
        </button>
      </div>
    </div>
  );
}

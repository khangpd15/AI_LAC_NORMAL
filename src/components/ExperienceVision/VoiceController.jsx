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

  const lastPlayedTextRef = useRef('');

  useEffect(() => {
    let cancelled = false;

    if (!voiceText || !isVoiceEnabled) {
      setIsSpeaking(false);
      return;
    }

    // Prevent immediate re-triggering of the exact same spoken text
    if (lastPlayedTextRef.current === voiceText && isSpeaking) {
      return;
    }
    lastPlayedTextRef.current = voiceText;

    const startPlayback = async () => {
      audioService.stop();
      setIsSpeaking(true);

      try {
        await audioService.speak(voiceText);
      } catch (err) {
        console.warn('[VoiceController] Playback error or canceled:', err);
      } finally {
        if (!cancelled) {
          setIsSpeaking(false);
          onVoiceCompleteRef.current?.();
        }
      }
    };

    startPlayback();

    return () => {
      cancelled = true;
      audioService.stop();
    };
  }, [voiceText, isVoiceEnabled]);

  const handleReplay = async () => {
    if (!voiceText || !isVoiceEnabled) return;
    audioService.stop();
    setIsSpeaking(true);
    try {
      await audioService.speak(voiceText);
    } catch (err) {
      console.warn('[VoiceController] Replay error:', err);
    } finally {
      setIsSpeaking(false);
      onVoiceCompleteRef.current?.();
    }
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
          {isSpeaking ? 'AI đang đọc lời dẫn…' : 'Lời dẫn hoàn tất'}
        </span>
      </div>

      <div className="voice-actions-row">
        <button
          type="button"
          className="btn-voice-hud"
          onClick={handleReplay}
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

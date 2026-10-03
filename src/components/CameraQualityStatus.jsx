import React, { useEffect, useMemo, useRef } from 'react';

const VOICE_COOLDOWN_MS = 1900;

function resolveStatus(quality) {
  const label = quality?.uiStatus || (quality?.isValid ? 'Ổn' : 'Đưa mặt vào giữa');
  const voice = quality?.voicePrompt || null;
  const tone = label === 'Ổn' ? 'ok' : label === 'Mắt chưa rõ' || label === 'Mở mắt' ? 'warn' : 'guide';
  return { label, voice, tone };
}

export default function CameraQualityStatus({
  quality,
  speak = null,
  voiceEnabled = false,
  active = true,
}) {
  const lastSpokenRef = useRef({ text: null, at: 0 });
  const status = useMemo(() => resolveStatus(quality), [quality]);

  useEffect(() => {
    if (!active || !voiceEnabled || !speak || !status.voice) return;
    const now = performance.now();
    const last = lastSpokenRef.current;
    if (last.text === status.voice && now - last.at < VOICE_COOLDOWN_MS) return;
    if (now - last.at < VOICE_COOLDOWN_MS) return;
    lastSpokenRef.current = { text: status.voice, at: now };
    speak(status.voice);
  }, [active, voiceEnabled, speak, status.voice]);

  if (!active || !quality) return null;

  return (
    <div className={`camera-quality-status ${status.tone}`} aria-live="polite">
      <span className="quality-status-dot" aria-hidden="true" />
      <span>{status.label}</span>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import audioService from '../../services/audioService.js';
import { AUDIO_MESSAGES, AUDIO_STATES } from '../../constants/audioConfig.js';

export default function AudioButton({ text, label = 'Nghe hướng dẫn', className = '', onActivate }) {
  const [snapshot, setSnapshot] = useState(() => audioService.getSnapshot());
  useEffect(() => audioService.subscribe(setSnapshot), []);
  const active = snapshot.state === AUDIO_STATES.SPEAKING || snapshot.state === AUDIO_STATES.PAUSED;
  const handleClick = () => { if (active) audioService.stop(); else { onActivate?.(); audioService.speak(text, { userGesture: true }); } };
  const buttonLabel = active ? 'Dừng đọc hướng dẫn' : snapshot.state === AUDIO_STATES.ERROR ? 'Thử đọc lại hướng dẫn' : label;
  return <div className="audio-button-wrap"><button type="button" className={`audio-button ${className}`} onClick={handleClick} aria-label={buttonLabel} aria-pressed={active}><span aria-hidden="true">{active ? '⏹' : '🔊'}</span><span>{active ? 'Dừng' : snapshot.state === AUDIO_STATES.ERROR ? 'Thử lại' : label}</span></button>{snapshot.state === AUDIO_STATES.ERROR && <p className="audio-friendly-error" role="status">{snapshot.errorMessage || AUDIO_MESSAGES.failed}</p>}</div>;
}

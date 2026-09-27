import React, { useEffect, useState } from 'react';
import audioService from '../../services/audioService.js';

export default function AudioDebugPanel() {
  const [snapshot, setSnapshot] = useState(() => audioService.getSnapshot());
  useEffect(() => audioService.subscribe(setSnapshot), []);
  if (!import.meta.env.DEV) return null;
  return <aside className="audio-debug-panel" aria-label="Audio development debug"><strong>Audio: {snapshot.supported ? 'SUPPORTED' : 'UNSUPPORTED'}</strong><span>Voice: {snapshot.voice ? `${snapshot.voice.name} / ${snapshot.voice.lang}` : 'loading/fallback'}</span><span>State: {snapshot.state}</span><span>Text: {snapshot.text || '--'}</span><span>Errors: {snapshot.errorCount}</span></aside>;
}

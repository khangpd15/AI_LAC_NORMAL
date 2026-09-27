import React, { useEffect, useState } from 'react';
import { downloadDatasetZip, getDatasetCounts, PARTICIPANT_IDENTITY_NOTICE, subscribeDatasetCounts } from '../../services/screeningDatasetService.js';

export default function ScreeningDatasetDebugPanel() {
  const [counts, setCounts] = useState(getDatasetCounts);
  useEffect(() => subscribeDatasetCounts(setCounts), []);
  if (!import.meta.env.DEV) return null;
  return <aside className="screening-dataset-debug-panel" aria-label="Screening dataset development panel" style={{ position: 'fixed', left: 12, bottom: 12, zIndex: 1000, display: 'grid', gap: 6, padding: 10, maxWidth: 420, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', fontSize: 12 }}>
    <strong>Dataset DEV</strong>
    <span>Total {counts.total} · Normal {counts.normal} · Attention {counts.attention} · Inconclusive {counts.inconclusive}</span>
    <small>{PARTICIPANT_IDENTITY_NOTICE}</small>
    <button type="button" disabled={!counts.total} onClick={() => downloadDatasetZip()}>Export Dataset ZIP</button>
  </aside>;
}

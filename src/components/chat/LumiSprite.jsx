import React from 'react';

// The source atlas has uneven gutters. Explicit viewports isolate each pose;
// dividing it into equal columns exposes the neighboring character's cape.
const frameBounds = {
  wave: [
    [0, 0, 396, 398], [396, 0, 396, 398], [792, 0, 408, 398],
    [1200, 0, 400, 398], [1600, 0, 383, 398],
  ],
  fly: [
    [0, 400, 392, 393], [392, 400, 380, 393], [772, 400, 403, 393],
    [1175, 400, 410, 393], [1585, 400, 398, 393],
  ],
};

export default function LumiSprite({ action = 'wave', still = false, className = '' }) {
  return <span className={`lumi-action-sprite ${className}`} data-action={action} data-still={still} aria-hidden="true">
    {(frameBounds[action] || frameBounds.wave).map((bounds, index) =>
      <svg key={`${action}-${index}`} className="lumi-sprite-frame" viewBox={bounds.join(' ')} preserveAspectRatio="xMidYMid meet" style={{ '--frame-index': index }}>
        <image href="/images/lumi-hello-flying.png" width="1983" height="793" />
      </svg>)}
  </span>;
}

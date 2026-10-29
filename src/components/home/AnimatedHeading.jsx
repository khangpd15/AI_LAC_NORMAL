import React, { useState } from 'react';
import { AudioIcon } from '../audio/ListeningExperience';
import './animatedHeading.css';

const phrases = ['Gần nhau hơn', 'Hiểu con hơn', 'Cùng chăm sóc'];

export default function AnimatedHeading() {
  const [paused, setPaused] = useState(false);

  return <>
    <h1 id="care-hero-title" className="animated-heading">
      Thấu hiểu đôi mắt<br />
      <span className="animated-heading-words" aria-hidden="true" data-paused={paused}>
        {phrases.map((phrase, index) => <em key={phrase} style={{ '--phrase-index': index }}>{phrase}</em>)}
      </span>
      {/* A stable heading keeps screen readers from announcing every rotation. */}
      <span className="sr-only">Gần nhau hơn, Hiểu con hơn, Cùng chăm sóc</span>
    </h1>
    <button type="button" className="heading-motion-toggle" aria-controls="care-hero-title" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
      <AudioIcon name={paused ? 'play' : 'pause'} width="16" height="16" />
      <span>{paused ? 'Tiếp tục chữ động' : 'Tạm dừng chữ động'}</span>
    </button>
  </>;
}

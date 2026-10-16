import React from 'react';
import AudioGuide, { AudioIcon } from '../audio/ListeningExperience';
import SitePhoto from '../common/SitePhoto';
import AnimatedHeading from './AnimatedHeading';

export default function HomeHero({ onStartExperience, onStartScreening }) {
  return <>
    <section className="care-hero" aria-labelledby="care-hero-title">
      <div className="care-hero-copy">
        <span className="section-eyebrow"><span className="care-status-dot" /> CHĂM SÓC MẮT · KẾT NỐI CẢ GIA ĐÌNH</span>
        <AnimatedHeading />
        <p>Một góc nhìn mới để hiểu con hơn. Cùng RemiCare khám phá, lắng nghe và chăm sóc đôi mắt — từng bước thật nhẹ nhàng.</p>
        <div className="care-hero-actions"><button className="care-primary" onClick={onStartExperience}>Khám phá trải nghiệm <span aria-hidden="true">↗</span></button><button className="care-secondary" onClick={onStartScreening}>Sàng lọc hai mắt <span aria-hidden="true">→</span></button></div>
        <div className="care-hero-note"><AudioIcon name="sound" width="20" height="20" /><span>Có Iris hướng dẫn bằng giọng nói, khi bạn cần.</span></div>
      </div>
      <div className="care-hero-art care-hero-photograph">
        <SitePhoto name="hero" hero />
        <div className="care-art-topline"><span>GÓC NHÌN NHỎ</span><span>THẤU HIỂU LỚN ↗</span></div>
        <div className="care-art-caption"><span className="care-art-spark">✳</span><div><strong>Mỗi đôi mắt, một thế giới.</strong><span>Cùng khám phá thế giới của nhau.</span></div></div>
      </div>
    </section>
    <div className="care-hero-listen"><div><span className="section-eyebrow">CHÀO BẠN, MÌNH LÀ IRIS</span><h2>Bạn nghe, mình hướng dẫn.</h2><p>Bắt đầu bằng một lời chào.<br />Dừng, nghe lại hoặc đọc theo cách của bạn.</p></div><AudioGuide guideId="home" compact /></div>
  </>;
}

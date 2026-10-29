import React, { useEffect, useState } from 'react';
import { sitePhotos } from '../../content/sitePhotos';
import './homeCampaign.css';

const scenes = [
  { photo: 'screening', label: 'SÀNG LỌC THỊ GIÁC HAI MẮT', title: 'Cùng con kiểm tra mắt\nBắt đầu từ sự quan tâm', text: 'Khám phá trải nghiệm sàng lọc qua camera, với lời hướng dẫn từng bước dành cho ba mẹ và bé.', position: '50% 45%' },
  { photo: 'campaignClinic', label: 'THẤU HIỂU LÁC LÉ & NHƯỢC THỊ', title: 'Hiểu cách con nhìn\nQuan tâm đôi mắt con', text: 'Trải nghiệm góc nhìn và các hướng lệch của mắt qua mô phỏng trực quan cùng RemiCare.', position: '50% 43%' },
  { photo: 'campaignFamily', label: 'BA MẸ ĐỒNG HÀNH CÙNG CON', title: 'Chăm sóc đôi mắt\nCùng con từng bước nhỏ', text: 'Cùng tìm hiểu về lác lé, nhược thị và cách chăm sóc mắt để ba mẹ thêm thấu hiểu con mỗi ngày.', position: '50% 43%' },
];

export default function HomeCampaign({ onStartExperience }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [element, setElement] = useState(null);
  const playing = !paused && !reducedMotion && visible;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReducedMotion(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setActive(value => (value + 1) % scenes.length), 6500);
    return () => clearTimeout(timer);
  }, [playing, active]);

  return <section ref={setElement} className="home-campaign" aria-label="Mỗi ánh nhìn, một thế giới" aria-roledescription="trình chiếu" data-playing={playing}>
    <div className="campaign-scenes">
      {scenes.map((scene, index) => <div key={scene.photo} className={`campaign-scene ${index === active ? 'is-active' : ''}`} aria-hidden={index !== active}>
        <img src={sitePhotos[scene.photo].src} alt="" loading="lazy" decoding="async" style={{ objectPosition: scene.position }} />
        <div className="campaign-copy">
          <span className="campaign-eyebrow">REMICARE · {scene.label}</span>
          <h2>{scene.title.split('\n').map((line, i) => <React.Fragment key={line}>{i > 0 && <br />}{line}</React.Fragment>)}</h2>
          <p>{scene.text}</p>
        </div>
      </div>)}
    </div>
    <div className="campaign-topline"><span>GÓC NHÌN NHỎ, THẤU HIỂU LỚN</span></div>
    <div className="campaign-bottom">
      <button type="button" className="campaign-cta" onClick={onStartExperience}>Thử nhìn qua đôi mắt con <span aria-hidden="true">↗</span></button>
      <div className="campaign-pagination" role="group" aria-label="Chọn hình ảnh">
        {scenes.map((scene, index) => <button type="button" key={scene.photo} aria-label={`Ảnh ${index + 1}: ${scene.label.toLowerCase()}`} aria-pressed={index === active} onClick={() => setActive(index)}><span key={`${active}-${playing}`} className={index === active ? 'is-active' : ''} /></button>)}
        <span className="campaign-counter" aria-hidden="true">0{active + 1} / 03</span>
        {!reducedMotion && <button type="button" className="campaign-pause" aria-label={paused ? 'Tiếp tục chuyển ảnh tự động' : 'Dừng chuyển ảnh tự động'} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? '▶' : 'Ⅱ'}</button>}
      </div>
    </div>
  </section>;
}

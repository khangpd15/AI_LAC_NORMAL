import React, { useState, useEffect } from 'react';
import audioService from '../../services/audioService';
import {
  SvgGradients,
  IconNavHome,
  IconNavEye,
  IconNavCamera,
  IconNavSimulation,
  IconSpeakerWave,
  IconDoorEye,
  IconDoorScanner,
  IconDoorCare,
  IconPlay,
  IconAiStepCamera,
  IconAiStepMesh,
  IconAiStepNeural,
  IconAiStepInsight,
  IconShieldCheck,
  IconNormalVision,
  IconLowVision,
  IconParentUnderstand,
  IconParentTrack,
  IconParentAccompany,
  IconHospital,
  IconSparkle,
} from './HomeIcons';
import './homePage.css';

/**
 * RemiCare Home / Landing Page
 * High-Tech • Visual First • Voice First • Dành cho mọi lứa tuổi (Trẻ em & Người lớn tuổi)
 * Nguyên tắc: “Nhìn hình hiểu liền – Nghe thay vì đọc – Chạm 1 phát là dùng”
 */
export default function HomePage({
  onStartExperience,
  onStartScreening,
}) {
  // Global Audio Guide state (Iris Voice)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [currentSpokenId, setCurrentSpokenId] = useState(null);

  // Active Story Comparison Toggle: 'normal' | 'amblyopia'
  const [storyMode, setStoryMode] = useState('normal');

  // Modals: 'care_modal' | null
  const [activeModal, setActiveModal] = useState(null);

  // AI Live Scanning Interactive simulation state
  const [isAiScanning, setIsAiScanning] = useState(true);

  // Eye visual mode: 'mascot' | 'biometric'
  const [eyeVisualMode, setEyeVisualMode] = useState('biometric');

  // Voice narration text mapping
  const voiceScripts = {
    welcome:
      'Xin chào! Mình là Iris. Mình sẽ hướng dẫn bạn từng bước nhé. Hãy chạm vào một trong ba cánh cửa lớn bên dưới để bắt đầu.',
    experience:
      'Hãy thử xem thế giới có thể trông như thế nào khi một bên mắt nhìn kém.',
    screening:
      'Mình sẽ hướng dẫn bạn thực hiện một bài sàng lọc thị giác hai mắt đơn giản cùng camera.',
    care:
      'Cùng tìm hiểu cách chăm sóc và bảo vệ đôi mắt mỗi ngày.',
    story:
      'Khi một mắt nhìn kém, hình ảnh sẽ bị mờ tối hoặc mất chiều sâu. Hãy chạm nút Bắt đầu để thử cảm nhận.',
    parent_understand:
      'Hiểu hơn: Giúp ba mẹ thấu hiểu cảm giác thực tế của con khi một mắt bị yếu.',
    parent_track:
      'Theo dõi: Giúp nhận biết sớm các dấu hiệu lác lé, nhược thị trước bảy tuổi.',
    parent_accompany:
      'Đồng hành: Biến việc chăm sóc mắt thành một trải nghiệm vui vẻ, không sợ hãi.',
    trust:
      'RemiCare không thay thế bác sĩ. Nếu bạn lo lắng về thị lực, hãy đến cơ sở chuyên khoa mắt để được kiểm tra.',
  };

  // Subscribe to audioService
  useEffect(() => {
    const unsubscribe = audioService.subscribe((snapshot) => {
      const active = snapshot.state === 'SPEAKING' || snapshot.state === 'PAUSED';
      setIsAudioPlaying(active);
      if (!active) {
        setCurrentSpokenId(null);
      }
    });

    return () => {
      unsubscribe();
      audioService.stop();
    };
  }, []);

  // Speak a designated script
  const playVoice = (id, text) => {
    if (isAudioPlaying && currentSpokenId === id) {
      audioService.stop();
      setCurrentSpokenId(null);
      return;
    }

    audioService.stop();
    setCurrentSpokenId(id);
    audioService.speak(text, { userGesture: true }).catch((err) => {
      console.warn('[HomePage] Voice speak error:', err);
      setCurrentSpokenId(null);
    });
  };

  // Tap hero giant button: speak welcome and scroll to 3 doors
  const handleHeroTouch = () => {
    playVoice('welcome', voiceScripts.welcome);
    const doorsSection = document.getElementById('three-doors-section');
    if (doorsSection) {
      doorsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="remicare-home-root">
      {/* Shared SVG gradients definition */}
      <SvgGradients />

      {/* ====================================================================
          1. NAVIGATION — CỰC KỲ ĐƠN GIẢN (CHỈ 4 MỤC RÕ RÀNG)
          ==================================================================== */}
      <header className="home-top-nav">
        <div className="home-top-nav-inner">
          {/* Brand Logo & Name (Official RemiCare Logo) */}
          <div
            className="home-nav-brand"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            role="button"
            tabIndex={0}
            aria-label="Về đầu trang RemiCare"
          >
            <img
              src="/images/logo.jpg"
              alt="Logo RemiCare"
              className="brand-official-logo"
            />
            <div className="brand-text-block">
              <span className="brand-main-title">RemiCare</span>
              <span className="brand-tagline">AI CHĂM SÓC MẮT</span>
            </div>
          </div>

          {/* Simple Main Nav Links */}
          <nav className="home-nav-links" aria-label="Điều hướng chính">
            <button
              type="button"
              className="nav-link-btn active"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <IconNavHome size={20} className="nav-icon-svg" />
              <span>Trang chủ</span>
            </button>

            <button
              type="button"
              className="nav-link-btn"
              onClick={onStartExperience}
            >
              <IconNavEye size={20} className="nav-icon-svg" />
              <span>Trải nghiệm</span>
            </button>

            <button
              type="button"
              className="nav-link-btn"
              onClick={onStartScreening}
            >
              <IconNavCamera size={20} className="nav-icon-svg" />
              <span>Sàng lọc</span>
            </button>

            <button
              type="button"
              className="nav-link-btn nav-btn-dev"
              disabled
              title="Tính năng đang hoàn thiện"
            >
              <IconNavSimulation size={18} className="nav-icon-svg" />
              <span>Mô phỏng lác lé</span>
              <span className="tag-dev">Đang làm</span>
            </button>
          </nav>

        </div>
      </header>

      <main className="home-main-scrollable">
        {/* ==================================================================
            2. HERO — INTERACTIVE EYE EXPERIENCE (TRUNG TÂM THỊ GIÁC)
            ================================================================== */}
        <section className="hero-eye-experience-section" aria-label="Khám phá đôi mắt">
          {/* Subtle Ambient Background Orbs */}
          <div className="hero-ambient-orb orb-left" aria-hidden="true" />
          <div className="hero-ambient-orb orb-right" aria-hidden="true" />

          <div className="hero-center-cluster">
            {/* Visual: Đôi mắt AI trung tâm với hiệu ứng vòng quét & nhịp thở */}
            <div
              className={`interactive-ai-eye-stage ${isAiScanning ? 'scanning-active' : ''}`}
              onClick={() => setIsAiScanning((s) => !s)}
              title="Chạm vào đôi mắt để quét AI"
              role="button"
              tabIndex={0}
            >
              {/* Outer Glowing Concentric Rings & HUD Reticle */}
              <div className="eye-pulse-ring ring-outer" />
              <div className="eye-pulse-ring ring-middle" />
              <div className="eye-pulse-ring ring-inner" />

              {/* HUD Target Marks */}
              <div className="hud-corner-bracket hb-tl" />
              <div className="hud-corner-bracket hb-tr" />
              <div className="hud-corner-bracket hb-bl" />
              <div className="hud-corner-bracket hb-br" />

              {/* Center Holographic Iris Biometric Visual */}
              <div className="eye-iris-sphere">
                {eyeVisualMode === 'biometric' ? (
                  <div className="biometric-iris-render">
                    <svg viewBox="0 0 200 200" className="biometric-eye-svg">
                      <circle cx="100" cy="100" r="90" fill="url(#rc-grad-mint)" fillOpacity="0.12" />
                      {/* Sclera & Iris Rings */}
                      <circle cx="100" cy="100" r="75" stroke="#00AB9B" strokeWidth="2.5" strokeDasharray="6 4" opacity="0.6" />
                      <circle cx="100" cy="100" r="60" fill="url(#rc-grad-teal)" />
                      {/* Iris pattern rays */}
                      <g stroke="#00FFEA" strokeWidth="1.5" opacity="0.5">
                        <line x1="100" y1="45" x2="100" y2="70" />
                        <line x1="100" y1="130" x2="100" y2="155" />
                        <line x1="45" y1="100" x2="70" y2="100" />
                        <line x1="130" y1="100" x2="155" y2="100" />
                        <line x1="61" y1="61" x2="78" y2="78" />
                        <line x1="139" y1="139" x2="122" y2="122" />
                        <line x1="61" y1="139" x2="78" y2="122" />
                        <line x1="139" y1="61" x2="122" y2="78" />
                      </g>
                      {/* Pupil */}
                      <circle cx="100" cy="100" r="28" fill="#123330" />
                      <circle cx="100" cy="100" r="16" fill="#08201E" />
                      {/* Specular corneal light reflection */}
                      <circle cx="112" cy="88" r="9" fill="#FFFFFF" fillOpacity="0.9" />
                      <circle cx="92" cy="112" r="3.5" fill="#FFFFFF" fillOpacity="0.6" />
                      {/* Biometric center tracking cross */}
                      <path d="M100 80V90M100 110V120M80 100H90M110 100H120" stroke="#00FFEA" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                ) : (
                  <img
                    src="/images/iris_mascot.jpg"
                    alt="Đôi mắt Iris AI RemiCare"
                    className="hero-eye-mascot-img"
                  />
                )}

                {/* Laser Scanning Line */}
                <div className="ai-laser-scanning-line" />

                {/* 6 AI Landmark Focus Dots */}
                <div className="landmark-point lp-1" />
                <div className="landmark-point lp-2" />
                <div className="landmark-point lp-3" />
                <div className="landmark-point lp-4" />
                <div className="landmark-point lp-5" />
                <div className="landmark-point lp-6" />
              </div>

              {/* Mode switch toggle & Live Badge */}
              <div className="ai-live-badge-hero">
                <span className="live-sparkle-dot" />
                <span>AI SÀNG LỌC THỊ GIÁC • SẴN SÀNG</span>
              </div>
            </div>

            {/* Toggle Mascot / Biometric Visual pill */}
            <div className="eye-view-switcher">
              <button
                type="button"
                className={`btn-subtle-switch ${eyeVisualMode === 'biometric' ? 'active' : ''}`}
                onClick={() => setEyeVisualMode('biometric')}
              >
                <span>Hologram AI</span>
              </button>
              <button
                type="button"
                className={`btn-subtle-switch ${eyeVisualMode === 'mascot' ? 'active' : ''}`}
                onClick={() => setEyeVisualMode('mascot')}
              >
                <span>Bé Iris</span>
              </button>
            </div>

            {/* Headline Siêu Ngắn, Dễ Đọc */}
            <h1 className="hero-super-title">
              Cùng con khám phá <br />
              <span className="text-mint-focus">đôi mắt sáng</span>
            </h1>

            <p className="hero-ultra-simple-sub">
              Nhìn hình ảnh • Nghe hướng dẫn • Chạm 1 phát là bắt đầu
            </p>

            {/* NÚT CỰC LỚN Ở GIỮA — "CHẠM ĐỂ BẮT ĐẦU" (>= 68px, Voice First) */}
            <div className="hero-giant-touch-wrapper">
              <button
                type="button"
                className="hero-giant-touch-btn pulse-glow-huge"
                onClick={handleHeroTouch}
                id="btn-hero-touch-start"
              >
                <div className="btn-speaker-icon-bubble">
                  <IconSpeakerWave size={26} isPlaying={isAudioPlaying && currentSpokenId === 'welcome'} />
                  {isAudioPlaying && currentSpokenId === 'welcome' && (
                    <span className="wave-ripple" />
                  )}
                </div>

                <div className="btn-touch-text-group">
                  <span className="touch-main-heading">CHẠM ĐỂ BẮT ĐẦU</span>
                  <span className="touch-sub-hint">Iris sẽ nói và hướng dẫn bạn</span>
                </div>

                <div className="btn-forward-arrow">
                  <IconPlay size={22} />
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* ==================================================================
            3. MAIN ACTION — 3 CÁNH CỬA LỚN (NHÌN HÌNH - CHẠM 1 PHÁT LÀ DÙNG)
            ================================================================== */}
        <section
          className="three-doors-section"
          id="three-doors-section"
          aria-label="Chọn trải nghiệm chính"
        >
          <div className="section-title-visual-strip">
            <div className="visual-pointer-pill">
              <IconSparkle size={18} />
              <span>CHỌN TRẢI NGHIỆM</span>
            </div>
            <h2 className="doors-section-heading">BẠN MUỐN LÀM GÌ HÔM NAY?</h2>
            <p className="doors-section-sub">Chạm vào một trong ba cánh cửa lớn bên dưới:</p>
          </div>

          <div className="three-doors-grid">
            {/* ---------------- CÁNH CỬA 01: TRẢI NGHIỆM ---------------- */}
            <div
              className="door-card door-experience"
              onClick={onStartExperience}
              role="button"
              tabIndex={0}
            >
              <div className="door-top-meta">
                <span className="door-number">01</span>
                <button
                  type="button"
                  className="btn-door-voice"
                  onClick={(e) => {
                    e.stopPropagation();
                    playVoice('experience', voiceScripts.experience);
                  }}
                  title="Nghe Iris giải thích"
                  aria-label="Nghe hướng dẫn Trải nghiệm"
                >
                  <IconSpeakerWave size={22} isPlaying={currentSpokenId === 'experience'} />
                </button>
              </div>

              <div className="door-illustration-box">
                <IconDoorEye size={88} className="door-svg-art" />
                <div className="door-glow-spot mint-glow" />
              </div>

              <div className="door-info">
                <h3 className="door-action-title">TRẢI NGHIỆM</h3>
                <p className="door-action-desc">
                  Thử xem thế giới trông như thế nào khi một bên mắt nhìn kém.
                </p>
              </div>

              <div className="door-giant-action-btn btn-mint-door">
                <IconPlay size={20} />
                <span className="action-label">BẮT ĐẦU</span>
              </div>
            </div>

            {/* ---------------- CÁNH CỬA 02: SÀNG LỌC ---------------- */}
            <div
              className="door-card door-screening"
              onClick={onStartScreening}
              role="button"
              tabIndex={0}
            >
              <div className="door-top-meta">
                <span className="door-number">02</span>
                <button
                  type="button"
                  className="btn-door-voice"
                  onClick={(e) => {
                    e.stopPropagation();
                    playVoice('screening', voiceScripts.screening);
                  }}
                  title="Nghe Iris giải thích"
                  aria-label="Nghe hướng dẫn Sàng lọc"
                >
                  <IconSpeakerWave size={22} isPlaying={currentSpokenId === 'screening'} />
                </button>
              </div>

              <div className="door-illustration-box">
                <IconDoorScanner size={88} className="door-svg-art" />
                <div className="door-glow-spot teal-glow" />
              </div>

              <div className="door-info">
                <h3 className="door-action-title">SÀNG LỌC</h3>
                <p className="door-action-desc">
                  Bài kiểm tra thị giác hai mắt đơn giản và nhẹ nhàng cùng camera.
                </p>
              </div>

              <div className="door-giant-action-btn btn-teal-door">
                <IconPlay size={20} />
                <span className="action-label">BẮT ĐẦU</span>
              </div>
            </div>

            {/* ---------------- CÁNH CỬA 03: CHĂM SÓC MẮT ---------------- */}
            <div
              className="door-card door-care"
              onClick={() => {
                setActiveModal('care_modal');
                playVoice('care', voiceScripts.care);
              }}
              role="button"
              tabIndex={0}
            >
              <div className="door-top-meta">
                <span className="door-number">03</span>
                <button
                  type="button"
                  className="btn-door-voice"
                  onClick={(e) => {
                    e.stopPropagation();
                    playVoice('care', voiceScripts.care);
                  }}
                  title="Nghe Iris giải thích"
                  aria-label="Nghe hướng dẫn Chăm sóc mắt"
                >
                  <IconSpeakerWave size={22} isPlaying={currentSpokenId === 'care'} />
                </button>
              </div>

              <div className="door-illustration-box">
                <IconDoorCare size={88} className="door-svg-art" />
                <div className="door-glow-spot coral-glow" />
              </div>

              <div className="door-info">
                <h3 className="door-action-title">CHĂM SÓC MẮT</h3>
                <p className="door-action-desc">
                  Bí quyết giữ mắt sáng khỏe mỗi ngày dành cho cả gia đình.
                </p>
              </div>

              <div className="door-giant-action-btn btn-coral-door">
                <IconPlay size={20} />
                <span className="action-label">XEM NGAY</span>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================
            4. SECTION — AI LIVE (CÔNG NGHỆ THỊ GIÁC AI)
            ================================================================== */}
        <section className="home-ai-live-section" aria-label="Công nghệ AI thị giác">
          <div className="ai-live-card">
            <div className="ai-live-header">
              <div className="ai-tag">
                <IconSparkle size={14} />
                <span>CÔNG NGHỆ THỊ GIÁC AI</span>
              </div>
              <h2 className="ai-heading">Cách AI phân tích chuyển động mắt</h2>
            </div>

            {/* Visual Pipeline 4 Bước Bằng Vector Icon & Sơ Đồ */}
            <div className="ai-steps-pipeline">
              <div className="ai-pipe-item">
                <div className="pipe-icon-circle">
                  <IconAiStepCamera size={34} />
                </div>
                <span className="pipe-step-num">BƯỚC 1</span>
                <span className="pipe-title">Mắt nhìn camera</span>
              </div>

              <div className="pipe-arrow-line">
                <div className="pulse-connection-bar" />
              </div>

              <div className="ai-pipe-item">
                <div className="pipe-icon-circle">
                  <IconAiStepMesh size={34} />
                </div>
                <span className="pipe-step-num">BƯỚC 2</span>
                <span className="pipe-title">468 Điểm mốc</span>
              </div>

              <div className="pipe-arrow-line">
                <div className="pulse-connection-bar" />
              </div>

              <div className="ai-pipe-item pipe-featured">
                <div className="pipe-icon-circle">
                  <IconAiStepNeural size={34} />
                </div>
                <span className="pipe-step-num">BƯỚC 3</span>
                <span className="pipe-title">AI xử lý</span>
              </div>

              <div className="pipe-arrow-line">
                <div className="pulse-connection-bar" />
              </div>

              <div className="ai-pipe-item">
                <div className="pipe-icon-circle">
                  <IconAiStepInsight size={34} />
                </div>
                <span className="pipe-step-num">BƯỚC 4</span>
                <span className="pipe-title">Hiểu thị giác</span>
              </div>
            </div>

            <div className="ai-safety-strip">
              <div className="safety-icon-wrap">
                <IconShieldCheck size={28} />
              </div>
              <p className="safety-text">
                <strong>AI hỗ trợ sàng lọc:</strong> Ảnh Hirschberg được gửi đến máy chủ để phân tích và không được lưu. Dữ liệu chuyển động mắt Cover Test được lưu cho bác sĩ đánh giá. Không thay thế chẩn đoán y khoa.
              </p>
            </div>
          </div>
        </section>

        {/* ==================================================================
            5. SECTION — STORYTELLING: “ĐÔI MẮT NHÌN THẾ GIỚI NHƯ THẾ NÀO?”
            ================================================================== */}
        <section className="home-story-visual-section" aria-label="So sánh thị giác">
          <div className="story-container-card">
            <div className="story-header-row">
              <div className="story-header-text">
                <span className="mini-tag-pill">THỊ GIÁC TRỰC QUAN</span>
                <h2 className="story-main-title">Đôi mắt nhìn thế giới như thế nào?</h2>
                <p className="story-short-sub">Chạm vào nút để xem sự khác biệt giữa hai góc nhìn:</p>
              </div>

              <button
                type="button"
                className="btn-story-audio-play"
                onClick={() => playVoice('story', voiceScripts.story)}
                title="Nghe Iris giải thích"
              >
                <IconSpeakerWave size={20} isPlaying={currentSpokenId === 'story'} />
                <span>{currentSpokenId === 'story' ? 'Dừng giọng đọc' : 'Nghe Iris nói'}</span>
              </button>
            </div>

            {/* 2 Nút Toggle Lớn */}
            <div className="story-toggle-doors">
              <button
                type="button"
                className={`btn-story-door ${storyMode === 'normal' ? 'selected' : ''}`}
                onClick={() => setStoryMode('normal')}
              >
                <div className="door-tab-icon">
                  <IconNormalVision size={36} />
                </div>
                <div className="door-tab-text">
                  <strong>Mắt bình thường</strong>
                  <small>Cảnh vật rõ nét, tươi sáng, đầy đủ chi tiết</small>
                </div>
              </button>

              <button
                type="button"
                className={`btn-story-door ${storyMode === 'amblyopia' ? 'selected' : ''}`}
                onClick={() => setStoryMode('amblyopia')}
              >
                <div className="door-tab-icon">
                  <IconLowVision size={36} />
                </div>
                <div className="door-tab-text">
                  <strong>Khi một mắt nhìn kém</strong>
                  <small>Hình ảnh bị mờ sương, giảm tương phản</small>
                </div>
              </button>
            </div>

            {/* Visual Image Display Box (Custom Vietnamese clean scenic image) */}
            <div className="story-visual-canvas">
              <div className={`story-img-wrapper mode-${storyMode}`}>
                <img
                  src="/images/vision_comparison_clean.jpg"
                  alt="So sánh mắt sáng rõ và mắt nhìn mờ"
                  className="story-visual-img"
                />

                <div className="visual-badge-overlay">
                  {storyMode === 'normal' ? (
                    <span className="badge-view-clear">
                      <IconNormalVision size={20} />
                      <span>Đang xem: Hai mắt nhìn rõ bình thường</span>
                    </span>
                  ) : (
                    <span className="badge-view-dim">
                      <IconLowVision size={20} />
                      <span>Đang xem: Mô phỏng mắt nhìn kém / nhược thị</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Big CTA to directly try experience */}
              <div className="story-direct-cta">
                <button
                  type="button"
                  className="btn-try-experience-now pulse-glow-mid"
                  onClick={onStartExperience}
                >
                  <IconPlay size={22} />
                  <span>THỬ TRẢI NGHIỆM NGAY</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================
            6. SECTION — DÀNH CHO PHỤ HUYNH (3 VISUAL TOUCHPOINTS + AUDIO)
            ================================================================== */}
        <section className="home-parents-visual-section" aria-label="Dành cho phụ huynh">
          <div className="section-title-visual-strip">
            <div className="visual-pointer-pill">
              <IconSparkle size={18} />
              <span>DÀNH CHO BA MẸ</span>
            </div>
            <h2 className="doors-section-heading">CÙNG CON CHĂM SÓC ĐÔI MẮT TỪ SỚM</h2>
            <p className="doors-section-sub">Chạm vào từng hình để nghe Iris chia sẻ:</p>
          </div>

          <div className="parent-three-cards-grid">
            {/* Card 1: HIỂU */}
            <div
              className={`parent-touch-card ${currentSpokenId === 'parent_understand' ? 'playing' : ''}`}
              onClick={() => playVoice('parent_understand', voiceScripts.parent_understand)}
              role="button"
              tabIndex={0}
            >
              <div className="card-huge-icon">
                <IconParentUnderstand size={56} />
              </div>
              <h3 className="card-touch-title">HIỂU</h3>
              <p className="card-touch-desc">
                Cảm nhận thế giới qua góc nhìn thực tế của con khi mắt nhìn kém.
              </p>
              <div className="btn-touch-voice-pill">
                <IconSpeakerWave size={18} isPlaying={currentSpokenId === 'parent_understand'} />
                <span>{currentSpokenId === 'parent_understand' ? 'Dừng' : 'Chạm để nghe'}</span>
              </div>
            </div>

            {/* Card 2: THEO DÕI */}
            <div
              className={`parent-touch-card ${currentSpokenId === 'parent_track' ? 'playing' : ''}`}
              onClick={() => playVoice('parent_track', voiceScripts.parent_track)}
              role="button"
              tabIndex={0}
            >
              <div className="card-huge-icon">
                <IconParentTrack size={56} />
              </div>
              <h3 className="card-touch-title">THEO DÕI</h3>
              <p className="card-touch-desc">
                Sớm nhận biết dấu hiệu lác lé, nhược thị trong giai đoạn vàng trước 7 tuổi.
              </p>
              <div className="btn-touch-voice-pill">
                <IconSpeakerWave size={18} isPlaying={currentSpokenId === 'parent_track'} />
                <span>{currentSpokenId === 'parent_track' ? 'Dừng' : 'Chạm để nghe'}</span>
              </div>
            </div>

            {/* Card 3: ĐỒNG HÀNH */}
            <div
              className={`parent-touch-card ${currentSpokenId === 'parent_accompany' ? 'playing' : ''}`}
              onClick={() => playVoice('parent_accompany', voiceScripts.parent_accompany)}
              role="button"
              tabIndex={0}
            >
              <div className="card-huge-icon">
                <IconParentAccompany size={56} />
              </div>
              <h3 className="card-touch-title">ĐỒNG HÀNH</h3>
              <p className="card-touch-desc">
                Biến việc kiểm tra mắt thành một trò chơi vui vẻ, thân thiện cùng con.
              </p>
              <div className="btn-touch-voice-pill">
                <IconSpeakerWave size={18} isPlaying={currentSpokenId === 'parent_accompany'} />
                <span>{currentSpokenId === 'parent_accompany' ? 'Dừng' : 'Chạm để nghe'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================
            7. TRUST & MEDICAL TRANSPARENCY
            ================================================================== */}
        <section className="home-trust-simple-section">
          <div
            className="trust-pill-box"
            onClick={() => playVoice('trust', voiceScripts.trust)}
            role="button"
            tabIndex={0}
            title="Chạm để nghe lưu ý y khoa"
          >
            <div className="trust-hospital-badge">
              <IconHospital size={44} />
            </div>
            <div className="trust-info-block">
              <h4 className="trust-main-text">RemiCare hỗ trợ trải nghiệm và sàng lọc thị giác</h4>
              <p className="trust-sub-text">
                Không thay thế bác sĩ y khoa. Nếu bạn lo lắng về thị lực của mình hoặc của con, hãy đến bệnh viện chuyên khoa mắt để được thăm khám chính xác.
              </p>
            </div>
            <button type="button" className="btn-trust-speaker" aria-label="Nghe lưu ý y tế">
              <IconSpeakerWave size={22} isPlaying={currentSpokenId === 'trust'} />
            </button>
          </div>
        </section>

        {/* ==================================================================
            8. FINAL ULTRA-LARGE CTA
            ================================================================== */}
        <section className="home-final-cta-visual">
          <div className="final-box-inner">
            <div className="final-eyes-icon">
              <IconDoorEye size={64} />
            </div>
            <h2 className="final-title-text">Sẵn sàng khám phá đôi mắt của con?</h2>

            <button
              type="button"
              className="btn-final-huge-action pulse-glow-huge"
              onClick={onStartExperience}
              id="btn-final-large-start"
            >
              <span>BẮT ĐẦU TRẢI NGHIỆM</span>
              <span className="arrow-chip">
                <IconPlay size={20} />
              </span>
            </button>
          </div>
        </section>
      </main>

      {/* ====================================================================
          9. FOOTER TỐI GIẢN
          ==================================================================== */}
      <footer className="home-simple-footer">
        <div className="footer-inner-content">
          <div className="footer-left-brand">
            <img
              src="/images/logo.jpg"
              alt="Logo RemiCare"
              className="footer-official-logo"
            />
            <strong>RemiCare AI</strong>
            <span> • Hiểu đôi mắt • Cùng con lớn khôn</span>
          </div>
          <div className="footer-right-note">
            <IconShieldCheck size={18} />
            <span>100% Cục bộ trên trình duyệt • Bảo mật & Riêng tư</span>
          </div>
        </div>
      </footer>

      {/* ====================================================================
          10. FIXED AUDIO GUIDE BUTTON (GÓC DƯỚI BÊN PHẢI — TỐI THIỂU 68x68px)
          ==================================================================== */}
      <div className="fixed-audio-guide-dock">
        <button
          type="button"
          className={`btn-fixed-floating-audio ${isAudioPlaying ? 'audio-is-active' : ''}`}
          onClick={() => playVoice('welcome', voiceScripts.welcome)}
          aria-label={isAudioPlaying ? 'Dừng hướng dẫn giọng nói' : 'Bật hướng dẫn giọng nói'}
          title={isAudioPlaying ? 'Bấm để dừng' : 'Bấm để Iris nói'}
        >
          <div className="floating-sound-icon">
            <IconSpeakerWave size={30} isPlaying={isAudioPlaying} />
          </div>

          {isAudioPlaying && (
            <div className="floating-voice-wave" aria-hidden="true">
              <span className="v-bar vb-1" />
              <span className="v-bar vb-2" />
              <span className="v-bar vb-3" />
            </div>
          )}

          <span className="floating-audio-tooltip">
            {isAudioPlaying ? 'Iris đang nói...' : 'Nghe Iris hướng dẫn'}
          </span>
        </button>
      </div>

      {/* ====================================================================
          11. MODAL: CHĂM SÓC MẮT (KNOWLEDGE / EYE CARE MODAL)
          ==================================================================== */}
      {activeModal === 'care_modal' && (
        <div className="modal-backdrop-visual fade-in" onClick={() => setActiveModal(null)}>
          <div className="modal-sheet-card fade-in-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-sheet-header">
              <div className="sheet-header-title">
                <IconDoorCare size={44} />
                <div>
                  <h3>Chăm sóc đôi mắt bé</h3>
                  <small>Những thói quen vàng ba mẹ nên nhớ</small>
                </div>
              </div>
              <button
                type="button"
                className="btn-sheet-close"
                onClick={() => {
                  audioService.stop();
                  setActiveModal(null);
                }}
              >
                ✕
              </button>
            </div>

            <div className="modal-sheet-body">
              <div className="care-tip-item">
                <div className="tip-badge-icon">20</div>
                <div className="tip-content">
                  <h4>Quy tắc 20 - 20 - 20</h4>
                  <p>Cứ sau 20 phút nhìn màn hình hoặc học tập, cho mắt nhìn xa 6 mét trong 20 giây để điều tiết thư giãn.</p>
                </div>
              </div>

              <div className="care-tip-item">
                <div className="tip-badge-icon">☀️</div>
                <div className="tip-content">
                  <h4>Đủ ánh sáng tự nhiên</h4>
                  <p>Khuyến khích bé vui chơi ngoài trời từ 1-2 tiếng mỗi ngày giúp giảm đáng kể nguy cơ cận thị tiến triển.</p>
                </div>
              </div>

              <div className="care-tip-item">
                <div className="tip-badge-icon">🥕</div>
                <div className="tip-content">
                  <h4>Dinh dưỡng giàu Vitamin A</h4>
                  <p>Bổ sung cà rốt, trứng, cá hồi và rau xanh thẫm để nuôi dưỡng võng mạc và thị lực tinh anh.</p>
                </div>
              </div>
            </div>

            <div className="modal-sheet-footer">
              <button
                type="button"
                className="btn-sheet-action"
                onClick={() => {
                  audioService.stop();
                  setActiveModal(null);
                }}
              >
                ĐÃ HIỂU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

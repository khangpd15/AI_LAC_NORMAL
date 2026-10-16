import React, { useState, useEffect } from 'react';
import audioService from '../../services/audioService';
import {
  SvgGradients,
  IconSpeakerWave,
  IconDoorCare,
  IconPlay,
  IconNormalVision,
  IconLowVision,
  IconParentUnderstand,
  IconParentTrack,
  IconParentAccompany,
  IconHospital,
  IconSparkle,
} from './HomeIcons';
import AppNavbar from '../common/AppNavbar';
import AppFooter from '../common/AppFooter';
import './homePage.css';
import HomeHero from './HomeHero';
import HomeCampaign from './HomeCampaign';
import { HomeListeningSection } from '../audio/ListeningExperience';

/**
 * RemiCare Home / Landing Page
 * High-Tech • Visual First • Voice First • Dành cho mọi lứa tuổi (Trẻ em & Người lớn tuổi)
 * Nguyên tắc: “Nhìn hình hiểu liền – Nghe thay vì đọc – Chạm 1 phát là dùng”
 */
export default function HomePage({
  onStartExperience,
  onStartScreening,
  onStartSimulation,
  onOpenAbout,
}) {
  // Global Audio Guide state (Iris Voice)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [currentSpokenId, setCurrentSpokenId] = useState(null);

  // Active Story Comparison Toggle: 'normal' | 'amblyopia'
  const [storyMode, setStoryMode] = useState('normal');

  // Modals: 'care_modal' | null
  const [activeModal, setActiveModal] = useState(null);

  // AI Live Scanning Interactive simulation state


  // Eye visual mode: 'mascot' | 'biometric'


  // Voice narration text mapping
  const voiceScripts = {
    welcome:
      'Xin chào! Mình là Iris. Mình sẽ hướng dẫn bạn từng bước nhé. Bạn có thể khám phá góc nhìn của con, nghe bài hướng dẫn hoặc chọn trải nghiệm trên thanh điều hướng để bắt đầu.',
    experience:
      'Hãy thử xem thế giới có thể trông như thế nào khi một bên mắt nhìn kém.',
    simulation:
      'Mô phỏng mắt lác lé bằng AI Webcam: Bật camera, AI quét mắt và bạn có thể xem mắt trực tiếp biến thành lác trong, lác ngoài, lác trên hoặc lác dưới ngay lập tức.',
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

  return (
    <div className="remicare-home-root">
      {/* Shared SVG gradients definition */}
      <SvgGradients />

      {/* ====================================================================
          1. NAVIGATION — CỰC KỲ ĐƠN GIẢN (CHỈ 4 MỤC RÕ RÀNG)
          ==================================================================== */}
      {/* 1. UNIFIED MASTER APPLICATION NAVBAR */}
      <AppNavbar
        activeTab="home"
        onSelectTab={(tab) => {
          if (tab === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
          else if (tab === 'experience') onStartExperience();
          else if (tab === 'simulation') onStartSimulation();
          else if (tab === 'screening') onStartScreening();
          else if (tab === 'about') onOpenAbout();
        }}
        onNavigateHome={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />

      <main className="home-main-scrollable">
        {/* ==================================================================
            2. HERO — INTERACTIVE EYE EXPERIENCE (TRUNG TÂM THỊ GIÁC)
            ================================================================== */}
        <HomeHero onStartExperience={onStartExperience} onStartScreening={onStartScreening} />

        <HomeCampaign onStartExperience={onStartExperience} />
        <HomeListeningSection />

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

            {/* Use the same real photograph for both views to isolate the visual effect. */}
            <div className="story-visual-canvas">
              <div className={`story-img-wrapper mode-${storyMode}`}>
                <img
                  src="/images/listen-rest.webp"
                  alt="Ảnh chụp ánh nắng xuyên qua tán cây, dùng để so sánh góc nhìn rõ và góc nhìn mờ"
                  width="960"
                  height="600"
                  loading="lazy"
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
              onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.currentTarget.click(); } }}
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
              onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.currentTarget.click(); } }}
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
              onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.currentTarget.click(); } }}
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
              onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.currentTarget.click(); } }}
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

      </main>

      {/* ====================================================================
          9. CHÂN TRANG ĐẦY ĐỦ (MASTER COMPREHENSIVE FOOTER)
          ==================================================================== */}
      <AppFooter
        onNavigateHome={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onStartExperience={onStartExperience}
        onStartScreening={onStartScreening}
        onStartSimulation={onStartSimulation}
        onOpenAbout={onOpenAbout}
        onOpenCareModal={() => setActiveModal('care_modal')}
      />

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

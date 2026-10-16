import React, { useState, useEffect } from 'react';
import audioService from '../../services/audioService';
import './appFooter.css';

/**
 * REMICARE AI — COMPREHENSIVE MEDICAL & COMMUNITY FOOTER
 * 
 * Sáng tạo dựa trên cấu trúc thông tin nhãn khoa hiện đại (tham chiếu Visi/Orcax),
 * giữ trọn bản sắc RemiCare AI:
 * - Dải kết nối tương tác cộng đồng (Interactive Community CTA Ribbon)
 * - Hệ thống 4 cột sinh thái: Thương hiệu • Điều hướng • Công nghệ Y sinh • Mạng lưới Nhãn khoa & Khuyến cáo
 * - Trợ lý giọng nói Iris thân thiện hỗ trợ mọi lứa tuổi (Trẻ nhỏ đến Người cao tuổi)
 * - Nút cuộn mượt mà lên đầu trang (Back to top)
 */
export default function AppFooter({
  onNavigateHome,
  onStartExperience,
  onStartScreening,
  onStartSimulation,
  onOpenAbout,
  onOpenCareModal,
}) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    const unsubscribe = audioService.subscribe((snapshot) => {
      const active = snapshot.state === 'SPEAKING' || snapshot.state === 'PAUSED';
      setIsSpeaking(active);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavHome = () => {
    if (onNavigateHome) {
      onNavigateHome();
    }
    scrollToTop();
  };

  const scrollToHospitals = () => {
    const el = document.getElementById('footer-hospital-network');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const toggleIrisVoice = () => {
    if (isSpeaking) {
      audioService.stop();
      return;
    }

    const script =
      'Xin chào bạn! Mình là Iris. RemiCare AI là nền tảng ứng dụng thị giác máy tính và trí tuệ nhân tạo, hỗ trợ sàng lọc phát hiện sớm dấu hiệu mắt lác lé và nhược thị cho trẻ nhỏ ngay tại nhà. Mọi thao tác quét hình ảnh đều diễn ra hoàn toàn trên thiết bị của bạn, bảo mật tuyệt đối và phi lợi nhuận vì cộng đồng.';

    audioService.speak(script, { userGesture: true }).catch((err) => {
      console.warn('[AppFooter] Audio speak error:', err);
    });
  };

  return (
    <footer className="remicare-master-footer" role="contentinfo" aria-label="Chân trang RemiCare AI">
      {/* ====================================================================
          1. TOP INTERACTIVE COMMUNITY & ACTION RIBBON (LẤY CẢM HỨNG SÁNG TẠO TỪ VISI)
          ==================================================================== */}
      <div className="footer-cta-ribbon-wrap" aria-label="Khung kết nối cộng đồng RemiCare">
        <div className="footer-cta-ribbon-inner">
          <div className="footer-cta-text-side">
            <span className="footer-cta-tag">✨ VÌ ÁNH MẮT TRẺ THƠ VIỆT NAM</span>
            <h3 className="footer-cta-heading">
              Cùng RemiCare bảo vệ <span className="footer-cta-heading-mark">ánh mắt sáng</span> cho thế hệ tương lai
            </h3>
            <p className="footer-cta-subtext">
              Nền tảng ứng dụng thị giác máy tính AI nhận diện sớm nguy cơ lác lé và nhược thị trong giai đoạn vàng trước 7 tuổi.
              Dễ sử dụng cho cả trẻ nhỏ, phụ huynh và người cao tuổi.
            </p>
          </div>

          <div className="footer-cta-chips-grid">
            <button
              type="button"
              className="footer-cta-chip-btn chip-highlight"
              onClick={toggleIrisVoice}
              title="Nghe Bé Iris đọc tóm tắt chân trang và hướng dẫn"
              aria-label="Hỏi Bé Iris"
            >
              <span className="chip-icon">💬</span>
              <span>{isSpeaking ? 'Dừng giọng đọc' : 'Hỏi Bé Iris'}</span>
            </button>

            <button
              type="button"
              className="footer-cta-chip-btn"
              onClick={onStartSimulation}
              title="Trải nghiệm bộ lọc Mô phỏng Lác Lé AI trên webcam"
              aria-label="Thử Mô Phỏng Lác Lé"
            >
              <span className="chip-icon">🎭</span>
              <span>Thử Mô Phỏng</span>
            </button>

            {onOpenCareModal && (
              <button
                type="button"
                className="footer-cta-chip-btn"
                onClick={onOpenCareModal}
                title="Mở Cẩm nang chăm sóc mắt trẻ thơ"
                aria-label="Cẩm nang Mắt bé"
              >
                <span className="chip-icon">📘</span>
                <span>Cẩm nang Mắt bé</span>
              </button>
            )}

            <button
              type="button"
              className="footer-cta-chip-btn"
              onClick={scrollToHospitals}
              title="Xem mạng lưới cơ sở nhãn khoa tham chiếu"
              aria-label="Mạng lưới Nhãn khoa"
            >
              <span className="chip-icon">🏥</span>
              <span>Mạng lưới Nhãn khoa</span>
            </button>
          </div>
        </div>
      </div>

      {/* ====================================================================
          2. MAIN 4-COLUMN ECOSYSTEM GRID
          ==================================================================== */}
      <div className="footer-main-container">
        <div className="footer-grid-layout">
          {/* Column 1: Brand, Slogan & Trust Badges */}
          <div className="footer-brand-col">
            <div
              className="footer-brand-header"
              onClick={handleNavHome}
              role="button"
              tabIndex={0}
              title="Về Trang chủ RemiCare"
            >
              <img
                src="/images/logo.jpg"
                alt="Logo RemiCare AI"
                className="footer-brand-logo-img"
              />
              <div className="footer-brand-titles">
                <span className="footer-brand-title-main">RemiCare AI</span>
                <span className="footer-brand-title-sub">AI CHĂM SÓC MẮT CỘNG ĐỒNG</span>
              </div>
            </div>

            <p className="footer-brand-desc">
              Hệ sinh thái ứng dụng thị giác máy tính và trí tuệ nhân tạo hỗ trợ cha mẹ, thầy cô
              phát hiện sớm các dấu hiệu lác lé, nhược thị ở trẻ em trong "giai đoạn vàng" trước 7 tuổi.
              Hoàn toàn miễn phí, bảo mật và thiết kế thân thiện cho mọi thế hệ.
            </p>

            <div className="footer-badges-cluster">
              <div className="footer-trust-pill">
                <span className="trust-pill-icon">🔒</span>
                <span>Ảnh Hirschberg được gửi đến AI khi bạn xác nhận phân tích</span>
              </div>
              <div className="footer-trust-pill">
                <span className="trust-pill-icon">💎</span>
                <span>Dự án cộng đồng phi lợi nhuận • Truy cập mở trọn đời</span>
              </div>
            </div>
          </div>

          {/* Column 2: Quick Navigation Links */}
          <div className="footer-nav-col">
            <h4 className="footer-col-title">Khám Phá & Sàng Lọc</h4>
            <ul className="footer-links-list">
              <li>
                <button
                  type="button"
                  className="footer-link-btn"
                  onClick={handleNavHome}
                >
                  <span className="footer-link-dot" aria-hidden="true" />
                  <span>Trang chủ</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-link-btn"
                  onClick={onStartExperience}
                >
                  <span className="footer-link-dot" aria-hidden="true" />
                  <span>Trải nghiệm góc nhìn mắt</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-link-btn"
                  onClick={onStartScreening}
                >
                  <span className="footer-link-dot" aria-hidden="true" />
                  <span>Sàng lọc thị lực hai mắt</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-link-btn"
                  onClick={onStartSimulation}
                >
                  <span className="footer-link-dot" aria-hidden="true" />
                  <span>Mô phỏng lác lé AI</span>
                  <span className="footer-badge-new">Webcam</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-link-btn"
                  onClick={onOpenAbout}
                >
                  <span className="footer-link-dot" aria-hidden="true" />
                  <span>Giới thiệu sứ mệnh & công nghệ</span>
                </button>
              </li>
              {onOpenCareModal && (
                <li>
                  <button
                    type="button"
                    className="footer-link-btn"
                    onClick={onOpenCareModal}
                  >
                    <span className="footer-link-dot" aria-hidden="true" />
                    <span>Cẩm nang chăm sóc mắt trẻ thơ</span>
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Column 3: Technologies & Clinical Principles */}
          <div className="footer-tech-col">
            <h4 className="footer-col-title">Công Nghệ & Khoa Học</h4>
            <ul className="footer-tech-list">
              <li className="footer-tech-item">
                <span className="tech-item-dot-icon">💡</span>
                <div className="tech-item-text">
                  <span className="tech-item-name">Phép Thử Hirschberg</span>
                  <span className="tech-item-desc">Định vị đồng tử, mống mắt và phản quang để hỗ trợ sàng lọc.</span>
                </div>
              </li>
              <li className="footer-tech-item">
                <span className="tech-item-dot-icon">🎯</span>
                <div className="tech-item-text">
                  <span className="tech-item-name">MediaPipe FaceMesh 468</span>
                  <span className="tech-item-desc">Theo dõi tâm con ngươi & bờ mi theo thời gian thực 60 FPS.</span>
                </div>
              </li>
              <li className="footer-tech-item">
                <span className="tech-item-dot-icon">⏱️</span>
                <div className="tech-item-text">
                  <span className="tech-item-name">Digital Cover Test</span>
                  <span className="tech-item-desc">Phát hiện lác ẩn qua phản xạ đảo mắt bù trừ định thị.</span>
                </div>
              </li>
              <li className="footer-tech-item">
                <span className="tech-item-dot-icon">🎭</span>
                <div className="tech-item-text">
                  <span className="tech-item-name">Tái Tạo Sinh Học 3D</span>
                  <span className="tech-item-desc">Mô phỏng tròng trắng, bóng mi và khóe mắt như giải phẫu người thật.</span>
                </div>
              </li>
            </ul>
          </div>

          {/* Column 4: Ophthalmology Network & Medical Disclaimers */}
          <div className="footer-support-col">
            <h4 className="footer-col-title">Mạng Lưới & Khuyến Cáo</h4>

            {/* Reference Hospital Network Card */}
            <div className="footer-hospitals-card" id="footer-hospital-network">
              <div className="hospitals-card-header">
                <span aria-hidden="true">🏥</span>
                <span>Cơ sở Nhãn khoa Tham chiếu</span>
              </div>
              <ul className="hospitals-network-list">
                <li>
                  <span className="hosp-dot">●</span>
                  <span><strong>Bệnh viện Mắt VISI</strong> (Hệ thống kỹ thuật tham chiếu)</span>
                </li>
                <li>
                  <span className="hosp-dot">●</span>
                  <span><strong>BV Mắt Sài Gòn Đà Lạt</strong> (Chỉnh quang chuyên sâu)</span>
                </li>
                <li>
                  <span className="hosp-dot">●</span>
                  <span><strong>BV Mắt Sông Tiền</strong> (Nhãn nhi & Khúc xạ Tây Nam Bộ)</span>
                </li>
                <li>
                  <span className="hosp-dot">●</span>
                  <span><strong>BV Mắt Hoa Lư</strong> (Khám sàng lọc thị giác trẻ em)</span>
                </li>
              </ul>
            </div>

            {/* Medical Disclaimer Card */}
            <div className="footer-medical-disclaimer-card">
              <div className="disclaimer-card-header">
                <span>🩺</span>
                <span>Khuyến cáo y tế</span>
              </div>
              <p className="disclaimer-card-text">
                RemiCare là công cụ giáo dục và sàng lọc định hướng ban đầu tại nhà.
                Kết quả <strong>không thay thế chẩn đoán chuyên khoa</strong> của bác sĩ nhãn khoa.
              </p>
            </div>

            {/* Warning Signs Box */}
            <div className="footer-warning-signs-box">
              <div className="warning-box-title">
                <span>⚠️</span>
                <span>Dấu hiệu nên đi khám ngay</span>
              </div>
              <p className="warning-box-text">
                Bé hay nheo mắt, nghiêng đầu vẹo cổ khi nhìn, một mắt có xu hướng lệch trong/ngoài, hoặc sợ ánh sáng mạnh.
              </p>
            </div>
          </div>
        </div>

        {/* ====================================================================
            3. BOTTOM BAR (COPYRIGHT, VOICE GUIDE & BACK TO TOP)
            ==================================================================== */}
        <div className="footer-bottom-bar">
          <div className="footer-copyright-text">
            <span>© 2026 <strong>RemiCare AI</strong> — Hệ sinh thái Sàng lọc Thị giác & Mô phỏng Mắt Lác Lé Thông minh.</span>
            <br />
            <small style={{ color: '#527572' }}>Phát triển vì sức khỏe đôi mắt trẻ thơ và cộng đồng Việt Nam • 100% Miễn phí & Bảo mật.</small>
          </div>

          <div className="footer-bottom-actions">
            <button
              type="button"
              className={`btn-footer-voice-listen ${isSpeaking ? 'speaking' : ''}`}
              onClick={toggleIrisVoice}
              title={isSpeaking ? 'Dừng đọc' : 'Iris đọc to nội dung chân trang'}
              aria-label="Đọc to nội dung chân trang bằng giọng nói"
            >
              <span>{isSpeaking ? '⏹ Dừng giọng đọc' : '🔊 Nghe đọc chân trang'}</span>
            </button>

            <button
              type="button"
              className="btn-footer-back-to-top"
              onClick={scrollToTop}
              title="Cuộn mượt mà lên đầu trang"
              aria-label="Lên đầu trang"
            >
              <span className="back-to-top-arrow">↑</span>
              <span>Lên đầu trang</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

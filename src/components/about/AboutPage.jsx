import AudioGuide from '../audio/ListeningExperience';
import React, { useState, useEffect } from 'react';
import audioService from '../../services/audioService';
import {
  IconSpeakerWave,
} from '../home/HomeIcons';
import AppNavbar from '../common/AppNavbar';
import AppFooter from '../common/AppFooter';
import './aboutPage.css';

/**
 * REMICARE AI — ABOUT PAGE (TRANG GIỚI THIỆU)
 * 
 * Sứ mệnh • Công nghệ Y khoa • Thiết kế Dễ dùng cho Mọi Lứa Tuổi (Trẻ em đến Người cao tuổi)
 * Tích hợp Trợ lý Giọng nói Iris thân thiện (Web Speech TTS)
 */
export default function AboutPage({
  onNavigateHome,
  onStartExperience,
  onStartScreening,
  onStartSimulation,
}) {
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [currentSpokenSection, setCurrentSpokenSection] = useState(null);

  // Audio Voice Narration Scripts
  const voiceScripts = {
    hero:
      'Xin chào bạn! Mình là Iris. RemiCare AI là nền tảng ứng dụng thị giác máy tính và trí tuệ nhân tạo, giúp phát hiện sớm các dấu hiệu lác lé và nhược thị cho trẻ nhỏ ngay tại nhà. Hoàn toàn bảo mật, miễn phí và thân thiện cho mọi thế hệ trong gia đình.',
    story:
      'Tại sao RemiCare ra đời? Giai đoạn trước 7 đến 8 tuổi là thời gian vàng để hoàn thiện thị giác hai mắt của trẻ. Nếu phát hiện lác ẩn hay nhược thị muộn, việc tập luyện phục hồi sẽ rất khó khăn. RemiCare mang các phương pháp khám chuẩn y khoa vào webcam máy tính, giúp cha mẹ dễ dàng nhận biết sớm dấu hiệu mắt bất thường.',
    tech:
      'Về công nghệ: RemiCare kết hợp phương pháp phản xạ Hirschberg quang học, mạng lưới 468 điểm MediaPipe FaceMesh và thuật toán Cover Test kỹ thuật số để tính toán góc lệch chính xác theo độ lăng kính prism diopters theo thời gian thực.',
    forAll:
      'Thiết kế cho mọi thế hệ: Với trẻ nhỏ là những hình ảnh sinh động và giọng nói nhẹ nhàng. Với ba mẹ là các báo cáo rõ ràng không rườm rà. Với ông bà và người lớn tuổi là chữ to rõ ràng, nút bấm lớn chạm một chạm và có giọng nói tự động đọc to.',
    ethics:
      'Bốn cam kết vàng: 100% xử lý cục bộ trên trình duyệt của bạn qua WebAssembly, không lưu trữ ảnh hay video lên mạng. Hoàn toàn miễn phí vì sức khỏe cộng đồng. Và luôn minh bạch là công cụ giáo dục hỗ trợ, không thay thế bác sĩ chuyên khoa mắt.',
  };

  // Subscribe to audioService
  useEffect(() => {
    const unsubscribe = audioService.subscribe((snapshot) => {
      const active = snapshot.state === 'SPEAKING' || snapshot.state === 'PAUSED';
      setIsAudioPlaying(active);
      if (!active) {
        setCurrentSpokenSection(null);
      }
    });

    return () => {
      unsubscribe();
      audioService.stop();
    };
  }, []);

  const toggleVoice = (sectionKey, text) => {
    if (isAudioPlaying && currentSpokenSection === sectionKey) {
      audioService.stop();
      setCurrentSpokenSection(null);
      return;
    }

    audioService.stop();
    setCurrentSpokenSection(sectionKey);
    audioService.speak(text, { userGesture: true }).catch((err) => {
      console.warn('[AboutPage] Voice error:', err);
      setCurrentSpokenSection(null);
    });
  };

  return (
    <div className="remicare-about-root">
      {/* 1. UNIFIED MASTER APPLICATION NAVBAR */}
      <AppNavbar
        activeTab="about"
        onSelectTab={(tab) => {
          if (tab === 'home') onNavigateHome();
          else if (tab === 'experience') onStartExperience();
          else if (tab === 'simulation') onStartSimulation();
          else if (tab === 'screening') onStartScreening();
          else if (tab === 'about') window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onNavigateHome={onNavigateHome}
      />

      {/* 2. Main Container */}
      <main className="about-main-container">
        <div className="page-audio-intro"><AudioGuide guideId="about" compact /></div>
        {/* Hero Section */}
        <section className="about-hero-section">
          <div className="about-pill-badge">
            <span>✨</span>
            <span>DỰ ÁN AI & SỨC KHỎE THỊ GIÁC CỘNG ĐỒNG</span>
          </div>

          <h1 className="about-hero-title">
            Vì nụ cười và ánh mắt sáng của{' '}
            <span className="about-hero-title-highlight">trẻ thơ & gia đình</span>
          </h1>

          <p className="about-hero-subtitle">
            RemiCare AI mang công nghệ thị giác máy tính và sàng lọc mắt y khoa chuẩn quốc tế
            vào từng chiếc webcam quen thuộc — giúp phát hiện sớm lác lé, nhược thị ngay tại nhà,
            hoàn toàn miễn phí, bảo mật và cực kỳ dễ sử dụng từ trẻ nhỏ đến người cao tuổi.
          </p>

          {/* Iris Voice Card */}
          <div className="about-iris-voice-card">
            <div className="iris-voice-left">
              <div className="iris-avatar-disk" aria-hidden="true">
                👁️
              </div>
              <div className="iris-voice-meta">
                <h4>Trợ lý giọng nói Bé Iris</h4>
                <p>Bấm nút bên cạnh để nghe Iris giới thiệu toàn bộ trang này bằng giọng nói nhé!</p>
              </div>
            </div>

            <button
              type="button"
              className={`btn-iris-speak ${isAudioPlaying && currentSpokenSection === 'hero' ? 'speaking' : ''}`}
              onClick={() => toggleVoice('hero', voiceScripts.hero)}
              title="Nghe giọng nói Iris đọc lời chào mừng"
            >
              <IconSpeakerWave size={20} isPlaying={isAudioPlaying && currentSpokenSection === 'hero'} />
              <span>
                {isAudioPlaying && currentSpokenSection === 'hero' ? 'Dừng đọc' : 'Nghe Iris đọc'}
              </span>
            </button>
          </div>

          {/* 3 Quick Impact Stat Badges */}
          <div className="about-hero-stats-row">
            <div className="about-stat-card">
              <div className="stat-card-icon">🔒</div>
              <div className="stat-card-text">
                <h5>100% Cục Bộ & Bảo Mật</h5>
                <p>AI xử lý trên máy của bạn bằng WebAssembly, không gửi ảnh hay video lên bất kỳ máy chủ nào.</p>
              </div>
            </div>

            <div className="about-stat-card">
              <div className="stat-card-icon">💎</div>
              <div className="stat-card-text">
                <h5>0đ Hoàn Toàn Miễn Phí</h5>
                <p>Dự án công nghệ cộng đồng phi lợi nhuận, không thu phí, không quảng cáo, mở rộng cho mọi người.</p>
              </div>
            </div>

            <div className="about-stat-card">
              <div className="stat-card-icon">👨‍👩‍👧‍👦</div>
              <div className="stat-card-text">
                <h5>Thiết Kế Mọi Thế Hệ</h5>
                <p>Chữ to rõ ràng, tương phản cao, thao tác 1 chạm thân thiện cho bé 4 tuổi lẫn ông bà 80 tuổi.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 1: Story & Mission */}
        <section className="about-content-block" aria-labelledby="story-title">
          <div className="about-block-header">
            <div className="block-title-group">
              <div className="block-icon-badge">📖</div>
              <h2 id="story-title" style={{ fontSize: '1.65rem', fontWeight: 900, color: '#087F78' }}>
                Vì sao RemiCare AI ra đời?
              </h2>
            </div>

            <button
              type="button"
              className="btn-mini-voice"
              onClick={() => toggleVoice('story', voiceScripts.story)}
              title="Nghe Iris đọc câu chuyện này"
            >
              <IconSpeakerWave size={16} isPlaying={isAudioPlaying && currentSpokenSection === 'story'} />
              <span>{isAudioPlaying && currentSpokenSection === 'story' ? 'Dừng' : 'Nghe kể chuyện'}</span>
            </button>
          </div>

          <div className="about-story-grid">
            <div className="about-story-text">
              <p>
                Tại Việt Nam và nhiều nước đang phát triển, <strong>tỷ lệ trẻ mắc lác lé và nhược thị (mắt lười)</strong> chiếm từ 2% đến 5% trẻ em trong độ tuổi học đường. Điều đáng tiếc nhất là <strong>“Giai đoạn vàng”</strong> để điều trị phục hồi thị giác hai mắt của trẻ chỉ diễn ra <strong>trước 7–8 tuổi</strong>.
              </p>
              <p>
                Tuy nhiên, nhiều bậc cha mẹ ở xa cơ sở y tế chuyên khoa mắt, hoặc các dấu hiệu lác góc nhỏ, lác ẩn khó nhận biết bằng mắt thường. Khi đưa trẻ đến bệnh viện lớn thì thị lực một bên mắt đã suy giảm nghiêm trọng.
              </p>
              <p>
                <strong>RemiCare AI ra đời với một ước mơ giản dị:</strong> Biến một chiếc máy tính hoặc điện thoại có camera thành một công cụ trợ giúp đắc lực, giúp cha mẹ và người thân có thể sàng lọc sớm chỉ trong 1 phút nhẹ nhàng như một trò chơi, không gây sợ hãi cho trẻ nhỏ.
              </p>

              <div className="about-story-callout">
                💡 <em>“Phát hiện sớm trước 7 tuổi có thể cứu lấy thị lực trọn đời của một đứa trẻ.”</em>
              </div>
            </div>

            <div className="about-story-visual-card">
              <span className="visual-badge">Sứ Mệnh Cốt Lõi</span>
              <h3 className="visual-card-title">Cầu Nối Y Tế Cộng Đồng</h3>
              <ul className="visual-card-list">
                <li>
                  <span className="dot">✓</span>
                  <span><strong>Không thay thế bác sĩ:</strong> RemiCare là trợ lý định hướng sàng lọc ban đầu, giúp gia đình phát hiện sớm khi nào cần đưa con đi khám.</span>
                </li>
                <li>
                  <span className="dot">✓</span>
                  <span><strong>Xóa rào cản địa lý:</strong> Bất cứ gia đình nào ở vùng nông thôn hay thành thị có internet đều có thể tiếp cận miễn phí.</span>
                </li>
                <li>
                  <span className="dot">✓</span>
                  <span><strong>Báo cáo sinh trắc học chuẩn y khoa:</strong> Đo góc lệch theo Độ Lăng Kính (Prism Diopters), xuất ảnh có số liệu để phụ huynh mang theo gặp bác sĩ.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 2: Core Technologies */}
        <section className="about-content-block" aria-labelledby="tech-title">
          <div className="about-block-header">
            <div className="block-title-group">
              <div className="block-icon-badge">⚡</div>
              <h2 id="tech-title" style={{ fontSize: '1.65rem', fontWeight: 900, color: '#087F78' }}>
                4 Trụ Cột Công Nghệ & Khoa Học
              </h2>
            </div>

            <button
              type="button"
              className="btn-mini-voice"
              onClick={() => toggleVoice('tech', voiceScripts.tech)}
              title="Nghe giải thích công nghệ"
            >
              <IconSpeakerWave size={16} isPlaying={isAudioPlaying && currentSpokenSection === 'tech'} />
              <span>{isAudioPlaying && currentSpokenSection === 'tech' ? 'Dừng' : 'Nghe công nghệ'}</span>
            </button>
          </div>

          <div className="about-tech-grid">
            <div className="tech-item-card">
              <div className="tech-icon-circle">💡</div>
              <h4>Phản Xạ Giác Mạc Hirschberg</h4>
              <p>
                Ứng dụng định luật quang học Hirschberg kinh điển: Khi chiếu nguồn sáng trước mặt, AI tự động đo khoảng cách giữa tâm con ngươi và ánh phản quang để tính độ lệch trục quang học.
              </p>
              <span className="tech-pill">Quang học Y khoa</span>
            </div>

            <div className="tech-item-card">
              <div className="tech-icon-circle">🎯</div>
              <h4>MediaPipe FaceMesh 468 Điểm</h4>
              <p>
                Trích xuất 468 điểm mốc khuôn mặt và 10 điểm viền tròng đen (Iris) với độ chính xác sub-pixel, theo dõi chuyển động mắt theo trục khóe mắt (Canthal axes) ở tốc độ 60 FPS.
              </p>
              <span className="tech-pill">Thị giác Máy tính</span>
            </div>

            <div className="tech-item-card">
              <div className="tech-icon-circle">🎭</div>
              <h4>Mô Phỏng Lác Lé Sinh Học (AI Filter)</h4>
              <p>
                Bộ lọc camera thời gian thực mô phỏng 4 dạng lác: Lác Trong (Esotropia), Lác Ngoài (Exotropia), Lác Trên (Hypertropia) và Lác Dưới (Hypotropia), giúp cha mẹ "thấu hiểu" thị giác của con.
              </p>
              <span className="tech-pill">Tái tạo 3D Sclera</span>
            </div>

            <div className="tech-item-card">
              <div className="tech-icon-circle">⏱️</div>
              <h4>Giao Thức Digital Cover Test</h4>
              <p>
                Mô phỏng bài kiểm tra che mắt kinh điển của bác sĩ mắt: Theo dõi phản xạ định thị lại (saccadic refixation) khi mở mắt để phát hiện cả lác ẩn (phoria) và lác hiện (tropia).
              </p>
              <span className="tech-pill">Giao thức Chuẩn</span>
            </div>
          </div>
        </section>

        {/* Section 3: Universal Accessibility for Young to Elderly */}
        <section className="about-content-block" aria-labelledby="audience-title">
          <div className="about-block-header">
            <div className="block-title-group">
              <div className="block-icon-badge">❤️</div>
              <h2 id="audience-title" style={{ fontSize: '1.65rem', fontWeight: 900, color: '#087F78' }}>
                Thiết Kế Cho Mọi Lứa Tuổi Trong Gia Đình
              </h2>
            </div>

            <button
              type="button"
              className="btn-mini-voice"
              onClick={() => toggleVoice('forAll', voiceScripts.forAll)}
              title="Nghe hướng dẫn sử dụng cho mọi lứa tuổi"
            >
              <IconSpeakerWave size={16} isPlaying={isAudioPlaying && currentSpokenSection === 'forAll'} />
              <span>{isAudioPlaying && currentSpokenSection === 'forAll' ? 'Dừng' : 'Nghe Iris đọc'}</span>
            </button>
          </div>

          <div className="about-audience-grid">
            <div className="audience-card aud-kids">
              <div className="audience-header">
                <span className="audience-avatar">👶</span>
                <h4>Dành cho Trẻ em</h4>
              </div>
              <p>
                Giao diện màu sắc thân thiện, nhẹ nhàng, không có dụng cụ kim loại hay đèn chói mắt gây lo sợ.
              </p>
              <ul className="audience-highlights">
                <li>✨ Hoạt ảnh chuyển động nhẹ nhàng</li>
                <li>🗣️ Cô Iris hướng dẫn từng lời nói</li>
                <li>🎮 Trải nghiệm như một trò chơi vui</li>
              </ul>
            </div>

            <div className="audience-card aud-parents">
              <div className="audience-header">
                <span className="audience-avatar">👨‍👩‍👧</span>
                <h4>Dành cho Ba Mẹ</h4>
              </div>
              <p>
                Hiểu rõ tình trạng mắt của con mình qua báo cáo trực quan, không dùng thuật ngữ y khoa phức tạp gây bối rối.
              </p>
              <ul className="audience-highlights">
                <li>📊 Chỉ số góc lệch rõ ràng (Độ & Diopter)</li>
                <li>📸 Chụp ảnh lưu lại cho bác sĩ xem</li>
                <li>💡 Hướng dẫn chăm sóc mắt khoa học</li>
              </ul>
            </div>

            <div className="audience-card aud-grandparents">
              <div className="audience-header">
                <span className="audience-avatar">👵</span>
                <h4>Dành cho Người Lớn Tuổi</h4>
              </div>
              <p>
                Phông chữ lớn, độ tương phản cao, nút bấm to bản dễ bấm bằng chuột hoặc ngón tay trên màn hình cảm ứng.
              </p>
              <ul className="audience-highlights">
                <li>🔍 Cỡ chữ to, rõ ràng, không mỏi mắt</li>
                <li>🔊 Tự động đọc bằng giọng nói tiếng Việt</li>
                <li>👆 Chỉ cần 1 chạm là bắt đầu</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 4: Golden Commitments */}
        <section className="about-content-block" aria-labelledby="ethics-title">
          <div className="about-block-header">
            <div className="block-title-group">
              <div className="block-icon-badge">🛡️</div>
              <h2 id="ethics-title" style={{ fontSize: '1.65rem', fontWeight: 900, color: '#087F78' }}>
                4 Cam Kết Vàng Về Đạo Đức & Bảo Mật
              </h2>
            </div>

            <button
              type="button"
              className="btn-mini-voice"
              onClick={() => toggleVoice('ethics', voiceScripts.ethics)}
              title="Nghe cam kết đạo đức"
            >
              <IconSpeakerWave size={16} isPlaying={isAudioPlaying && currentSpokenSection === 'ethics'} />
              <span>{isAudioPlaying && currentSpokenSection === 'ethics' ? 'Dừng' : 'Nghe cam kết'}</span>
            </button>
          </div>

          <div className="about-ethics-grid">
            <div className="ethics-card">
              <div className="ethics-icon">🔒</div>
              <h5>Quyền Riêng Tư Tuyệt Đối</h5>
              <p>
                Dữ liệu khuôn mặt và camera được xử lý 100% trong bộ nhớ tạm thời trên thiết bị của bạn. Không bao giờ lưu trữ hay tải hình ảnh của trẻ lên mạng.
              </p>
            </div>

            <div className="ethics-card">
              <div className="ethics-icon">🩺</div>
              <h5>Minh Bạch Y Khoa</h5>
              <p>
                RemiCare là công cụ sàng lọc thị giác hỗ trợ cộng đồng, luôn khuyến nghị đưa trẻ đến bệnh viện chuyên khoa mắt để có chẩn đoán chính xác nhất.
              </p>
            </div>

            <div className="ethics-card">
              <div className="ethics-icon">🤝</div>
              <h5>Phi Lợi Nhuận & Vì Cộng Đồng</h5>
              <p>
                Toàn bộ tính năng mở miễn phí trọn đời cho mọi gia đình, trường học và trạm y tế cơ sở.
              </p>
            </div>

            <div className="ethics-card">
              <div className="ethics-icon">🔬</div>
              <h5>Khoa Học & Bền Vững</h5>
              <p>
                Liên tục cập nhật các nghiên cứu nhãn khoa mới nhất về thị giác hai mắt và các phương pháp Hirschberg, Cover-Uncover chuẩn quốc tế.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5: Call to Action Banner */}
        <section className="about-cta-banner">
          <h2>Sẵn sàng kiểm tra thị lực cho người thân của bạn?</h2>
          <p>
            Chỉ mất chưa đầy 1 phút với một chiếc webcam. Hãy bắt đầu ngay để bảo vệ đôi mắt sáng cho con yêu và gia đình bạn!
          </p>

          <div className="about-cta-actions">
            <button
              type="button"
              className="btn-cta-large-primary"
              onClick={onStartScreening}
            >
              <span>🔍 Sàng lọc mắt ngay</span>
            </button>

            <button
              type="button"
              className="btn-cta-large-secondary"
              onClick={onStartSimulation}
            >
              <span>🎭 Thử bộ lọc Mô phỏng Lác lé</span>
            </button>

            <button
              type="button"
              className="btn-cta-large-secondary"
              onClick={onNavigateHome}
            >
              <span>🏠 Về Trang chủ</span>
            </button>
          </div>
        </section>
      </main>

      {/* Comprehensive Master Footer */}
      <AppFooter
        onNavigateHome={onNavigateHome}
        onStartExperience={onStartExperience}
        onStartScreening={onStartScreening}
        onStartSimulation={onStartSimulation}
        onOpenAbout={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />
    </div>
  );
}

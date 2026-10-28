import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ContactChannels from './ContactChannels';
import audioService from '../../services/audioService';
import { AudioIcon } from '../audio/ListeningExperience';
import './appFooter.css';

const footerInfo = {
  care: { title: 'Kiến thức sức khỏe mắt', paragraphs: [
    'Khám phá các bài nghe về chăm sóc mắt và đồng hành cùng con trên trang chủ. Bạn có thể nghe Lumi đọc hoặc mở phần nội dung để đọc theo.',
    'Phần trải nghiệm góc nhìn và mô phỏng giúp bạn tìm hiểu trực quan về lác lé, nhược thị. Đây là nội dung giáo dục, không phải hướng dẫn tự điều trị.',
  ] },
};

const intro = 'Cùng bạn chủ động chăm sóc sức khỏe đôi mắt. RemiCare ứng dụng AI hỗ trợ sàng lọc mắt ban đầu, giúp người dùng nâng cao nhận thức và chủ động hơn trong chăm sóc sức khỏe mắt. RemiCare không thay thế việc thăm khám, chẩn đoán hoặc điều trị của bác sĩ chuyên khoa mắt.';

export default function AppFooter({ onNavigateHome, onStartExperience, onStartScreening, onStartSimulation, onOpenAbout, onOpenCareModal }) {
  const [panel, setPanel] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const dialogRef = useRef(null);
  const info = footerInfo[panel];
  const navigate = useNavigate();

  useEffect(() => audioService.subscribe(snapshot => {
    setSpeaking(snapshot.text === intro && ['SPEAKING', 'PAUSED'].includes(snapshot.state));
  }), []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (panel && !dialog.open) dialog.showModal();
    else if (!panel && dialog.open) dialog.close();
  }, [panel]);

  const nav = (path, callback) => {
    if (callback) {
      callback();
    } else if (navigate) {
      navigate(path);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const home = () => nav('/', onNavigateHome);
  const listen = () => {
    if (speaking) audioService.stop();
    else audioService.speak(intro, { userGesture: true }).catch(error => console.warn('[AppFooter] Voice:', error));
  };

  return <footer className="remicare-master-footer remicare-footer" aria-label="Chân trang RemiCare">
    <div className="remicare-footer-inner">
      <div className="remicare-footer-intro">
        <button type="button" className="remicare-footer-brand" onClick={home} aria-label="RemiCare — về trang chủ"><img src="/images/logo_co_text.jpg" alt="RemiCare" width="2406" height="818" loading="lazy" /></button>
        <h2>Cùng bạn chủ động chăm sóc sức khỏe đôi mắt</h2>
        <p>Ứng dụng AI hỗ trợ sàng lọc mắt ban đầu, giúp người dùng nâng cao nhận thức và chủ động hơn trong chăm sóc sức khỏe mắt.</p>
      </div>

      <div className="remicare-footer-columns">
        <nav aria-labelledby="footer-explore-heading">
          <h3 id="footer-explore-heading">Khám phá</h3>
          <ul>
            <li><button type="button" onClick={home}>Trang chủ</button></li>
            <li><button type="button" onClick={() => nav('/gioi-thieu', onOpenAbout)}>Giới thiệu RemiCare</button></li>
            <li><button type="button" onClick={() => nav('/trai-nghiem', onStartExperience)}>Trải nghiệm góc nhìn</button></li>
            <li><button type="button" onClick={() => nav('/mo-phong', onStartSimulation)}>Mô phỏng lác lé</button></li>
            <li><button type="button" onClick={() => nav('/sang-loc', onStartScreening)}>Trung tâm sàng lọc AI</button></li>
            <li><button type="button" onClick={() => nav('/sang-loc/lac-le')}>Sàng lọc Lác / Lé</button></li>
            <li><button type="button" onClick={() => nav('/sang-loc/sup-mi')}>Sàng lọc Sụp Mí</button></li>
            <li><button type="button" onClick={() => onOpenCareModal ? onOpenCareModal() : setPanel('care')}>Kiến thức sức khỏe mắt</button></li>
          </ul>
        </nav>
        <nav aria-labelledby="footer-support-heading">
          <h3 id="footer-support-heading">Hướng dẫn & hỗ trợ</h3>
          <ul>
            <li><Link to="/huong-dan-sang-loc">Hướng dẫn sàng lọc</Link></li>
            <li><Link to="/hieu-ket-qua">Hiểu kết quả sàng lọc</Link></li>
            <li><Link to="/cau-hoi-thuong-gap">Câu hỏi thường gặp</Link></li>
            <li><Link to="/lien-he">Liên hệ & phản hồi</Link></li>
          </ul>
        </nav>
        <nav aria-labelledby="footer-policy-heading">
          <h3 id="footer-policy-heading">Chính sách & quyền riêng tư</h3>
          <ul>
            <li><Link to="/chinh-sach-bao-mat">Chính sách bảo mật</Link></li>
            <li><Link to="/dieu-khoan-su-dung">Điều khoản sử dụng</Link></li>
            <li><Link to="/thong-tin-ai">Thông tin về AI</Link></li>
          </ul>
          <div className="remicare-footer-connect">
            <h4>Kết nối với RemiCare</h4>
            <ContactChannels />
            <div className="remicare-footer-tools">
              <button type="button" onClick={listen} aria-label={speaking ? 'Dừng Lumi giới thiệu RemiCare' : 'Nghe Lumi giới thiệu RemiCare'} aria-pressed={speaking}><AudioIcon name={speaking ? 'pause' : 'sound'} width="20" height="20" /><span>{speaking ? 'Dừng giọng đọc' : 'Nghe Lumi giới thiệu'}</span></button>
              <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Về đầu trang"><span aria-hidden="true">↑</span></button>
            </div>
          </div>
        </nav>
      </div>

      <aside className="remicare-footer-notice" aria-labelledby="footer-notice-heading">
        <svg width="38" height="42" viewBox="0 0 32 36" fill="none" aria-hidden="true"><path d="M16 2C12 5 7 6 3 7V17C3 25 9 31 16 34C23 31 29 25 29 17V7C25 6 20 5 16 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M16 11V20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /><circle cx="16" cy="25" r="1.5" fill="currentColor" /></svg>
        <div><h3 id="footer-notice-heading">Lưu ý về kết quả sàng lọc</h3><p>RemiCare chỉ hỗ trợ sàng lọc ban đầu, không thay thế việc thăm khám, chẩn đoán hoặc điều trị của bác sĩ chuyên khoa mắt. Kết quả bình thường không loại trừ hoàn toàn các bệnh lý về mắt.</p></div>
      </aside>
      <p className="remicare-footer-copyright">© 2026 RemiCare. Mọi quyền được bảo lưu.</p>
    </div>

    <dialog ref={dialogRef} className="remicare-footer-dialog" aria-labelledby="footer-dialog-title" onCancel={() => setPanel(null)} onClick={event => { if (event.target === event.currentTarget) setPanel(null); }}>
      <div className="remicare-footer-dialog-content">
        <div className="remicare-footer-dialog-heading"><h2 id="footer-dialog-title">{info?.title}</h2><button type="button" onClick={() => setPanel(null)} aria-label="Đóng thông tin">×</button></div>
        {info?.paragraphs?.map(text => <p key={text}>{text}</p>)}
      </div>
    </dialog>
  </footer>;
}

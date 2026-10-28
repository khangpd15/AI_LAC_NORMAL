import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import audioService from '../../services/audioService';
import { AudioIcon } from '../audio/ListeningExperience';
import './appFooter.css';

const socialLinks = [
  { name: 'Facebook', icon: 'facebook', href: 'https://www.facebook.com/remicare.visionhealth' },
  { name: 'Instagram', icon: 'instagram', href: 'https://www.instagram.com/remicare.vision.health/' },
  { name: 'YouTube', icon: 'youtube', href: 'https://www.youtube.com/@remicare-visionhealth' },
  { name: 'TikTok', icon: 'tiktok', href: 'https://www.tiktok.com/@remicare.vision.health' },
  { name: 'Email', icon: 'mail', href: 'mailto:remicare.visionhealth@gmail.com' },
];

function SocialIcon({ name }) {
  const shapes = {
    facebook: <path fill="currentColor" stroke="none" d="M14 22V13H17L17.5 9H14V7C14 5.9 14.3 5 16 5H18V1.5C17.1 1.2 16 1 15 1C11.8 1 10 2.9 10 6V9H7V13H10V22Z" />,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></>,
    youtube: <><rect x="2" y="5" width="20" height="14" rx="4" /><path d="M10 9L16 12L10 15Z" fill="currentColor" stroke="none" /></>,
    tiktok: <path d="M14 3V16A4 4 0 1 1 10 12M14 3C14 7 17 9 21 9V5C18 5 17 3 17 2H14V3Z" />,
    mail: <><rect x="2" y="4" width="20" height="16" rx="3" /><path d="M3 6L12 13L21 6" /></>,
  };
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{shapes[name]}</svg>;
}

const footerInfo = {
  guide: { title: 'Hướng dẫn sàng lọc', paragraphs: [
<<<<<<< HEAD
    'Chọn “Sàng lọc” trên thanh điều hướng, cho phép camera và làm theo từng bước hướng dẫn trên màn hình.',
    'Giữ khuôn mặt trong khung hình. Ở bước Hirschberg, xem lại ảnh chụp trước khi xác nhận gửi ảnh để AI phân tích.',
    'Bạn có thể nghe Lumi hướng dẫn hoặc đọc nội dung ngay trên từng màn hình.',
=======
    'Chọn “Sàng lọc” trên thanh điều hướng, chọn giữa Sàng lọc Lác/Lé (Hirschberg & Cover Test) hoặc Sàng lọc Sụp Mí (PtosisCheck), sau đó cấp quyền camera và làm theo từng bước hướng dẫn trên màn hình.',
    'Giữ khuôn mặt trong khung hình. Ở bước chụp ảnh, xem lại ảnh chụp trước khi xác nhận gửi ảnh để AI phân tích.',
    'Bạn có thể nghe Iris hướng dẫn hoặc đọc nội dung ngay trên từng màn hình.',
>>>>>>> fdbbc47753a30c9094d5981593b263b54f833642
  ] },
  results: { title: 'Hiểu kết quả sàng lọc', paragraphs: [
    'Kết quả của RemiCare là thông tin hỗ trợ sàng lọc ban đầu. Hình ảnh chưa đủ điều kiện hoặc kết quả chưa rõ có thể cần được thực hiện lại hoặc chuyên gia xem xét.',
    'Điểm số và phân hạng Tier do mô hình trả về không phải kết luận chẩn đoán bệnh. Kết quả bình thường không loại trừ hoàn toàn các bệnh lý về mắt.',
    'Nếu bạn lo lắng về đôi mắt của mình hoặc của con, hãy mang thông tin sàng lọc đến bác sĩ chuyên khoa mắt để được tư vấn chuyên sâu.',
  ] },
  faq: { title: 'Câu hỏi thường gặp', items: [
    ['RemiCare có thay thế bác sĩ không?', 'Không. Đây là công cụ trải nghiệm, nâng cao nhận thức và hỗ trợ sàng lọc ban đầu.'],
    ['Mô phỏng có phải kết quả đo mắt của tôi không?', 'Không. Hướng lệch và mức độ trong mô phỏng được bạn chủ động lựa chọn để quan sát hiệu ứng.'],
    ['Tôi có cần bật camera ngay khi mở trang không?', 'Không. Camera chỉ được sử dụng trong các trải nghiệm cần hình ảnh, sau khi bạn cho phép.'],
    ['Tôi có thể dùng khi tắt âm thanh không?', 'Có. Các hướng dẫn và nội dung bài nghe đều có phần văn bản để bạn đọc.'],
  ] },
  privacy: { title: 'Chính sách bảo mật', paragraphs: [
    'Bạn quyết định việc cấp quyền camera trên trình duyệt. Camera được dùng cho các bước trải nghiệm và sàng lọc có hướng dẫn.',
    'Bước phân tích Hirschberg gửi ảnh chụp cùng thông tin phiên đo đến máy chủ AI sau khi bạn xác nhận phân tích. Module PtosisCheck tuân thủ nguyên tắc Zero-Retention RAM, giải phóng bộ nhớ ngay sau khi xuất kết quả.',
    'Tính năng đọc lời dẫn có thể dùng dịch vụ giọng nói trực tuyến để tạo hoặc tải âm thanh. Lựa chọn giao diện sáng hoặc tối được lưu trong trình duyệt của bạn.',
  ] },
  terms: { title: 'Điều khoản sử dụng', paragraphs: [
    'RemiCare được xây dựng cho mục đích giáo dục, trải nghiệm thị giác và hỗ trợ sàng lọc mắt ban đầu.',
    'Các mô phỏng là hình ảnh minh họa; kết quả sàng lọc không thay thế việc thăm khám, chẩn đoán hoặc điều trị của bác sĩ chuyên khoa mắt.',
    'Trẻ em cần có phụ huynh hoặc người chăm sóc đồng hành khi sử dụng các tính năng camera và sàng lọc.',
  ] },
  ai: { title: 'Thông tin về AI', paragraphs: [
    'RemiCare dùng điểm mốc khuôn mặt để bám vị trí mắt trong các trải nghiệm camera. Bộ mô phỏng tạo hiệu ứng theo hướng và mức độ bạn lựa chọn.',
    'Ở quy trình Hirschberg và Ptosis, ảnh được phân tích qua các mô hình AI chuyên dụng. Chất lượng ảnh và điều kiện chụp có thể ảnh hưởng đến kết quả đầu ra.',
    'Các hình ảnh chiến dịch trên trang có thể là ảnh minh họa do AI tạo, không phải bằng chứng xác nhận hiệu quả của hệ thống.',
  ] },
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
            <li><button type="button" onClick={() => setPanel('guide')}>Hướng dẫn sàng lọc</button></li>
            <li><button type="button" onClick={() => setPanel('results')}>Hiểu kết quả sàng lọc</button></li>
            <li><button type="button" onClick={() => setPanel('faq')}>Câu hỏi thường gặp</button></li>
            <li><a href="mailto:remicare.visionhealth@gmail.com" title="remicare.visionhealth@gmail.com">Liên hệ & phản hồi</a></li>
          </ul>
        </nav>
        <nav aria-labelledby="footer-policy-heading">
          <h3 id="footer-policy-heading">Chính sách & quyền riêng tư</h3>
          <ul>
            <li><button type="button" onClick={() => setPanel('privacy')}>Chính sách bảo mật</button></li>
            <li><button type="button" onClick={() => setPanel('terms')}>Điều khoản sử dụng</button></li>
            <li><button type="button" onClick={() => setPanel('ai')}>Thông tin về AI</button></li>
          </ul>
          <div className="remicare-footer-connect">
            <h4>Kết nối với RemiCare</h4>
            <div className="remicare-footer-socials" aria-label="Các kênh chính thức của RemiCare">
              {socialLinks.map(link => <a key={link.icon} href={link.href} target={link.icon === 'mail' ? undefined : '_blank'} rel={link.icon === 'mail' ? undefined : 'noopener noreferrer'} aria-label={link.icon === 'mail' ? 'Gửi email đến remicare.visionhealth@gmail.com' : `RemiCare trên ${link.name} (mở tab mới)`} title={link.icon === 'mail' ? 'remicare.visionhealth@gmail.com' : link.name}><SocialIcon name={link.icon} /></a>)}
            </div>
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
        {info?.items?.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
        {panel === 'guide' && <button type="button" className="remicare-footer-dialog-action" onClick={() => { setPanel(null); nav('/sang-loc', onStartScreening); }}>Bắt đầu sàng lọc →</button>}
      </div>
    </dialog>
  </footer>;
}

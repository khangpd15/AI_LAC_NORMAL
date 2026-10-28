import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Lightbulb, Handshake, MessageCircle, ShieldCheck, Star, Mail, ArrowUpRight, Copy } from 'lucide-react';
import ContactChannels from '../../components/common/ContactChannels';
import { contactEmail } from '../../content/contact';
import { createFeedbackDraft } from './feedbackDraft';
import './support.css';

export default function ContactPage() {
  const [rating, setRating] = useState(0);
  const [draft, setDraft] = useState(null);
  const [status, setStatus] = useState('');
  useEffect(() => {
    const previous = document.title;
    document.title = 'Liên hệ & phản hồi | RemiCare';
    return () => { document.title = previous; };
  }, []);
  const prepareEmail = event => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    if (!fields.name.trim() || !fields.message.trim()) {
      setStatus('Vui lòng nhập họ tên và nội dung phản hồi, không chỉ khoảng trắng.');
      return;
    }
    const prepared = createFeedbackDraft({ ...fields, rating });
    setDraft(prepared);
    setStatus('Nội dung email đã sẵn sàng. Bấm “Mở ứng dụng email”, kiểm tra rồi gửi trong ứng dụng email của bạn.');
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft.body);
      setStatus(`Đã sao chép nội dung. Bạn có thể dán vào email gửi đến ${contactEmail}.`);
    } catch {
      setStatus('Chưa sao chép được. Bạn có thể chọn và sao chép nội dung email bên dưới.');
    }
  };
  return <div className="support-page contact-page">
    <nav className="support-breadcrumb" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><span>Liên hệ & phản hồi</span></nav>
    <header className="support-page-heading"><span className="support-eyebrow">LẮNG NGHE · CẢI THIỆN · ĐỒNG HÀNH</span><h1>Liên hệ & <em>phản hồi</em></h1><p>Bạn có câu hỏi hay gặp khó khăn khi sử dụng RemiCare? Hãy chia sẻ để chúng mình có thể lắng nghe và cải thiện trải nghiệm của bạn.</p></header>
    <div className="contact-grid">
      <section className="contact-card" aria-labelledby="contact-form-title">
        <h2 id="contact-form-title"><Send aria-hidden="true" />Gửi phản hồi của bạn</h2>
        <form className="contact-form" onSubmit={prepareEmail} onChange={() => { if (draft) { setDraft(null); setStatus(''); } }}>
          <label htmlFor="contact-name">Họ và tên <span aria-hidden="true">*</span></label>
          <input id="contact-name" name="name" required maxLength={100} autoComplete="name" placeholder="Nhập họ và tên của bạn" />
          <label htmlFor="contact-email">Email liên hệ <span aria-hidden="true">*</span></label>
          <input id="contact-email" name="email" type="email" required maxLength={254} autoComplete="email" placeholder="example@gmail.com" />
          <label htmlFor="contact-topic">Chủ đề phản hồi <span aria-hidden="true">*</span></label>
          <select id="contact-topic" name="topic" defaultValue="Báo lỗi kỹ thuật / Camera" required>
            <option>Báo lỗi kỹ thuật / Camera</option><option>Hướng dẫn sử dụng</option><option>Góp ý tính năng</option><option>Kết nối & hợp tác</option><option>Quyền riêng tư & dữ liệu</option><option>Nội dung khác</option>
          </select>
          <label htmlFor="contact-message">Nội dung phản hồi <span aria-hidden="true">*</span></label>
          <textarea id="contact-message" name="message" required maxLength={2000} rows={6} placeholder="Mô tả vấn đề bạn gặp hoặc chia sẻ ý kiến của bạn…" aria-describedby="contact-message-hint" />
          <p id="contact-message-hint" className="contact-field-hint">Nếu báo lỗi, hãy ghi tên tính năng, thiết bị và trình duyệt đang dùng. Tối đa 2.000 ký tự.</p>
          <fieldset className="contact-rating"><legend>Đánh giá trải nghiệm RemiCare <span>(tùy chọn)</span></legend>
            <div>{[1, 2, 3, 4, 5].map(value => <label key={value} className={value <= rating ? 'is-selected' : ''}>
              <input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} aria-label={`${value} sao`} /><Star aria-hidden="true" />
            </label>)}{rating > 0 && <button type="button" onClick={() => { setRating(0); setDraft(null); }}>Bỏ đánh giá</button>}</div>
          </fieldset>
          <div className="contact-privacy-note"><ShieldCheck aria-hidden="true" /><p>Vui lòng không gửi hình ảnh khuôn mặt, dữ liệu sức khỏe nhạy cảm hay mật khẩu qua biểu mẫu phản hồi thông thường.</p></div>
          <button type="submit" className="support-button contact-submit"><Mail size={20} aria-hidden="true" />Chuẩn bị email phản hồi</button>
          <p className="contact-field-hint">Bạn sẽ kiểm tra nội dung rồi gửi bằng ứng dụng email của mình. Biểu mẫu không tự gửi dữ liệu.</p>
        </form>
        {status && <p className="contact-status" role="status">{status}</p>}
        {draft && <div className="contact-draft">
          <h3>Email phản hồi của bạn</h3><p>Gửi đến <a href={`mailto:${contactEmail}`}>{contactEmail}</a></p>
          <pre tabIndex={0}>{draft.body}</pre>
          <div className="contact-draft-actions"><a className="support-button" href={draft.href}>Mở ứng dụng email <ArrowUpRight size={18} aria-hidden="true" /></a><button type="button" className="support-button support-button-secondary" onClick={copy}><Copy size={18} aria-hidden="true" />Sao chép nội dung</button></div>
        </div>}
      </section>
      <aside className="contact-card contact-aside" aria-labelledby="contact-welcome-title">
        <h2 id="contact-welcome-title">Remi chúng mình hy vọng</h2>
        <div className="contact-value"><span><Lightbulb aria-hidden="true" /></span><div><h3>Đóng góp ý tưởng</h3><p>Đề xuất tính năng mới hoặc những cải tiến giúp RemiCare hữu ích hơn mỗi ngày.</p></div></div>
        <div className="contact-value"><span><Handshake aria-hidden="true" /></span><div><h3>Kết nối và hợp tác</h3><p>Chúng mình mong nhận được sự kết nối và đồng hành cùng các đối tác trong hành trình phát triển.</p></div></div>
        <div className="contact-value"><span><MessageCircle aria-hidden="true" /></span><div><h3>Lắng nghe phản hồi</h3><p>Để lại email liên hệ để nhóm RemiCare có thể trao đổi thêm về ý kiến hoặc vấn đề bạn gặp.</p></div></div>
        <div className="contact-experience"><h3>Cần trải nghiệm lại?</h3><p>Trở lại các công cụ RemiCare để khám phá và sử dụng tính năng sàng lọc mắt ban đầu.</p><Link className="support-button" to="/sang-loc">Trải nghiệm RemiCare <ArrowUpRight size={20} aria-hidden="true" /></Link></div>
        <div className="contact-privacy-note"><ShieldCheck aria-hidden="true" /><div><h3>Lưu ý về hỗ trợ y tế</h3><p>Kênh phản hồi không thay thế việc khám mắt hoặc tư vấn của bác sĩ. Nếu có lo lắng về mắt, hãy liên hệ cơ sở y tế phù hợp.</p></div></div>
        <p className="contact-signature">RemiCare · Chủ động chăm sóc sức khỏe đôi mắt</p>
      </aside>
    </div>
    <section className="contact-connect" aria-labelledby="contact-connect-title"><h2 id="contact-connect-title">Kết nối với RemiCare</h2><ContactChannels className="contact-socials" /><a className="contact-email" href={`mailto:${contactEmail}`}>{contactEmail}</a></section>
  </div>;
}

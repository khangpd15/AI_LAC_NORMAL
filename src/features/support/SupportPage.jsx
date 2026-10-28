import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supportNavigation, supportPages, supportFaq } from '../../content/supportPages';
import './support.css';

export default function SupportPage({ pageKey }) {
  const entry = supportNavigation.find(item => item.key === pageKey);
  const content = supportPages[pageKey];
  const [query, setQuery] = useState('');
  useEffect(() => {
    const previous = document.title;
    document.title = `${entry.title} | RemiCare`;
    return () => { document.title = previous; };
  }, [entry.title]);
  const normalize = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  const questions = supportFaq.filter(([question, answer]) => normalize(`${question} ${answer}`).includes(normalize(query.trim())));
  return <div className="support-page">
    <nav className="support-breadcrumb" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><span>{entry.title}</span></nav>
    <header className="support-page-heading"><span className="support-eyebrow">{content?.eyebrow || 'LUMI GIẢI ĐÁP CÙNG BẠN'}</span><h1>{entry.title}</h1><p>{content?.description || 'Những câu trả lời để bạn sử dụng RemiCare dễ dàng và hiểu rõ hơn về kết quả.'}</p></header>
    <div className="support-content-layout">
      <aside className="support-page-nav" aria-label="Hướng dẫn và thông tin">
        <strong>Tìm hiểu cùng RemiCare</strong>
        {supportNavigation.map(item => <Link key={item.key} to={item.path} aria-current={item.key === pageKey ? 'page' : undefined}>{item.title}<span aria-hidden="true">↗</span></Link>)}
      </aside>
      <article className="support-article" aria-label={entry.title}>
        {pageKey === 'faq' ? <>
          <label className="support-search-label" htmlFor="support-faq-search">Tìm câu hỏi</label>
          <input id="support-faq-search" className="support-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ví dụ: camera, kết quả, âm thanh…" />
          <p className="support-search-status" role="status">{questions.length} câu hỏi phù hợp</p>
          {questions.map(([question, answer]) => <details className="support-faq" key={question}><summary>{question}</summary><p>{answer}</p></details>)}
          {!questions.length && <p>Chưa tìm thấy câu hỏi phù hợp. Thử từ khóa khác hoặc <Link to="/lien-he">liên hệ RemiCare</Link>.</p>}
        </> : content.sections.map((section, index) => <section key={section.title} className="support-article-section" aria-labelledby={`support-section-${index}`}><h2 id={`support-section-${index}`}>{section.title}</h2><p>{section.text}</p>{section.link && <Link className="support-text-link" to={section.link}>{section.linkLabel} <span aria-hidden="true">→</span></Link>}</section>)}
        <div className="support-help-strip"><div><strong>Bạn vẫn cần hỗ trợ?</strong><p>Chia sẻ để nhóm RemiCare lắng nghe và cải thiện.</p></div><Link to="/lien-he" className="support-button support-button-secondary">Liên hệ & phản hồi <span aria-hidden="true">↗</span></Link></div>
      </article>
    </div>
  </div>;
}

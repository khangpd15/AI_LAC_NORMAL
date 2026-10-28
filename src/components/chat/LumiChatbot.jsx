import React, { useEffect, useId, useRef, useState } from 'react';
import { lumiAnswers, lumiWelcome } from '../../content/lumiAnswers';
import { getLumiReply } from '../../services/lumiChatService';
import './lumiChatbot.css';
import LumiSprite from './LumiSprite';

export default function LumiChatbot({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [showGreeting, setShowGreeting] = useState(true);
  const [sleeping, setSleeping] = useState(false);
  const [flying, setFlying] = useState(false);
  const [activity, setActivity] = useState(0);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([{ role: 'assistant', answer: lumiWelcome }]);
  const panelId = useId();
  const titleId = useId();
  const input = useRef(null);
  const launcher = useRef(null);
  const log = useRef(null);
  const previouslyOpen = useRef(false);

  const wake = () => { setSleeping(false); setActivity((value) => value + 1); };
  const close = () => { setOpen(false); wake(); };
  const openChat = () => { wake(); setShowGreeting(false); setOpen(true); };

  useEffect(() => {
    if (open || flying) return;
    const timer = window.setTimeout(() => setSleeping(true), 12000);
    return () => window.clearTimeout(timer);
  }, [open, flying, activity]);

  useEffect(() => {
    if (open) input.current?.focus({ preventScroll: true });
    else if (previouslyOpen.current) launcher.current?.focus({ preventScroll: true });
    previouslyOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (open && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [open, messages]);

  const send = (text, answerId) => {
    const question = text.trim().slice(0, 500);
    if (!question) return;
    const reply = getLumiReply(question, answerId);
    setMessages((current) => [...current, { role: 'user', answer: question }, { role: 'assistant', ...reply }]);
    setDraft('');
  };

  return <div className="lumi-chat-widget" data-open={open} onKeyDown={(event) => { if (event.key === 'Escape' && open) { event.stopPropagation(); close(); } }}>
    {open && <section id={panelId} className="lumi-chat-panel" role="dialog" aria-labelledby={titleId}>
      <header className="lumi-chat-header">
        <LumiSprite action="fly" still className="lumi-mascot-working" />
        <div><h2 id={titleId}>Trò chuyện cùng Lumi</h2><p>Trợ lý đồng hành của RemiCare</p></div>
        <button type="button" className="lumi-chat-close" aria-label="Đóng trò chuyện Lumi" onClick={close}>×</button>
      </header>
      <div ref={log} className="lumi-chat-messages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Nội dung trò chuyện">
        {messages.map((message, index) => <div key={index} className={`lumi-message lumi-message-${message.role}`}>
          <span className="lumi-message-author">{message.role === 'user' ? 'Bạn' : 'Lumi'}</span>
          <p>{message.answer}</p>
          {message.action && <button type="button" className="lumi-message-action" onClick={() => { close(); onNavigate?.(message.action); }}>{message.actionLabel} <span aria-hidden="true">↗</span></button>}
        </div>)}
      </div>
      <div className="lumi-chat-suggestions" aria-label="Câu hỏi gợi ý">
        {lumiAnswers.map((item) => <button type="button" key={item.id} onClick={() => send(item.question, item.id)}>{item.question}</button>)}
      </div>
      <form className="lumi-chat-form" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
        <label htmlFor={`${panelId}-input`} className="sr-only">Câu hỏi dành cho Lumi</label>
        <input ref={input} id={`${panelId}-input`} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Nhắn cho Lumi…" maxLength={500} autoComplete="off" />
        <button type="submit" disabled={!draft.trim()} aria-label="Gửi câu hỏi"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3 3 19 9-19 9 4-9-4-9Zm4 9h15" strokeLinejoin="round" /></svg></button>
      </form>
      <p className="lumi-chat-note">Lumi trả lời từ nội dung hướng dẫn có sẵn.</p>
    </section>}
    {!open && showGreeting && <div className="lumi-greeting">
      <button type="button" className="lumi-greeting-message" onClick={openChat} aria-label="Trò chuyện với Lumi: Bạn cần giúp gì nè?">
        <span>Lumi đây! Bạn cần giúp gì nè?</span>
      </button>
      <button type="button" className="lumi-greeting-dismiss" aria-label="Ẩn lời chào Lumi" onClick={() => setShowGreeting(false)}>×</button>
    </div>}
    <button ref={launcher} type="button" className="lumi-chat-launcher" aria-label={open ? 'Đóng trò chuyện Lumi' : 'Mở trò chuyện với Lumi'} aria-expanded={open} aria-controls={open ? panelId : undefined} onPointerEnter={() => { wake(); setFlying(true); }} onPointerLeave={() => setFlying(false)} onFocus={() => { wake(); setFlying(true); }} onBlur={() => setFlying(false)} onClick={() => open ? close() : openChat()}>
      <LumiSprite action={sleeping && !open ? 'sleep' : flying || open ? 'fly' : 'wave'} />
    </button>
  </div>;
}

import React, { useEffect, useId, useRef, useState } from 'react';
import { lumiAnswers, lumiWelcome } from '../../content/lumiAnswers';
import { getLumiReply } from '../../services/lumiChatService';
import './lumiChatbot.css';
import LumiSprite from './LumiSprite';

export default function LumiChatbot({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [showGreeting, setShowGreeting] = useState(true);
  const [flying, setFlying] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', answer: lumiWelcome }]);
  const panelId = useId();
  const titleId = useId();
  const suggestions = useRef(null);
  const launcher = useRef(null);
  const log = useRef(null);
  const previouslyOpen = useRef(false);

  const close = () => setOpen(false);
  const openChat = () => { setShowGreeting(false); setOpen(true); };

  useEffect(() => {
    if (open) suggestions.current?.querySelector('button')?.focus({ preventScroll: true });
    else if (previouslyOpen.current) launcher.current?.focus({ preventScroll: true });
    previouslyOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (open && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [open, messages]);

  const selectQuestion = (answerId) => {
    const selected = lumiAnswers.find((item) => item.id === answerId);
    if (!selected) return;
    const reply = getLumiReply(selected.question, selected.id);
    setMessages((current) => [...current, { role: 'user', answer: selected.question }, { role: 'assistant', ...reply }]);
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
      <p className="lumi-chat-choice-label">Chọn câu hỏi để Lumi hướng dẫn bạn</p>
      <div ref={suggestions} className="lumi-chat-suggestions" role="group" aria-label="Câu hỏi gợi ý">
        {lumiAnswers.map((item) => <button type="button" key={item.id} onClick={() => selectQuestion(item.id)}>{item.question}</button>)}
      </div>
      <p className="lumi-chat-note">Lumi trả lời từ nội dung hướng dẫn có sẵn.</p>
    </section>}
    {!open && showGreeting && <div className="lumi-greeting">
      <button type="button" className="lumi-greeting-message" onClick={openChat} aria-label="Trò chuyện với Lumi: Bạn cần giúp gì nè?">
        <span>Lumi đây! Bạn cần giúp gì nè?</span>
      </button>
      <button type="button" className="lumi-greeting-dismiss" aria-label="Ẩn lời chào Lumi" onClick={() => setShowGreeting(false)}>×</button>
    </div>}
    <button ref={launcher} type="button" className="lumi-chat-launcher" aria-label={open ? 'Đóng trò chuyện Lumi' : 'Mở trò chuyện với Lumi'} aria-expanded={open} aria-controls={open ? panelId : undefined} onPointerEnter={() => setFlying(true)} onPointerLeave={() => setFlying(false)} onFocus={() => setFlying(true)} onBlur={() => setFlying(false)} onClick={() => open ? close() : openChat()}>
      <LumiSprite action={flying || open ? 'fly' : 'wave'} />
    </button>
  </div>;
}

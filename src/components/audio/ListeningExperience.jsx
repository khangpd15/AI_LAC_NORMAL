import React, { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import audioService from '../../services/audioService';
import { loadGuideAudio } from '../../services/guideAudio';
import { listeningGuides } from '../../content/listeningGuides';
import SitePhoto from '../common/SitePhoto';

const ListeningContext = createContext(null);
const time = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function AudioIcon({ name = 'play', ...props }) {
  const paths = {
    play: <path d="m9 5 11 7-11 7Z" fill="currentColor" strokeLinejoin="round" />,
    pause: <path d="M9 5v14M16 5v14" strokeWidth="4" />,
    back: <><path d="M4 9a9 9 0 1 1 0 7M4 4v5h5" /><text x="8" y="16" stroke="none" fill="currentColor" fontSize="9" fontWeight="700">10</text></>,
    forward: <><path d="M20 9a9 9 0 1 0 0 7M20 4v5h-5" /><text x="8" y="16" stroke="none" fill="currentColor" fontSize="9" fontWeight="700">10</text></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    sound: <><path d="m11 4-6 5H2v6h3l6 5ZM16 8a6 6 0 0 1 0 8M19 4a11 11 0 0 1 0 16" /></>,
    moon: <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" /></>,
  };
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

export function GuideCover({ kind = 'eyes', decorative = false }) {
  return <div className={`guide-cover guide-cover-${kind}`}><SitePhoto name={kind} decorative={decorative} /></div>;
}

export function ListeningProvider({ children }) {
  const audioRef = useRef(null);
  const requestRef = useRef(null);
  const cache = useRef(new Map());
  const activeRef = useRef(null);
  const [track, setTrack] = useState(null);
  const [status, setStatus] = useState('idle');
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [peaks, setPeaks] = useState([]);
  const [error, setError] = useState('');
  const [miniHidden, setMiniHidden] = useState(false);

  useEffect(() => {
    const entries = cache.current;
    const audio = new Audio();
    audioRef.current = audio;
    audio.onplay = () => { setStatus('playing'); setMiniHidden(false); };
    audio.onpause = () => setStatus((value) => value === 'loading' ? value : 'paused');
    audio.ontimeupdate = () => setPosition(audio.currentTime);
    audio.onended = () => setStatus('ended');
    audio.onerror = () => { setStatus('error'); setError('Không thể phát âm thanh. Vui lòng thử lại.'); };
    const unsubscribe = audioService.subscribe((snapshot) => {
      if (snapshot.state === 'SPEAKING' || snapshot.state === 'LOADING') {
        requestRef.current?.abort();
        audio.pause();
        setStatus((value) => value === 'loading' ? 'paused' : value);
      }
    });
    return () => {
      unsubscribe(); requestRef.current?.abort();
      audio.onplay = audio.onpause = audio.ontimeupdate = audio.onended = audio.onerror = null;
      audio.pause(); audio.removeAttribute('src'); audio.load();
      entries.forEach((entry) => URL.revokeObjectURL(entry.url));
      entries.clear();
    };
  }, []);

  const play = async (nextTrack) => {
    const audio = audioRef.current;
    if (activeRef.current === nextTrack.id && status === 'playing') { audio.pause(); return; }
    if (activeRef.current === nextTrack.id && status === 'loading') return;
    requestRef.current?.abort();
    const controller = new AbortController(); requestRef.current = controller;
    audio.pause(); audioService.stop();
    const changed = activeRef.current !== nextTrack.id;
    activeRef.current = nextTrack.id;
    setTrack(nextTrack); setError(''); setStatus('loading'); setMiniHidden(false);
    if (changed) { setPosition(0); setDuration(0); setPeaks([]); }
    try {
      let entry = cache.current.get(nextTrack.id);
      if (!entry) {
        const result = await loadGuideAudio(nextTrack.text, controller.signal);
        controller.signal.throwIfAborted();
        entry = { ...result, url: URL.createObjectURL(result.blob) };
        cache.current.set(nextTrack.id, entry);
      }
      controller.signal.throwIfAborted();
      if (audio.getAttribute('src') !== entry.url) audio.src = entry.url;
      setDuration(entry.duration); setPeaks(entry.peaks);
      if (status === 'ended' || audio.ended) audio.currentTime = 0;
      audio.playbackRate = rate;
      await audio.play();
    } catch (err) {
      if (controller.signal.aborted) return;
      setStatus('error'); setError(err.name === 'NotAllowedError' ? 'Âm thanh đã sẵn sàng. Chạm nút phát để nghe.' : 'Chưa tải được giọng đọc. Kiểm tra kết nối rồi thử lại; bạn vẫn có thể đọc nội dung bên dưới.');
    }
  };
  const seek = (value) => {
    if (!duration || !audioRef.current?.src) return;
    const next = Math.min(duration, Math.max(0, value));
    audioRef.current.currentTime = next; setPosition(next);
  };
  const changeRate = (value) => { setRate(value); if (audioRef.current) audioRef.current.playbackRate = value; };
  const value = { track, status, position, duration, rate, peaks, error, play, seek, changeRate };
  return <ListeningContext.Provider value={value}>
    {children}
    {track && !miniHidden && ['playing', 'paused', 'loading', 'error'].includes(status) && createPortal(
      <aside className="listening-mini" aria-label="Trình phát thu nhỏ">
        <GuideCover kind={track.cover} decorative />
        <div className="mini-track-info"><span>{status === 'playing' ? 'ĐANG NGHE CÙNG IRIS' : status === 'loading' ? 'ĐANG CHUẨN BỊ GIỌNG ĐỌC' : status === 'error' ? 'CHẠM PHÁT ĐỂ THỬ LẠI' : 'ĐÃ TẠM DỪNG'}</span><strong>{track.title}</strong></div>
        <PlayerControls compact />
        <button className="listen-icon-button" aria-label="Dừng và đóng trình phát" onClick={() => { requestRef.current?.abort(); audioRef.current.pause(); setStatus('paused'); setMiniHidden(true); }}><AudioIcon name="close" /></button>
      </aside>, document.body)}
  </ListeningContext.Provider>;
}

function PlayerControls({ compact = false, guide }) {
  const player = useContext(ListeningContext);
  const active = !guide || player.track?.id === guide.id;
  const { rate, play, seek, changeRate } = player;
  const track = guide || player.track;
  const status = active ? player.status : 'idle';
  const position = active ? player.position : 0;
  const duration = active ? player.duration : 0;
  const id = useId();
  const loading = status === 'loading';
  return <div className={`listen-controls ${compact ? 'listen-controls-compact' : ''}`}>
    <div className="listen-transport">
      <button className="listen-icon-button" disabled={!duration || loading} onClick={() => seek(position - 10)} aria-label="Tua lùi 10 giây"><AudioIcon name="back" /></button>
      <button className="listen-play" disabled={loading} onClick={() => play(track)} aria-label={status === 'playing' ? 'Tạm dừng' : status === 'error' ? 'Thử phát lại' : 'Phát bài nghe'}><AudioIcon name={status === 'playing' ? 'pause' : 'play'} /></button>
      <button className="listen-icon-button" disabled={!duration || loading} onClick={() => seek(position + 10)} aria-label="Tua tiến 10 giây"><AudioIcon name="forward" /></button>
    </div>
    <div className="listen-timeline"><label className="sr-only" htmlFor={id}>Vị trí phát</label><input id={id} type="range" min="0" max={duration || 1} step="0.1" value={position} disabled={!duration || loading} onChange={(event) => seek(Number(event.target.value))} aria-valuetext={`${time(position)} trên ${time(duration)}`} /><div className="listen-times"><span>{time(position)}</span><span>{duration ? time(duration) : loading ? 'Đang tải…' : '—:—'}</span></div></div>
    <label className="listen-speed"><span className="sr-only">Tốc độ phát</span><select value={rate} onChange={(event) => changeRate(Number(event.target.value))}>{[0.75, 1, 1.25, 1.5].map((speed) => <option key={speed} value={speed}>{speed}×</option>)}</select></label>
  </div>;
}

export default function AudioGuide({ guideId, compact = false }) {
  const guide = listeningGuides[guideId];
  const player = useContext(ListeningContext);
  const active = player.track?.id === guide.id;
  return <article className={`listening-card ${compact ? 'listening-card-compact' : ''}`}>
    <GuideCover kind={guide.cover} />
    <div className="listening-card-body">
      <div className="listening-meta"><span className="listen-chip">{guide.topic}</span><span>Giọng đọc Iris · Tiếng Việt</span></div>
      <h3>{guide.title}</h3><p>{guide.description}</p>
      <div className="listen-waveform" aria-hidden="true">{Array.from({ length: 56 }, (_, i) => <i key={i} style={{ height: `${12 + ((active ? player.peaks[i] : undefined) ?? (Math.sin(i * 1.9) ** 2 * .6)) * 28}px`, opacity: active && player.duration > 0 && i / 56 < player.position / player.duration ? 1 : .3 }} />)}</div>
      <PlayerControls guide={guide} />
      <p className="listen-status" role="status">{!active ? 'Sẵn sàng nghe cùng Iris' : player.error || (player.status === 'loading' ? 'Đang chuẩn bị giọng đọc…' : player.status === 'playing' ? 'Đang phát' : player.status === 'ended' ? 'Đã nghe xong' : 'Đã tạm dừng')}</p>
      <details className="listen-transcript"><summary>Đọc nội dung bài nghe</summary><p>{guide.text}</p></details>
    </div>
  </article>;
}

export function HomeListeningSection() {
  const [filter, setFilter] = useState('Tất cả');
  const guides = ['home', 'care', 'family'];
  return <section className="home-listening-section" aria-labelledby="home-listening-title">
    <div className="listening-section-heading"><div><span className="section-eyebrow">MỘT CHÚT LẮNG NGHE, THÊM NHIỀU THẤU HIỂU</span><h2 id="home-listening-title">Chăm sóc mắt, theo cách nhẹ nhàng.</h2></div><p>Không cần đọc nhiều.<br />Để Iris đồng hành cùng bạn.</p></div>
    <div className="listening-filters" aria-label="Lọc chủ đề bài nghe">{['Tất cả', 'Bắt đầu', 'Chăm sóc mắt', 'Gia đình'].map((topic) => <button key={topic} aria-pressed={filter === topic} onClick={() => setFilter(topic)}>{topic}</button>)}</div>
    <div className="home-listening-grid">{guides.filter((id) => filter === 'Tất cả' || listeningGuides[id].topic === filter).map((id) => <AudioGuide key={id} guideId={id} />)}</div>
  </section>;
}

import React from 'react';
import { positionGuideVideo } from '../../content/positionGuideVideo';
import './positionGuideVideo.css';

export default function PositionGuideVideo({
  src = positionGuideVideo.src,
  poster = positionGuideVideo.poster,
}) {
  const [failedSrc, setFailedSrc] = React.useState(null);
  const failed = Boolean(src) && failedSrc === src;

  return (
    <section className="position-guide-video" aria-label="Video hướng dẫn">
      <h3>Video hướng dẫn</h3>
      {src && !failed ? (
        <video key={src} src={src} poster={poster || undefined} controls playsInline
          preload="metadata" aria-label="Video hướng dẫn chuẩn bị kiểm tra"
          onError={() => setFailedSrc(src)} />
      ) : (
        <div className="position-guide-video-placeholder">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <rect x="2" y="4" width="20" height="16" rx="4" />
            <path d="m10 8 6 4-6 4Z" />
          </svg>
          <span>{failed ? 'Chưa tải được video' : 'Video sẽ được cập nhật'}</span>
        </div>
      )}
    </section>
  );
}

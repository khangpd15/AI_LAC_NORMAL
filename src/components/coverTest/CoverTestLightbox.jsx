import React, { useEffect, useRef, useCallback } from 'react';

/**
 * CoverTestLightbox
 * Modal xem ảnh crop mắt phóng to với hỗ trợ vuốt chạm (touch swipe) và phím mũi tên.
 * 
 * Ràng buộc:
 * - Chỉ sử dụng ObjectURL có sẵn trong bộ nhớ client.
 * - Không gửi bất kỳ dữ liệu nào ra mạng hay lưu trữ bền vững.
 */
export default function CoverTestLightbox({
  isOpen,
  items = [],
  currentIndex = 0,
  onClose,
  onNavigate,
}) {
  const touchStartXRef = useRef(null);
  const touchDeltaXRef = useRef(0);

  const currentItem = items[currentIndex] || null;

  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose?.();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onNavigate?.(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < items.length - 1) {
        onNavigate?.(currentIndex + 1);
      }
    },
    [isOpen, currentIndex, items.length, onClose, onNavigate]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      // Khóa scroll trang khi mở modal
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchDeltaXRef.current = 0;
  };

  const handleTouchMove = (e) => {
    if (touchStartXRef.current !== null) {
      touchDeltaXRef.current = e.touches[0].clientX - touchStartXRef.current;
    }
  };

  const handleTouchEnd = () => {
    const deltaX = touchDeltaXRef.current;
    const threshold = 45; // pixel để kích hoạt lật ảnh
    if (deltaX > threshold && currentIndex > 0) {
      onNavigate?.(currentIndex - 1);
    } else if (deltaX < -threshold && currentIndex < items.length - 1) {
      onNavigate?.(currentIndex + 1);
    }
    touchStartXRef.current = null;
    touchDeltaXRef.current = 0;
  };

  if (!isOpen || !currentItem) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Xem ảnh phóng to vùng mắt lúc bỏ che"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(10, 25, 30, 0.88)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 12px 24px 12px',
        color: '#ffffff',
        fontFamily: 'var(--font-sans)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Header */}
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px',
        }}
      >
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
            {currentItem.title || `Lần ${currentItem.slotIndex + 1}`}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-soft-mint)', marginTop: '2px' }}>
            {currentItem.sideLabel} {currentItem.timingLabel ? `· ${currentItem.timingLabel}` : ''}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng cửa sổ xem ảnh"
          style={{
            background: 'rgba(255, 255, 255, 0.16)',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            color: '#ffffff',
            fontSize: '1.25rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>

      {/* Main Image Container */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          maxWidth: '480px',
          padding: '12px 0',
        }}
      >
        <div
          style={{
            background: '#000000',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '2px solid var(--color-mint)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
            maxHeight: '60vh',
            maxWidth: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={currentItem.url}
            alt={currentItem.sideLabel || 'Ảnh mống mắt'}
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: '58vh',
              objectFit: 'contain',
              display: 'block',
              imageRendering: 'crisp-edges',
            }}
          />
        </div>

        {/* Caption & detail info */}
        <div
          style={{
            marginTop: '12px',
            textAlign: 'center',
            fontSize: '0.84rem',
            color: '#d0e5e5',
            background: 'rgba(0, 0, 0, 0.4)',
            padding: '6px 14px',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          <span>Mắt được bỏ che: <strong>{currentItem.uncoveredEye === 'LEFT' ? 'Trái' : 'Phải'}</strong></span>
          {currentItem.cropDim && (
            <span style={{ marginLeft: '10px', opacity: 0.85 }}>({currentItem.cropDim})</span>
          )}
        </div>
      </div>

      {/* Bottom Navigation Controls */}
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
        }}
      >
        <button
          type="button"
          onClick={() => currentIndex > 0 && onNavigate?.(currentIndex - 1)}
          disabled={currentIndex <= 0}
          aria-label="Xem ảnh trước"
          style={{
            background: currentIndex <= 0 ? 'rgba(255,255,255,0.08)' : 'var(--color-deep-teal)',
            color: currentIndex <= 0 ? 'rgba(255,255,255,0.3)' : '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '24px',
            padding: '8px 16px',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: currentIndex <= 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          ‹ Trước
        </button>

        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-soft-mint)' }}>
          {currentIndex + 1} / {items.length}
        </span>

        <button
          type="button"
          onClick={() => currentIndex < items.length - 1 && onNavigate?.(currentIndex + 1)}
          disabled={currentIndex >= items.length - 1}
          aria-label="Xem ảnh sau"
          style={{
            background: currentIndex >= items.length - 1 ? 'rgba(255,255,255,0.08)' : 'var(--color-deep-teal)',
            color: currentIndex >= items.length - 1 ? 'rgba(255,255,255,0.3)' : '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '24px',
            padding: '8px 16px',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: currentIndex >= items.length - 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          Sau ›
        </button>
      </div>
    </div>
  );
}

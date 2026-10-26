import React, { useState } from 'react';

/**
 * CoverTestLiveThumbnailStrip
 * Dải thumbnail nhỏ gọn hiển thị realtime tiến độ chụp 6 cặp ảnh lúc bỏ che.
 * 
 * Thiết kế:
 * - Nằm nổi ở góc dưới khung camera, không che khuất vùng khuôn mặt và Fixation Target.
 * - Có nút thu gọn/mở rộng (toggle).
 * - Tối ưu mobile (~390px), zero overhead với luồng camera 60 FPS.
 */
export default function CoverTestLiveThumbnailStrip({
  slots = [],
  activeSlotIndex = 0,
  coverState = 'IDLE',
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Không hiển thị nếu đang ở giai đoạn chuẩn bị camera ban đầu
  if (['IDLE', 'PREPARING', 'BASELINE', 'BASELINE_RETRY'].includes(coverState)) {
    return null;
  }

  const capturedCount = slots.filter((s) => s.status === 'CAPTURED').length;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '72px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        width: 'calc(100% - 24px)',
        maxWidth: '380px',
        background: 'rgba(0, 35, 40, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderRadius: '14px',
        border: '1px solid rgba(0, 171, 155, 0.35)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        padding: '6px 10px',
        fontFamily: 'var(--font-sans)',
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
    >
      {/* Strip Header with Collapse Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: isCollapsed ? 0 : '6px',
          fontSize: '0.74rem',
          color: 'var(--color-soft-mint)',
          fontWeight: 600,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span>📸 Ảnh bỏ che:</span>
          <strong style={{ color: capturedCount > 0 ? '#81c784' : '#ffffff' }}>
            {capturedCount}/6 cặp
          </strong>
        </span>

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Mở rộng dải ảnh thu nhỏ' : 'Thu gọn dải ảnh thu nhỏ'}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-soft-mint)',
            cursor: 'pointer',
            fontSize: '0.72rem',
            padding: '2px 6px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          <span>{isCollapsed ? 'Hiện dải' : 'Thu gọn'}</span>
          <span>{isCollapsed ? '▲' : '▼'}</span>
        </button>
      </div>

      {/* 6 Thumbnail Slots Row */}
      {!isCollapsed && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '6px',
          }}
        >
          {slots.map((slot, idx) => {
            const isCaptured = slot.status === 'CAPTURED';
            const isActive = idx === activeSlotIndex;
            const eyeLabel = slot.uncoveredEye === 'LEFT' ? 'T' : 'P';

            return (
              <div
                key={slot.slotIndex}
                title={`Lần ${idx + 1}: Bỏ che Mắt ${slot.uncoveredEye === 'LEFT' ? 'Trái' : 'Phải'}${
                  isCaptured ? ' (Đã chụp)' : isActive ? ' (Đang đo)' : ' (Chờ)'
                }`}
                style={{
                  height: '38px',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  background: isCaptured ? '#000000' : 'rgba(255, 255, 255, 0.06)',
                  border: isCaptured
                    ? '1.5px solid var(--color-mint)'
                    : isActive
                    ? '1.5px solid var(--color-soft-amber)'
                    : '1px dashed rgba(255, 255, 255, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  boxShadow: isActive ? '0 0 8px rgba(242, 197, 109, 0.4)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {isCaptured && (slot.previewUrl || slot.leftUrl) ? (
                  <>
                    <img
                      src={slot.previewUrl || slot.leftUrl}
                      alt={`Lần ${idx + 1}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '1px',
                        right: '1px',
                        background: '#2e7d32',
                        color: '#ffffff',
                        fontSize: '0.55rem',
                        fontWeight: 700,
                        borderRadius: '50%',
                        width: '11px',
                        height: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                      }}
                    >
                      ✓
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.62rem',
                      color: isActive ? 'var(--color-soft-amber)' : 'rgba(255, 255, 255, 0.45)',
                      lineHeight: 1.1,
                      fontWeight: 600,
                    }}
                  >
                    <span>L{idx + 1}</span>
                    <span style={{ fontSize: '0.54rem', opacity: 0.8 }}>{eyeLabel}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

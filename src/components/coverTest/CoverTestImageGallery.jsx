import React, { useState } from 'react';

/**
 * CoverTestImageGallery
 * Thư viện hiển thị lưới 6 cặp ảnh mắt lúc bỏ che trên màn hình kết quả.
 * 
 * Tính năng:
 * 1. Lưới 6 lượt đo (Lần 1..6: Chu kỳ 1-L, 1-R, 2-L, 2-R, 3-L, 3-R).
 * 2. Mỗi lượt hiển thị ảnh mắt trái & mắt phải hoặc placeholder nếu chưa chụp được.
 * 3. Chạm vào ảnh để phóng to (Lightbox).
 * 4. Chế độ Debug (chỉ hiện khi bật cờ): xem lý do từ chối (armed, headPose, timing, opposite eye).
 * 5. Thông điệp bảo mật client-only chuẩn theo yêu cầu.
 */
export default function CoverTestImageGallery({
  slots = [],
  capturedPairs = 0,
  onOpenLightbox,
}) {
  const [showDebug, setShowDebug] = useState(false);

  // Tạo danh sách ảnh phẳng để Lightbox điều hướng lần lượt
  const flatLightboxItems = [];
  slots.forEach((slot, sIdx) => {
    if (slot.status === 'CAPTURED') {
      if (slot.leftUrl) {
        flatLightboxItems.push({
          slotIndex: sIdx,
          side: 'left',
          sideLabel: 'Mắt Trái (OS)',
          url: slot.leftUrl,
          title: `Lần ${sIdx + 1}: Chu kỳ ${slot.cycle}`,
          timingLabel: slot.timingOffsetMs ? `Bỏ che +${slot.timingOffsetMs}ms` : 'Bỏ che',
          uncoveredEye: slot.uncoveredEye,
          cropDim: slot.cropDims?.left ? `${slot.cropDims.left.w}×${slot.cropDims.left.h}px` : null,
        });
      }
      if (slot.rightUrl) {
        flatLightboxItems.push({
          slotIndex: sIdx,
          side: 'right',
          sideLabel: 'Mắt Phải (OD)',
          url: slot.rightUrl,
          title: `Lần ${sIdx + 1}: Chu kỳ ${slot.cycle}`,
          timingLabel: slot.timingOffsetMs ? `Bỏ che +${slot.timingOffsetMs}ms` : 'Bỏ che',
          uncoveredEye: slot.uncoveredEye,
          cropDim: slot.cropDims?.right ? `${slot.cropDims.right.w}×${slot.cropDims.right.h}px` : null,
        });
      }
    }
  });

  const getReasonLabel = (slot) => {
    const r = slot.rejectionReason || slot.reason;
    if (r === 'CHUA_CHE_DU_KIN' || r === 'ARMED_FALSE') {
      return 'Tay chưa che đủ kín mống mắt (cần che tối ≥ 120ms)';
    }
    if (r === 'QUA_CUA_SO_THOI_GIAN' || r === 'WINDOW_EXPIRED') {
      return 'Hạ tay chậm quá cửa sổ xác nhận (1.8s)';
    }
    if (r === 'NGHIENG_DAU_KHI_BO_CHE' || r === 'HEAD_POSE_INVALID') {
      return 'Đầu nghiêng quá góc cho phép khi bỏ che';
    }
    if (r === 'MAT_KHUON_MAT' || r === 'NO_FACE') {
      return 'Mất nhận diện khuôn mặt lúc bỏ che';
    }
    if (r === 'CHUA_MO_MAT_RO') {
      return 'Chưa mở to hai mắt sau khi bỏ che (chớp mắt)';
    }
    return 'Chưa xác nhận bỏ che thành công';
  };

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--color-soft-mint)',
        borderRadius: '14px',
        padding: '16px',
        marginBottom: '20px',
        maxWidth: '640px',
        margin: '0 auto 20px auto',
        textAlign: 'left',
        boxShadow: 'var(--shadow-sm)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-deep-teal)' }}>
            📷 Thư viện ảnh mống mắt lúc bỏ che
          </span>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Đã chụp được <strong>{capturedPairs}/6</strong> cặp ảnh hai mắt
          </div>
        </div>

        {/* Debug Toggle */}
        <button
          type="button"
          onClick={() => setShowDebug(!showDebug)}
          style={{
            background: showDebug ? 'var(--color-pale-teal)' : 'none',
            border: `1px solid ${showDebug ? 'var(--color-mint)' : 'var(--border-subtle)'}`,
            borderRadius: '20px',
            padding: '4px 10px',
            fontSize: '0.75rem',
            color: showDebug ? 'var(--color-deep-teal)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>🛠️</span>
          <span>{showDebug ? 'Ẩn Debug' : 'Xem Debug lý do'}</span>
        </button>
      </div>

      {/* Grid of 6 Slots (Mobile: 1 or 2 cols, Desktop: 2 or 3 cols) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '12px',
        }}
      >
        {slots.map((slot, sIdx) => {
          const isCaptured = slot.status === 'CAPTURED';
          const uncoveredEyeText = slot.uncoveredEye === 'LEFT' ? 'Mắt Trái' : 'Mắt Phải';

          return (
            <div
              key={slot.slotIndex ?? sIdx}
              style={{
                background: isCaptured ? 'var(--color-warm-white)' : 'rgba(240, 244, 244, 0.6)',
                border: isCaptured ? '1px solid var(--color-mint)' : '1.5px dashed rgba(0, 84, 93, 0.25)',
                borderRadius: '10px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              {/* Slot Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  fontSize: '0.78rem',
                }}
              >
                <span style={{ fontWeight: 700, color: 'var(--color-deep-teal)' }}>
                  Lần {sIdx + 1} · Chu kỳ {slot.cycle}
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 600,
                    background: isCaptured ? 'rgba(0, 171, 155, 0.15)' : 'rgba(0, 0, 0, 0.05)',
                    color: isCaptured ? 'var(--color-deep-green)' : 'var(--text-muted)',
                  }}
                >
                  Bỏ che: {uncoveredEyeText}
                </span>
              </div>

              {/* Slot Body: Image Pair OR Placeholder */}
              {isCaptured && slot.leftUrl && slot.rightUrl ? (
                <div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      // Tìm vị trí ảnh mắt vừa bỏ che trong flat list
                      const targetSide = slot.uncoveredEye === 'LEFT' ? 'left' : 'right';
                      const targetIdx = flatLightboxItems.findIndex(
                        (item) => item.slotIndex === sIdx && item.side === targetSide
                      );
                      onOpenLightbox?.(targetIdx >= 0 ? targetIdx : 0, flatLightboxItems);
                    }}
                    title="Chạm để phóng to xem chi tiết"
                  >
                    {/* Left Eye Crop */}
                    <div
                      style={{
                        position: 'relative',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        border: slot.uncoveredEye === 'LEFT' ? '2px solid var(--color-mint)' : '1px solid #d0e0e0',
                        background: '#000000',
                      }}
                    >
                      <img
                        src={slot.leftUrl}
                        alt="Mắt Trái"
                        style={{ width: '100%', height: '56px', objectFit: 'cover', display: 'block' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: 'rgba(0,0,0,0.6)',
                          color: '#ffffff',
                          fontSize: '0.62rem',
                          padding: '1px 4px',
                          textAlign: 'center',
                          fontWeight: slot.uncoveredEye === 'LEFT' ? 700 : 400,
                        }}
                      >
                        Trái {slot.uncoveredEye === 'LEFT' ? '• Bỏ che' : ''}
                      </div>
                    </div>

                    {/* Right Eye Crop */}
                    <div
                      style={{
                        position: 'relative',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        border: slot.uncoveredEye === 'RIGHT' ? '2px solid var(--color-mint)' : '1px solid #d0e0e0',
                        background: '#000000',
                      }}
                    >
                      <img
                        src={slot.rightUrl}
                        alt="Mắt Phải"
                        style={{ width: '100%', height: '56px', objectFit: 'cover', display: 'block' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: 'rgba(0,0,0,0.6)',
                          color: '#ffffff',
                          fontSize: '0.62rem',
                          padding: '1px 4px',
                          textAlign: 'center',
                          fontWeight: slot.uncoveredEye === 'RIGHT' ? 700 : 400,
                        }}
                      >
                        Phải {slot.uncoveredEye === 'RIGHT' ? '• Bỏ che' : ''}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '6px',
                      fontSize: '0.72rem',
                      color: 'var(--color-deep-green)',
                      fontWeight: 600,
                    }}
                  >
                    <span>⏱️ Bỏ che +{slot.timingOffsetMs || 0}ms</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>🔍 Chạm để phóng to</span>
                  </div>
                </div>
              ) : (
                /* Placeholder when not captured */
                <div
                  style={{
                    padding: '14px 8px',
                    textAlign: 'center',
                    color: 'var(--text-dim)',
                  }}
                >
                  <div style={{ fontSize: '1.25rem', marginBottom: '4px', opacity: 0.55 }}>📷🚫</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Chưa chụp được
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#b26a00', marginTop: '3px', lineHeight: 1.3 }}>
                    {getReasonLabel(slot)}
                  </div>
                </div>
              )}

              {/* Debug Breakdown (Visible when toggle is ON) */}
              {showDebug && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '6px 8px',
                    background: 'rgba(0, 0, 0, 0.04)',
                    borderTop: '1px dashed var(--border-subtle)',
                    borderRadius: '4px',
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.4,
                  }}
                >
                  <div>
                    • <strong>Armed:</strong>{' '}
                    <span style={{ color: slot.debugInfo?.armed ? 'green' : '#c62828' }}>
                      {slot.debugInfo?.armed ? '✅ Đạt (che ≥120ms)' : '❌ Chưa (chưa che kín)'}
                    </span>
                  </div>
                  <div>
                    • <strong>Góc đầu:</strong>{' '}
                    <span style={{ color: slot.debugInfo?.headPoseValid !== false ? 'green' : '#c62828' }}>
                      {slot.debugInfo?.headPoseValid !== false ? '✅ Thẳng' : '⚠️ Nghiêng/Quay đầu'}
                    </span>
                  </div>
                  <div>
                    • <strong>Mắt đối diện:</strong>{' '}
                    <span>{slot.debugInfo?.oppositeEyeState || 'Chưa ghi nhận'}</span>
                  </div>
                  {slot.debugInfo?.timingOffsetMs !== undefined && (
                    <div>
                      • <strong>Thời điểm mở:</strong> +{slot.debugInfo.timingOffsetMs}ms{' '}
                      {slot.debugInfo.timingOffsetMs > 1800 ? '(❌ Quá 1800ms)' : '(✅ Trong cửa sổ)'}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mandatory Privacy Notice */}
      <div
        style={{
          marginTop: '14px',
          paddingTop: '10px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.74rem',
          color: 'var(--text-dim)',
          textAlign: 'center',
          lineHeight: 1.4,
        }}
      >
        🔒 <em>Ảnh hiển thị trên thiết bị của bạn và bị xóa khỏi bộ nhớ trình duyệt khi đóng trang hoặc đo lại.</em>
      </div>
    </div>
  );
}

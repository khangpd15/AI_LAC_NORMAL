import React, { useState } from 'react';
import { COVER_VISIBILITY_REASON_LABELS } from '../../constants/coverVisibilityReasons';

const formatMetric = (value) => Number.isFinite(value) ? value.toFixed(2) : '--';

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
      return 'Chưa xác nhận được cả hai mắt rõ liên tục sau khi bỏ che; xem lý do nhận diện bên dưới';
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
                    padding: '8px',
                    background: 'rgba(0, 0, 0, 0.04)',
                    borderTop: '1px dashed var(--border-subtle)',
                    borderRadius: '6px',
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.45,
                  }}
                >
                  <div style={{ marginBottom: '4px' }}>
                    • <strong>Armed:</strong>{' '}
                    <span style={{ color: slot.debugInfo?.diag?.armedEverTrue || slot.debugInfo?.armed ? '#1b5e20' : '#c62828', fontWeight: 600 }}>
                      {slot.debugInfo?.diag?.armedEverTrue || slot.debugInfo?.armed ? '✅ Đạt (che ≥120ms)' : '❌ Chưa (chưa che kín)'}
                    </span>
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    • <strong>Góc đầu:</strong>{' '}
                    <span style={{ color: slot.debugInfo?.diag?.headPoseInvalidEver ? '#c62828' : '#1b5e20', fontWeight: 600 }}>
                      {slot.debugInfo?.diag?.headPoseInvalidEver ? '⚠️ Nghiêng/Quay đầu' : '✅ Thẳng'}
                    </span>
                  </div>

                  {/* Yêu cầu 5: Hiển thị ảnh crop kèm nhãn visibility để tự nhìn xem có đúng là mắt không */}
                  {slot.debugCropUrl && (
                    <div
                      style={{
                        margin: '8px 0',
                        padding: '6px',
                        background: '#ffffff',
                        borderRadius: '6px',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '4px',
                        }}
                      >
                        <span style={{ fontWeight: 700, color: 'var(--color-deep-teal)', fontSize: '0.7rem' }}>
                          📸 Crop mắt ghi nhận (+{slot.debugCropT || slot.timingOffsetMs || 0}ms):
                        </span>
                        <span
                          style={{
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '0.64rem',
                            fontWeight: 700,
                            background: slot.debugCropMetrics?.visibility === 'VISIBLE' ? 'rgba(46, 125, 50, 0.15)' : 'rgba(230, 81, 0, 0.15)',
                            color: slot.debugCropMetrics?.visibility === 'VISIBLE' ? '#1b5e20' : '#e65100',
                          }}
                        >
                          {slot.debugCropMetrics?.visibility || 'UNKNOWN'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <img
                          src={slot.debugCropUrl}
                          alt="Ảnh crop mắt kiểm tra"
                          style={{
                            width: '74px',
                            height: '44px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            border: '1px solid #bbb',
                            background: '#000000',
                          }}
                        />
                        <div style={{ fontSize: '0.62rem', lineHeight: 1.35, color: '#334155' }}>
                          <div>Lý do: <strong>{COVER_VISIBILITY_REASON_LABELS[slot.debugCropMetrics?.visibilityReason] || 'Phiên cũ chưa ghi lý do chi tiết'}</strong></div>
                          <div>Mẫu chuẩn: <strong>{slot.debugCropMetrics?.baselineSamples ?? '--'}/{slot.debugCropMetrics?.requiredBaselineSamples ?? 5}</strong> tối thiểu</div>
                          <div>Khớp cấu trúc: <strong>{formatMetric(slot.debugCropMetrics?.appearance?.correlation)}</strong> (tối thiểu 0.65)</div>
                          <div>minLum: <strong>{formatMetric(slot.debugCropMetrics?.minLum)}</strong> (so sánh với mẫu chuẩn và độ sáng)</div>
                          <div>contrast: <strong>{slot.debugCropMetrics?.pupilContrast ?? '--'}</strong> | dynRange: <strong>{slot.debugCropMetrics?.dynamicRange ?? '--'}</strong></div>
                          <div>aperture: <strong>{slot.debugCropMetrics?.aperture ?? '--'}</strong> | skinRatio: <strong>{slot.debugCropMetrics?.skinRatio ?? '--'}</strong></div>
                          <div>lumiShift: <strong>{slot.debugCropMetrics?.isLuminanceShift ? 'LỆCH SÁNG' : 'Chuẩn'}</strong></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Phân phối thống kê Min / Med / Max của slot này */}
                  {slot.debugInfo?.metricsStats?.uncoveredEye?.minLum && (
                    <div style={{ marginTop: '6px', fontSize: '0.62rem', color: '#475569' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-deep-teal)' }}>
                        📊 Thống kê {slot.debugInfo.metricsStats.rawFrames.length} frames (Uncover 1.8s):
                      </div>
                      <div>• minLum: {slot.debugInfo.metricsStats.uncoveredEye.minLum.min} / {slot.debugInfo.metricsStats.uncoveredEye.minLum.median} / {slot.debugInfo.metricsStats.uncoveredEye.minLum.max} (Min/Med/Max)</div>
                      <div>• contrast: {slot.debugInfo.metricsStats.uncoveredEye.pupilContrast?.min} / {slot.debugInfo.metricsStats.uncoveredEye.pupilContrast?.median} / {slot.debugInfo.metricsStats.uncoveredEye.pupilContrast?.max}</div>
                      <div>• aperture: {slot.debugInfo.metricsStats.uncoveredEye.aperture?.min} / {slot.debugInfo.metricsStats.uncoveredEye.aperture?.median} / {slot.debugInfo.metricsStats.uncoveredEye.aperture?.max}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Yêu cầu 1: Bảng tổng hợp phân phối Min / Median / Max toàn bộ 6 lần đo kèm nút sao chép */}
      {showDebug && (
        <DistributionSummarySection slots={slots} />
      )}

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

function DistributionSummarySection({ slots = [] }) {
  const [copied, setCopied] = useState(false);

  const generateMarkdownTable = () => {
    let md = `### BẢNG PHÂN PHỐI CHỈ SỐ MẮT LÚC BỎ CHE (UNCOVER WINDOW 1.8s)\n`;
    md += `| Lần đo | Mắt | Số frames | minLum (Min/Med/Max) | Contrast (Min/Med/Max) | dynRange (Min/Med/Max) | Aperture (Min/Med/Max) | skinRatio (Min/Med/Max) | Nhãn crop |\n`;
    md += `|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|\n`;

    slots.forEach((s, idx) => {
      const stats = s.debugInfo?.metricsStats?.uncoveredEye;
      const count = s.debugInfo?.metricsStats?.rawFrames?.length || 0;
      const eyeText = s.uncoveredEye === 'LEFT' ? 'Trái' : 'Phải';
      const cropLabel = s.debugCropMetrics?.visibility || s.status;
      if (stats?.minLum) {
        md += `| Lần ${idx + 1} (CK${s.cycle}) | ${eyeText} | ${count} | ${stats.minLum.min} / ${stats.minLum.median} / ${stats.minLum.max} | ${stats.pupilContrast?.min} / ${stats.pupilContrast?.median} / ${stats.pupilContrast?.max} | ${stats.dynamicRange?.min} / ${stats.dynamicRange?.median} / ${stats.dynamicRange?.max} | ${stats.aperture?.min} / ${stats.aperture?.median} / ${stats.aperture?.max} | ${stats.skinRatio?.min} / ${stats.skinRatio?.median} / ${stats.skinRatio?.max} | ${cropLabel} |\n`;
      } else {
        md += `| Lần ${idx + 1} (CK${s.cycle}) | ${eyeText} | 0 | -- | -- | -- | -- | -- | CHƯA CÓ |\n`;
      }
    });

    return md;
  };

  const handleCopy = () => {
    const text = generateMarkdownTable();
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  return (
    <div
      style={{
        marginTop: '16px',
        padding: '12px',
        background: '#f8fafc',
        borderRadius: '10px',
        border: '1px solid #cbd5e1',
        fontSize: '0.74rem',
        color: '#1e293b',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
        <strong style={{ color: 'var(--color-deep-teal)', fontSize: '0.82rem' }}>
          📊 Phân phối giá trị đo đạc 6 lượt (Uncover Window)
        </strong>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            background: copied ? '#1b5e20' : 'var(--color-deep-teal)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {copied ? '✅ Đã sao chép Markdown!' : '📋 Sao chép bảng Markdown'}
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#e2e8f0', color: '#334155' }}>
              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>Lần đo</th>
              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>Mắt</th>
              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>minLum (Min/Med/Max)</th>
              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>Contrast</th>
              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>Aperture</th>
              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>Nhãn crop</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s, idx) => {
              const stats = s.debugInfo?.metricsStats?.uncoveredEye;
              const eyeText = s.uncoveredEye === 'LEFT' ? 'Trái' : 'Phải';
              const cropLabel = s.debugCropMetrics?.visibility || s.status;
              return (
                <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f1f5f9' }}>
                  <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 600 }}>Lần {idx + 1}</td>
                  <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>{eyeText}</td>
                  <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>
                    {stats?.minLum ? `${stats.minLum.min} / ${stats.minLum.median} / ${stats.minLum.max}` : '--'}
                  </td>
                  <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>
                    {stats?.pupilContrast ? `${stats.pupilContrast.min} / ${stats.pupilContrast.median} / ${stats.pupilContrast.max}` : '--'}
                  </td>
                  <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>
                    {stats?.aperture ? `${stats.aperture.min} / ${stats.aperture.median} / ${stats.aperture.max}` : '--'}
                  </td>
                  <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 600, color: cropLabel === 'VISIBLE' ? '#1b5e20' : '#b45309' }}>
                    {cropLabel}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: '6px', fontSize: '0.64rem', color: '#64748b' }}>
        * Dữ liệu được đo đạc và tính toán trực tiếp từ camera client, không qua mạng hay máy chủ.
      </div>
    </div>
  );
}

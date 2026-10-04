import React, { useState } from 'react';
import {
  COVER_TEST_VERDICTS,
  OVERALL_SCREENING_STATUS,
} from '../../constants/binocularScreeningConfig.js';

// ---------------------------------------------------------------------------
// Status presentation mapping (icon, colour class, emoji)
// ---------------------------------------------------------------------------
const STATUS_PRESENTATION = {
  [OVERALL_SCREENING_STATUS.SCREENING_CLEAR]: {
    emoji: '🟢',
    icon: '✓',
    className: 'final-result-banner final-result-banner--clear',
    badgeClass: 'badge-clear',
    label: 'Chưa ghi nhận dấu hiệu bất thường',
  },
  [OVERALL_SCREENING_STATUS.SCREENING_ATTENTION]: {
    emoji: '🟡',
    icon: '!',
    className: 'final-result-banner final-result-banner--attention',
    badgeClass: 'badge-attention',
    label: 'Cần đánh giá thêm',
  },
  [OVERALL_SCREENING_STATUS.SCREENING_INCONCLUSIVE]: {
    emoji: '⚪',
    icon: '?',
    className: 'final-result-banner final-result-banner--inconclusive',
    badgeClass: 'badge-inconclusive',
    label: 'Chưa đủ dữ liệu',
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CoverTestSummaryRow({ coverTest }) {
  const isValid = (coverTest?.quality?.status === 'GOOD' || coverTest?.quality?.status === 'OPTIMAL' || coverTest?.quality?.status === 'VALID') && (coverTest?.validCycles ?? 0) >= 2;
  const validCycles = coverTest?.validCycles ?? 0;
  const totalCycles = 3;

  return (
    <div className="final-screening-section cover-test-summary-section">
      <div className="section-header-flex">
        <h3 className="final-screening-section-title">Nghiệm pháp Che mắt (Cover Test)</h3>
        <span className={`badge ${isValid ? 'badge-clear' : 'badge-inconclusive'}`}>
          {isValid ? '✓ Đạt chất lượng' : 'Chưa đủ chu kỳ'}
        </span>
      </div>
      <p className="section-subtext" style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '12px' }}>
        Đánh giá cử động mắt theo dõi khi che và mở luân phiên từng mắt ở cự ly 33–40 cm.
      </p>
      <div className="final-screening-info-row">
        <span>Trạng thái đánh giá</span>
        <strong className={isValid ? 'text-valid' : 'text-inconclusive'}>
          {isValid ? 'Có dữ liệu hợp lệ' : 'Chưa đủ dữ liệu'}
        </strong>
      </div>
      <div className="final-screening-info-row">
        <span>Số chu kỳ đạt chuẩn (33–40 cm)</span>
        <strong>
          {validCycles} / {totalCycles} chu kỳ
        </strong>
      </div>
      <div className="final-screening-info-row">
        <span>Tín hiệu chuyển động tái định thị</span>
        <strong>
          {coverTest?.status === COVER_TEST_VERDICTS.REFIXATION_DETECTED
            ? 'Ghi nhận tín hiệu nhất quán'
            : coverTest?.status === COVER_TEST_VERDICTS.NO_SIGNIFICANT_REFIXATION
            ? 'Không ghi nhận tín hiệu đáng chú ý'
            : 'Chưa đủ dữ liệu'}
        </strong>
      </div>
    </div>
  );
}

function Gaze4DirectionsSummarySection({ gazeTracking }) {
  const captures = gazeTracking?.captures || {};
  const cap = captures.hirschberg || captures.straight || {};
  const totalCaptured = Object.values(captures).filter((c) => !!c?.image).length;
  const measurement = gazeTracking?.hirschbergResult;
  const measurementResultLabel = {
    SYSTEM_ERROR: 'Lỗi hệ thống',
    INVALID_FRAME: 'Ảnh không hợp lệ',
    MEASUREMENT_ONLY: 'Đã đo nghiên cứu',
    INCONCLUSIVE: 'Chưa đủ dữ liệu',
    NORMAL: 'Chưa ghi nhận bất thường',
    ESOTROPIA: 'Có tín hiệu cần xem xét',
    EXOTROPIA: 'Có tín hiệu cần xem xét',
  }[measurement?.result] || measurement?.result;

  return (
    <div className="final-screening-section gaze-summary-section">
      <div className="section-header-flex">
        <h3 className="final-screening-section-title">Ảnh Hirschberg (Cự ly 20–25 cm)</h3>
        <span className="badge badge-accent">
          {totalCaptured >= 1 ? '✓ Đã chụp' : 'Chưa có ảnh'}
        </span>
      </div>
      <p className="section-subtext" style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '12px' }}>
        Ảnh nhìn thẳng dùng để đo phản xạ giác mạc theo phương pháp Hirschberg nghiên cứu. Kết quả đo chưa phải chẩn đoán.
      </p>

      <div className="gaze-photos-grid">
        <div className="gaze-photo-card">
          <div className="gaze-photo-badge">
            <span className="gaze-icon">H</span>
            <span>Hirschberg</span>
          </div>
          <div className="gaze-photo-frame">
            {cap?.image ? (
              <img
                src={cap.image}
                alt="Ảnh Hirschberg"
                className="gaze-photo-img"
              />
            ) : (
              <div className="gaze-photo-placeholder">
                <span>Chưa có ảnh</span>
              </div>
            )}
          </div>
          <div className="gaze-photo-meta">
            <span className={`meta-status ${cap?.image ? 'status-ok' : 'status-missing'}`}>
              {cap?.image ? '✓ Đã chụp' : 'Chưa ghi nhận'}
            </span>
            {cap?.distanceCm && (
              <span className="meta-dist">{cap.distanceCm} cm</span>
            )}
            {measurementResultLabel && (
              <span className="meta-dist">{measurementResultLabel}</span>
            )}
          </div>
        </div>
      </div>

      {measurement?.measurements?.delta_h != null && (
        <div className="final-screening-info-row" style={{ marginTop: '12px' }}>
          <span>Chỉ số Hirschberg delta_h</span>
          <strong>{measurement.measurements.delta_h}</strong>
        </div>
      )}
      {measurement?.reasonCodes?.length > 0 && (
        <div className="final-screening-info-row">
          <span>Lý do/ghi chú</span>
          <strong>{measurement.reasonCodes.join(' | ')}</strong>
        </div>
      )}
    </div>
  );
}

function QualityWarnings({ quality }) {
  if (!quality?.warnings?.length && !quality?.reasons?.length) return null;
  return (
    <div className="final-screening-quality-warnings" aria-label="Cảnh báo chất lượng đo lường">
      {quality.reasons?.length > 0 && (
        <div className="final-screening-quality-item final-screening-quality-item--error">
          <strong>Dữ liệu không đủ:</strong>{' '}
          <span>{quality.reasons.join(' | ')}</span>
        </div>
      )}
      {quality.warnings?.length > 0 && (
        <div className="final-screening-quality-item final-screening-quality-item--warn">
          <strong>Lưu ý kỹ thuật:</strong>{' '}
          <span>{quality.warnings.join(' | ')}</span>
        </div>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Strabismus Deep Learning AI Screening Section
// ---------------------------------------------------------------------------

function StrabismusAIScreeningSection({ strabismusResult }) {
  if (!strabismusResult) return null;

  const {
    status,
    prediction,
    confidence,
    quality_score,
  } = strabismusResult;

  let statusText = 'Hình ảnh chưa đủ chất lượng để đánh giá.';
  let badgeClass = 'badge-inconclusive';
  let bannerClass = 'strabismus-banner strabismus-banner--inconclusive';
  let emoji = '⚪';
  let statusTitle = 'CHƯA ĐỦ ĐIỀU KIỆN ĐÁNH GIÁ';

  if (strabismusResult?.screening_status === 'HIRSCHBERG_MEASUREMENT_ONLY') {
    statusText = strabismusResult.message || 'Đã đo Hirschberg theo chế độ nghiên cứu; chưa có ngưỡng chẩn đoán được duyệt.';
    badgeClass = 'badge-inconclusive';
    bannerClass = 'strabismus-banner strabismus-banner--inconclusive';
    emoji = '⚪';
    statusTitle = 'HIRSCHBERG NGHIÊN CỨU';
  } else if (strabismusResult?.screening_status === 'HIRSCHBERG_AI_PREDICTION') {
    const predictedClass = prediction || strabismusResult?.hirschbergResult?.aiPrediction?.predictedClass;
    if (predictedClass === 'NORMAL') {
      statusText = 'Mô hình nghiên cứu chưa ghi nhận tín hiệu lệch rõ trên ảnh Hirschberg.';
      badgeClass = 'badge-clear';
      bannerClass = 'strabismus-banner strabismus-banner--normal';
      emoji = '🟢';
      statusTitle = 'HIRSCHBERG AI: BÌNH THƯỜNG';
    } else if (predictedClass === 'ESOTROPIA' || predictedClass === 'EXOTROPIA') {
      statusText = 'Mô hình nghiên cứu ghi nhận tín hiệu hình ảnh cần được xem xét thêm bởi chuyên gia.';
      badgeClass = 'badge-attention';
      bannerClass = 'strabismus-banner strabismus-banner--suspicious';
      emoji = '🟡';
      statusTitle = 'HIRSCHBERG AI: CẦN XEM XÉT';
    } else {
      statusText = strabismusResult.message || 'Mô hình nghiên cứu chưa trả về phân lớp Hirschberg đủ rõ.';
      badgeClass = 'badge-inconclusive';
      bannerClass = 'strabismus-banner strabismus-banner--inconclusive';
      emoji = '⚪';
      statusTitle = 'HIRSCHBERG AI: CHƯA ĐỦ DỮ LIỆU';
    }
  } else if (status === 'NORMAL') {
    statusText = 'Chưa ghi nhận tín hiệu bất thường đối xứng trục nhãn cầu qua ảnh chụp.';
    badgeClass = 'badge-clear';
    bannerClass = 'strabismus-banner strabismus-banner--normal';
    emoji = '🟢';
    statusTitle = 'BÌNH THƯỜNG';
  } else if (status === 'SUSPICIOUS') {
    statusText = 'Có tín hiệu hình ảnh cần xem xét thêm (không phải chẩn đoán mắc bệnh).';
    badgeClass = 'badge-attention';
    bannerClass = 'strabismus-banner strabismus-banner--suspicious';
    emoji = '🟡';
    statusTitle = 'CÓ TÍN HIỆU CẦN XEM XÉT';
  } else if (status === 'INCONCLUSIVE') {
    statusText = 'Chưa đủ điều kiện chất lượng ảnh hoặc chưa trích xuất được vùng hai mắt hợp lệ.';
    badgeClass = 'badge-inconclusive';
    bannerClass = 'strabismus-banner strabismus-banner--inconclusive';
    emoji = '⚪';
    statusTitle = 'CHƯA ĐỦ ĐIỀU KIỆN ĐÁNH GIÁ';
  }

  const confidencePct = confidence != null ? Math.round(confidence * 100) : null;
  const qualityPct = quality_score != null ? Math.round(quality_score * 100) : null;

  return (
    <div className="final-screening-section strabismus-ai-card" aria-label="Phân tích hình ảnh hai mắt bằng AI">
      <div className="section-header-flex">
        <div className="strabismus-ai-title-wrap">
          <h3 className="final-screening-section-title" style={{ margin: 0 }}>
            Phân tích hình ảnh (Hirschberg)
          </h3>
        </div>
        <span className={`badge ${badgeClass} strabismus-status-badge`}>
          {emoji} {statusTitle}
        </span>
      </div>

      <p className="section-subtext" style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '12px' }}>
        Đo ảnh nhìn thẳng theo phương pháp Hirschberg nghiên cứu. Ngưỡng lâm sàng vẫn là TODO_PILOT.
      </p>

      <div className={bannerClass}>
        <p className="strabismus-summary-text" style={{ margin: 0, fontSize: '0.9rem' }}>
          {statusText}
        </p>
      </div>

      <div className="strabismus-metrics-grid" style={{ marginTop: '12px' }}>
        {confidencePct != null && (
          <div className="final-screening-info-row">
            <span>Độ tự tin của mô hình (Confidence)</span>
            <strong>{confidencePct}%</strong>
          </div>
        )}
        {qualityPct != null && (
          <div className="final-screening-info-row">
            <span>Chất lượng vùng chụp (Quality Gate)</span>
            <strong>{qualityPct}%</strong>
          </div>
        )}
      </div>

      <div className="final-screening-disclaimer-box" style={{ marginTop: '12px', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#475569', lineHeight: 1.5 }}>
        <p style={{ margin: 0 }}>
          <strong>Lưu ý:</strong> Hirschberg trong phiên bản này chỉ là phép đo hình học nghiên cứu. Không dùng kết quả này như xác suất mắc bệnh hoặc chẩn đoán.
        </p>
      </div>
    </div>
  );
}

function TechnicalDetails({ coverTest, quality, gazeTracking, strabismusResult }) {
  const metricOrNull = (v, digits = 4) =>
    typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : 'null';

  return (
    <div className="final-screening-technical-details">
      <p className="final-screening-technical-notice">
        ⚠ Các chỉ số kỹ thuật dưới đây chỉ dành cho nhà nghiên cứu và chuyên gia y tế.
        Không được diễn giải các chỉ số này thành chẩn đoán bệnh lý.
      </p>

      {/* Cover Test technical */}
      <h4>Cover Test — Dữ liệu kỹ thuật</h4>
      <div className="table-responsive">
        <table className="metrics-table">
          <thead>
            <tr>
              <th>Chu kỳ</th>
              <th>Mắt che</th>
              <th>Mắt theo dõi</th>
              <th>Lệch ngang (px / norm)</th>
              <th>Lệch dọc (px / norm)</th>
              <th>Tổng độ lệch</th>
              <th>Chuẩn hóa</th>
              <th>Vận tốc đỉnh</th>
              <th>Chất lượng</th>
            </tr>
          </thead>
          <tbody>
            {(coverTest?.cycles || []).map((cycle) => {
              if (!cycle) return null;
              return [
                { eye: 'rightEye', coveredLabel: 'Trái' },
                { eye: 'leftEye', coveredLabel: 'Phải' },
              ].map(({ eye, coveredLabel }) => {
                const m = cycle[eye];
                const hStr = m ? `${metricOrNull(m?.horizontalDisplacement)} / ${metricOrNull(m?.normalizedHorizontal)}` : '--';
                const vStr = m ? `${metricOrNull(m?.verticalDisplacement)} / ${metricOrNull(m?.normalizedVertical)}` : '--';
                return (
                  <tr key={`${cycle.cycleIndex}-${eye}`}>
                    <td>{cycle.cycleIndex}</td>
                    <td>{coveredLabel}</td>
                    <td>{eye === 'rightEye' ? 'Phải' : 'Trái'}</td>
                    <td>{hStr}</td>
                    <td>{vStr}</td>
                    <td>{metricOrNull(m?.displacement)}</td>
                    <td>{metricOrNull(m?.normalizedDisplacement)}</td>
                    <td>{metricOrNull(m?.peakVelocity)}</td>
                    <td>{m?.dataQuality?.isValid ? 'Đạt' : 'Không đạt'}</td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
      <p className="technical-calibration-note">
        Độ lăng kính (Prism Diopters): null — Hệ thống chưa có dữ liệu hiệu chuẩn lâm sàng phù hợp.
      </p>

      {/* Gaze 4 Directions technical */}
      {gazeTracking && (
        <>
          <h4>Hirschberg — Dữ liệu kỹ thuật (20–25 cm)</h4>
          <div className="table-responsive">
            <table className="metrics-table">
              <thead>
                <tr>
                  <th>Phương pháp</th>
                  <th>Thời gian</th>
                  <th>Khoảng cách</th>
                  <th>Điểm chất lượng</th>
                  <th>Landmarks</th>
                  <th>Ảnh</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'hirschberg', label: 'Hirschberg' },
                ].map(({ key, label }) => {
                  const cap = gazeTracking?.captures?.[key] || gazeTracking?.captures?.straight;
                  return (
                    <tr key={key}>
                      <td>{label}</td>
                      <td>{cap?.timestamp ? new Date(cap.timestamp).toLocaleTimeString() : '--'}</td>
                      <td>{cap?.distanceCm ? `${cap.distanceCm} cm` : '--'}</td>
                      <td>{cap?.qualityScore ? cap.qualityScore.toFixed(2) : '--'}</td>
                      <td>{cap?.landmarks ? `${cap.landmarks.length} pts` : '--'}</td>
                      <td>{cap?.image ? 'Đã lưu' : 'Không có'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="technical-calibration-note">
            Khoảng cách 20–25 cm và ngưỡng Hirschberg hiện là TODO_PILOT, chưa phải tiêu chuẩn lâm sàng đã hiệu chuẩn.
          </p>
        </>
      )}

      {/* Strabismus Deep Learning technical */}
      {strabismusResult && (
        <>
          <h4>Mô hình AI Sàng lọc (ONNX ResNet-18) — Chỉ số kỹ thuật</h4>
          <div className="table-responsive">
            <table className="metrics-table">
              <thead>
                <tr>
                  <th>Phiên bản mô hình</th>
                  <th>Ngưỡng quyết định (Threshold)</th>
                  <th>Thời gian xử lý (Latency)</th>
                  <th>Điểm chất lượng (Quality Gate)</th>
                  <th>Độ tự tin Softmax (Confidence)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{strabismusResult.model_version || 'remicare-bilateral-resnet18-v1'}</td>
                  <td>{strabismusResult.threshold != null ? strabismusResult.threshold : '0.20'}</td>
                  <td>{strabismusResult.inference_latency_ms ? `${strabismusResult.inference_latency_ms} ms` : '--'}</td>
                  <td>{strabismusResult.quality_score != null ? strabismusResult.quality_score : '--'}</td>
                  <td>{strabismusResult.confidence != null ? `${Math.round(strabismusResult.confidence * 100)}%` : '--'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="technical-calibration-note">
            Độ tự tin Softmax phản ánh mức độ kích hoạt phân lớp nơ-ron đối với đặc trưng ảnh đầu vào, không đại diện cho nguy cơ mắc bệnh lâm sàng.
          </p>
        </>
      )}

      {/* Quality gate details */}
      <h4>Quality Gate</h4>
      <QualityWarnings quality={quality} />
      {!quality?.reasons?.length && !quality?.warnings?.length && (
        <p className="text-valid" style={{ fontSize: '0.85rem' }}>Không có cảnh báo chất lượng.</p>
      )}

      <p className="technical-calibration-note" style={{ marginTop: '12px' }}>
        <strong>Chẩn đoán lâm sàng:</strong> null — Không có chẩn đoán được tạo ra bởi hệ thống này.
        <br />
        <strong>Prism Diopters:</strong> null — Không có quy đổi pixel sang lăng kính khi chưa có hiệu chuẩn.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * FinalScreeningResult
 * Displays the final screening outcome in a child-friendly, non-diagnostic format.
 *
 * WHAT IS DISPLAYED TO USER:
 *  - Screening status (3 possible: CLEAR / ATTENTION / INCONCLUSIVE)
 *  - Human-readable message (no clinical labels)
 *  - Cover Test summary (valid/invalid, cycles count)
 *  - Brock String summary (per target VALID/INVALID)
 *  - Medical disclaimer (always visible)
 *  - "Thực hiện lại" and "Khám chuyên khoa" buttons
 *
 * WHAT IS NOT DISPLAYED BY DEFAULT (behind "Xem chi tiết kỹ thuật" toggle):
 *  - normalizedDisplacement, peakVelocity, vergenceRatio, IQR, confidence score, AI score
 *
 * NEVER DISPLAYED:
 *  - Strabismus probability
 *  - Diagnosis
 *  - "Bạn bị lác" / "Mắt bình thường 100%"
 *  - Prism Diopter conversion
 *
 * @param {{ sessionData: Object, onRestart: Function }} props
 */
export default function FinalScreeningResult({ sessionData, onRestart }) {
  const [showTechnical, setShowTechnical] = useState(false);

  const summary = sessionData?.summary || {};
  const strabismusResult = sessionData?.strabismusResult || sessionData?.gazeTracking?.strabismusResult;
  const coverTest = sessionData?.coverTest || {};
  const quality = summary.quality || {};

  const screeningStatus =
    summary.screeningStatus || OVERALL_SCREENING_STATUS.SCREENING_INCONCLUSIVE;
  const presentation =
    STATUS_PRESENTATION[screeningStatus] ||
    STATUS_PRESENTATION[OVERALL_SCREENING_STATUS.SCREENING_INCONCLUSIVE];

  const title = summary.title || 'Chưa đủ dữ liệu để đánh giá';
  const description =
    summary.description || 'Dữ liệu trong lần kiểm tra này chưa đủ ổn định.';
  const disclaimer =
    summary.disclaimer ||
    'Kết quả này chỉ mang tính chất sàng lọc và không thay thế việc khám mắt chuyên khoa.';

  return (
    <div className="card stage-card-main screening-summary-card" role="main">
      {/* Header */}
      <div className="stage-header screening-summary-heading">
        <span className="badge badge-primary">Hoàn tất</span>
        <h2 className="stage-title">KẾT QUẢ SÀNG LỌC</h2>
        <p className="stage-subtitle">
          Kết quả tổng hợp của lần sàng lọc thị giác hai mắt hiện tại.
        </p>
      </div>

      {/* ── LEVEL 1: KẾT QUẢ SÀNG LỌC (Single Source of Truth) ── */}
      <section
        className={presentation.className}
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        <div className="final-result-icon-row" aria-hidden="true">
          <span className="final-result-emoji">{presentation.emoji}</span>
        </div>
        <h3 className="final-result-title">{title}</h3>
        <p className="final-result-description">{description}</p>
        <p className="final-result-disclaimer" role="note">
          {disclaimer}
        </p>
      </section>

      {/* ── LEVEL 2: CÁC PHÉP KIỂM TRA ĐÃ THỰC HIỆN ── */}
      <section className="final-screening-details-section" aria-label="Các kiểm tra đã thực hiện">
        <div className="evidence-section-header" style={{ margin: '16px 0 12px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            CÁC KIỂM TRA ĐÃ THỰC HIỆN
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0' }}>
            Kết quả của từng thành phần trong phiên sàng lọc thị giác hai mắt:
          </p>
        </div>

        {/* 1. Nghiệm pháp Che mắt (Cover Test) */}
        <CoverTestSummaryRow coverTest={coverTest} />

        {/* 2. Chụp 4 hướng mắt (Motility) */}
        {sessionData?.gazeTracking && (
          <Gaze4DirectionsSummarySection gazeTracking={sessionData.gazeTracking} />
        )}

        {/* 3. Phân tích hình ảnh AI (Bilateral Eye ROI) */}
        {strabismusResult && (
          <StrabismusAIScreeningSection strabismusResult={strabismusResult} />
        )}
      </section>

      {/* ── Separator and disclaimer ── */}
      <div className="final-screening-medical-note" role="note">
        <p>
          <strong>Lưu ý:</strong> Kết quả này chỉ nhằm mục đích sàng lọc, không thay thế
          khám và chẩn đoán của bác sĩ mắt.
        </p>
        {screeningStatus === OVERALL_SCREENING_STATUS.SCREENING_ATTENTION && (
          <p className="final-screening-referral-note">
            Nếu bạn lo lắng về thị lực, hãy trao đổi với bác sĩ mắt hoặc chuyên khoa nhãn khoa.
          </p>
        )}
      </div>

      {/* ── Technical details toggle ── */}
      <div className="details-toggle-container">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setShowTechnical((v) => !v)}
          aria-expanded={showTechnical}
          aria-controls="technical-details-panel"
        >
          {showTechnical ? '▲ ẨN CHI TIẾT KỸ THUẬT' : '▼ XEM CHI TIẾT KỸ THUẬT'}
        </button>
        <p className="final-screening-technical-label" aria-hidden="true">
          Dành cho nhà nghiên cứu / chuyên gia y tế
        </p>
      </div>

      {showTechnical && (
        <div id="technical-details-panel" aria-label="Chi tiết kỹ thuật">
          <TechnicalDetails
            coverTest={coverTest}
            quality={quality}
            gazeTracking={sessionData?.gazeTracking}
            strabismusResult={strabismusResult}
          />
        </div>
      )}

      {/* ── AI supporting note ── */}
      {sessionData?.aiSupportingSignal?.enabled && (
        <p className="ai-screening-note" role="note">
          Tín hiệu AI được lưu như dữ liệu hỗ trợ nghiên cứu, không được diễn giải thành xác
          suất mắc bệnh và không quyết định kết quả sàng lọc này.
        </p>
      )}

      {/* ── Action buttons ── */}
      <div className="summary-footer-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onRestart}
          aria-label="Thực hiện lại toàn bộ sàng lọc"
        >
          🔄 Thực hiện lại
        </button>
        <a
          href="https://www.vinmec.com/vi/mat/dich-vu/kham-mat/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-referral"
          aria-label="Tìm hiểu về khám chuyên khoa mắt"
        >
          🏥 Nếu cần, hãy khám chuyên khoa mắt
        </a>
      </div>
    </div>
  );
}

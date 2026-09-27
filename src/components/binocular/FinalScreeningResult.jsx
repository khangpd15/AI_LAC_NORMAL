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

const BROCK_TARGETS = [
  { key: 'near20cm', label: 'NEAR (20 cm)' },
  { key: 'mid50cm', label: 'MID (50 cm)' },
  { key: 'far100cm', label: 'FAR (100 cm)' },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CoverTestSummaryRow({ coverTest }) {
  const isValid = (coverTest?.quality?.status === 'GOOD' || coverTest?.quality?.status === 'OPTIMAL' || coverTest?.quality?.status === 'VALID') && (coverTest?.validCycles ?? 0) >= 2;
  const validCycles = coverTest?.validCycles ?? 0;
  const totalCycles = 3;

  return (
    <div className="final-screening-section">
      <h3 className="final-screening-section-title">Cover Test</h3>
      <div className="final-screening-info-row">
        <span>Trạng thái</span>
        <strong className={isValid ? 'text-valid' : 'text-inconclusive'}>
          {isValid ? 'Có dữ liệu' : 'Chưa đủ dữ liệu'}
        </strong>
      </div>
      <div className="final-screening-info-row">
        <span>Số chu kỳ hợp lệ</span>
        <strong>
          {validCycles} / {totalCycles}
        </strong>
      </div>
      <div className="final-screening-info-row">
        <span>Tín hiệu tái định thị</span>
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

function BrockStringSummarySection({ brockString }) {
  const targets = brockString?.targets || {};

  return (
    <div className="final-screening-section">
      <h3 className="final-screening-section-title">Brock String</h3>
      {BROCK_TARGETS.map(({ key, label }) => {
        const t = targets[key];
        const isTargetValid = t?.dataQuality?.isValid === true;
        return (
          <div className="final-screening-info-row" key={key}>
            <span>{label}</span>
            <strong className={isTargetValid ? 'text-valid' : 'text-inconclusive'}>
              {isTargetValid ? 'VALID' : 'Chưa đủ dữ liệu'}
            </strong>
          </div>
        );
      })}
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

function TechnicalDetails({ coverTest, brockString, quality }) {
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
              <th>Displacement</th>
              <th>Normalized</th>
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
                return (
                  <tr key={`${cycle.cycleIndex}-${eye}`}>
                    <td>{cycle.cycleIndex}</td>
                    <td>{coveredLabel}</td>
                    <td>{eye === 'rightEye' ? 'Phải' : 'Trái'}</td>
                    <td>{metricOrNull(m?.displacement)}</td>
                    <td>{metricOrNull(m?.normalizedDisplacement)}</td>
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

      {/* Brock String technical */}
      <h4>Brock String — Dữ liệu kỹ thuật</h4>
      <div className="table-responsive">
        <table className="metrics-table">
          <thead>
            <tr>
              <th>Mục tiêu</th>
              <th>Cự ly</th>
              <th>Số mẫu</th>
              <th>Tỷ lệ quy tụ</th>
              <th>IQR ổn định</th>
              <th>Chất lượng</th>
            </tr>
          </thead>
          <tbody>
            {BROCK_TARGETS.map(({ key, label }) => {
              const t = brockString?.targets?.[key];
              return (
                <tr key={key}>
                  <td>{label.split(' ')[0]}</td>
                  <td>{t?.targetDistanceCm ?? '--'} cm</td>
                  <td>{t?.sampleCount ?? 0}</td>
                  <td>{metricOrNull(t?.medianVergenceRatio)}</td>
                  <td>{metricOrNull(t?.fixationStabilityIqr)}</td>
                  <td>{t?.dataQuality?.isValid ? 'Đạt' : 'Không đạt'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="technical-calibration-note">
        Góc quy tụ lâm sàng: null — Hệ thống chưa có dữ liệu hiệu chuẩn với synoptophore hoặc lăng kính.
      </p>

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
  const coverTest = sessionData?.coverTest || {};
  const brockString = sessionData?.brockString || {};
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

      {/* ── Main result banner ── */}
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

      {/* ── Cover Test & Brock String info ── */}
      <section className="final-screening-details-section" aria-label="Thông tin chi tiết sàng lọc">
        <div className="final-screening-two-col">
          <CoverTestSummaryRow coverTest={coverTest} />
          <BrockStringSummarySection brockString={brockString} />
        </div>
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
            brockString={brockString}
            quality={quality}
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

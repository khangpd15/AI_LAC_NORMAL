import React, { useMemo, useState } from 'react';
import {
  RESEARCH_CAMERA_CONFIG,
  RESEARCH_ELIGIBILITY_CONFIG,
  getDeviceContext,
} from '../../constants/researchScreeningConfig.js';

const INITIAL_FORM = {
  guardianConsent: false,
  ageYears: '',
  redFlagPresent: false,
  glassesOn: '',
  phoneFixed: false,
  headStraightReady: false,
  lightingReady: false,
  fixationTargetReady: false,
  coverHelperReady: false,
};

export default function ScreeningPreparationStep({ onComplete, speak, isVoiceEnabled = true }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [stepIndex, setStepIndex] = useState(0);
  const [showBlockReason, setShowBlockReason] = useState(false);
  const deviceContext = useMemo(() => getDeviceContext(), []);

  const ageNumber = Number(form.ageYears);
  const ageMissing = form.ageYears === '';
  const ageTooYoung = !ageMissing && Number.isFinite(ageNumber) && ageNumber < RESEARCH_ELIGIBILITY_CONFIG.minAgeYears;
  const ageInvalid = ageMissing || !Number.isFinite(ageNumber) || ageNumber < 0;
  const hasBlockingClinicalInput = ageTooYoung || form.redFlagPresent;
  const allPreparationChecked =
    form.guardianConsent &&
    !ageInvalid &&
    !hasBlockingClinicalInput &&
    form.glassesOn !== '' &&
    form.phoneFixed &&
    form.headStraightReady &&
    form.lightingReady &&
    form.fixationTargetReady &&
    form.coverHelperReady;

  const lightingInstruction = deviceContext.isAndroid
    ? 'Android: hệ thống sẽ thử bật đèn flash sau khi bạn cấp quyền camera. Nếu trình duyệt không hỗ trợ torch, dùng đèn nhỏ đặt sát camera.'
    : 'iOS hoặc thiết bị không hỗ trợ torch: dùng một đèn nhỏ đặt sát camera, không dùng ring light hay đèn khuếch tán lớn.';

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setShowBlockReason(false);
  };

  const steps = [
    {
      id: 'consent',
      title: 'Đồng ý thực hiện sàng lọc',
      subtitle: 'Phụ huynh hoặc người giám hộ xác nhận trước khi bật camera.',
      art: 'M 15 42 L 28 55 L 58 20',
      content: (
        <label className="prep-check-row prep-single-control">
          <input
            type="checkbox"
            checked={form.guardianConsent}
            onChange={(e) => update('guardianConsent', e.target.checked)}
          />
          <span>Phụ huynh/người giám hộ đồng ý thực hiện bài sàng lọc nghiên cứu.</span>
        </label>
      ),
      isValid: () => form.guardianConsent,
      invalidText: 'Cần xác nhận đồng ý trước khi tiếp tục.',
    },
    {
      id: 'age',
      title: 'Tuổi của trẻ',
      subtitle: `Phạm vi hiện tại: từ ${RESEARCH_ELIGIBILITY_CONFIG.minAgeYears} tuổi. Giới hạn trên: UNKNOWN.`,
      art: 'M 18 50 C 24 34 42 34 48 50 M 20 20 H 54 M 20 32 H 42',
      content: (
        <label className="prep-field prep-single-control">
          <span>Nhập tuổi</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={form.ageYears}
            onChange={(e) => update('ageYears', e.target.value)}
            placeholder={`Tối thiểu ${RESEARCH_ELIGIBILITY_CONFIG.minAgeYears} tuổi`}
          />
        </label>
      ),
      isValid: () => !ageInvalid && !ageTooYoung,
      invalidText: ageTooYoung
        ? `Tuổi dưới ${RESEARCH_ELIGIBILITY_CONFIG.minAgeYears}: nên dừng bài test trong phạm vi nghiên cứu này.`
        : 'Vui lòng nhập tuổi hợp lệ.',
    },
    {
      id: 'redFlag',
      title: 'Dấu hiệu cần khám ngay',
      subtitle: 'Danh sách red flag đang chờ bác sĩ duyệt; nếu có dấu hiệu bất thường, dừng test và đi khám.',
      art: 'M 36 14 L 62 58 H 10 Z M 36 28 V 42 M 36 50 V 52',
      content: (
        <label className="prep-check-row prep-alert-row prep-single-control">
          <input
            type="checkbox"
            checked={form.redFlagPresent}
            onChange={(e) => update('redFlagPresent', e.target.checked)}
          />
          <span>Có dấu hiệu cần khám ngay theo danh sách bác sĩ cung cấp.</span>
        </label>
      ),
      isValid: () => !form.redFlagPresent,
      invalidText: 'Có red flag tự khai: dừng bài test và nên đi khám chuyên khoa.',
      allowSkipLabel: 'Không có dấu hiệu này',
    },
    {
      id: 'glasses',
      title: 'Trẻ có đeo kính không?',
      subtitle: 'Chính sách cho phép hay không vẫn chờ bác sĩ duyệt; lựa chọn này chỉ lưu metadata.',
      art: 'M 12 38 C 12 28 28 28 28 38 C 28 48 12 48 12 38 M 44 38 C 44 28 60 28 60 38 C 60 48 44 48 44 38 M 28 38 H 44',
      content: (
        <label className="prep-field prep-single-control">
          <span>Chọn tình trạng kính</span>
          <select value={form.glassesOn} onChange={(e) => update('glassesOn', e.target.value)}>
            <option value="">Chọn một mục</option>
            <option value="yes">Có đeo kính</option>
            <option value="no">Không đeo kính</option>
          </select>
        </label>
      ),
      isValid: () => form.glassesOn !== '',
      invalidText: 'Vui lòng chọn tình trạng kính.',
    },
    {
      id: 'phoneFixed',
      title: 'Cố định điện thoại',
      subtitle: 'Dùng giá đỡ hoặc tripod. Bước camera sau sẽ xin quyền ở màn kế tiếp.',
      art: 'M 26 10 H 46 V 58 H 26 Z M 22 62 H 50 M 36 58 V 62',
      content: (
        <label className="prep-check-row prep-single-control">
          <input
            type="checkbox"
            checked={form.phoneFixed}
            onChange={(e) => update('phoneFixed', e.target.checked)}
          />
          <span>Điện thoại đã cố định trên giá đỡ/tripod, dùng camera sau.</span>
        </label>
      ),
      isValid: () => form.phoneFixed,
      invalidText: 'Cần cố định điện thoại trước khi bật camera.',
    },
    {
      id: 'posture',
      title: 'Tư thế của trẻ',
      subtitle: 'Ngồi thẳng lưng, đầu song song với điện thoại.',
      art: 'M 36 16 A 10 10 0 1 0 36 36 A 10 10 0 1 0 36 16 M 36 36 V 58 M 22 48 H 50',
      content: (
        <label className="prep-check-row prep-single-control">
          <input
            type="checkbox"
            checked={form.headStraightReady}
            onChange={(e) => update('headStraightReady', e.target.checked)}
          />
          <span>Trẻ ngồi thẳng lưng, đầu song song với điện thoại.</span>
        </label>
      ),
      isValid: () => form.headStraightReady,
      invalidText: 'Cần chuẩn bị tư thế trước khi tiếp tục.',
    },
    {
      id: 'lighting',
      title: 'Nguồn sáng',
      subtitle: 'Cần một điểm sáng nhỏ, không dùng ring light hoặc đèn khuếch tán lớn.',
      art: 'M 36 10 V 20 M 36 52 V 62 M 10 36 H 20 M 52 36 H 62 M 24 24 L 18 18 M 48 24 L 54 18 M 24 48 L 18 54 M 48 48 L 54 54 M 28 36 A 8 8 0 1 0 44 36 A 8 8 0 1 0 28 36',
      content: (
        <label className="prep-check-row prep-single-control">
          <input
            type="checkbox"
            checked={form.lightingReady}
            onChange={(e) => update('lightingReady', e.target.checked)}
          />
          <span>{lightingInstruction}</span>
        </label>
      ),
      isValid: () => form.lightingReady,
      invalidText: 'Cần chuẩn bị nguồn sáng trước khi bật camera.',
    },
    {
      id: 'target',
      title: 'Target nhìn',
      subtitle: 'Dán hoặc đặt một vật nhỏ sát ống kính để trẻ nhìn vào.',
      art: 'M 36 14 A 22 22 0 1 0 36 58 A 22 22 0 1 0 36 14 M 36 24 A 12 12 0 1 0 36 48 A 12 12 0 1 0 36 24 M 36 34 A 2 2 0 1 0 36 38 A 2 2 0 1 0 36 34',
      content: (
        <label className="prep-check-row prep-single-control">
          <input
            type="checkbox"
            checked={form.fixationTargetReady}
            onChange={(e) => update('fixationTargetReady', e.target.checked)}
          />
          <span>Có vật nhỏ làm target đặt sát ống kính để trẻ nhìn vào.</span>
        </label>
      ),
      isValid: () => form.fixationTargetReady,
      invalidText: 'Cần chuẩn bị target nhìn trước khi tiếp tục.',
    },
    {
      id: 'coverHelper',
      title: 'Người hỗ trợ che mắt',
      subtitle: 'Một người lớn cần sẵn sàng che mắt theo hướng dẫn trong Cover Test.',
      art: 'M 20 28 C 28 18 44 18 52 28 M 18 36 C 28 48 44 48 54 36 M 36 24 V 54',
      content: (
        <label className="prep-check-row prep-single-control">
          <input
            type="checkbox"
            checked={form.coverHelperReady}
            onChange={(e) => update('coverHelperReady', e.target.checked)}
          />
          <span>Người lớn đã sẵn sàng che mắt theo hướng dẫn.</span>
        </label>
      ),
      isValid: () => form.coverHelperReady,
      invalidText: 'Cần có người lớn hỗ trợ che mắt.',
    },
  ];

  const current = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  const goNext = () => {
    if (!current.isValid()) {
      setShowBlockReason(true);
      return;
    }
    setShowBlockReason(false);
    if (isLastStep) {
      handleSubmit();
      return;
    }
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleSubmit = () => {
    if (!allPreparationChecked) {
      const firstInvalidIndex = steps.findIndex((s) => !s.isValid());
      if (firstInvalidIndex !== -1) {
        setStepIndex(firstInvalidIndex);
      }
      setShowBlockReason(true);
      return;
    }

    const metadata = {
      schemaVersion: 'research-precheck-v0',
      completedAt: new Date().toISOString(),
      eligibility: {
        guardianConsent: form.guardianConsent,
        ageYears: ageNumber,
        minAgeYears: RESEARCH_ELIGIBILITY_CONFIG.minAgeYears,
        maxAgeYears: RESEARCH_ELIGIBILITY_CONFIG.maxAgeYears,
        redFlagPresent: form.redFlagPresent,
        redFlagQuestions: RESEARCH_ELIGIBILITY_CONFIG.redFlagQuestions,
      },
      selfReported: {
        glassesOn: form.glassesOn === 'yes',
        phoneFixed: form.phoneFixed,
        headStraightReady: form.headStraightReady,
        lightingReady: form.lightingReady,
        fixationTargetReady: form.fixationTargetReady,
        coverHelperReady: form.coverHelperReady,
      },
      device: deviceContext,
      cameraPlan: {
        facingMode: 'environment',
        minWidth: RESEARCH_CAMERA_CONFIG.minWidth,
        minHeight: RESEARCH_CAMERA_CONFIG.minHeight,
        thresholdSource: RESEARCH_CAMERA_CONFIG.thresholdSource,
      },
      lightingPlan: {
        source: deviceContext.isAndroid ? 'torch_or_external' : 'external',
        instruction: lightingInstruction,
      },
      warnings: [
        'selfReported fields are metadata only and do not replace automatic quality gates',
        'red flag list is a placeholder pending clinical review',
        'glasses policy is TODO_CLINICAL_REVIEW',
      ],
    };

    onComplete?.(metadata);
  };

  React.useEffect(() => {
    if (isVoiceEnabled && speak) {
      speak('Trước khi bật camera, mình kiểm tra nhanh điều kiện an toàn và cách đặt điện thoại nghen.');
    }
  }, [isVoiceEnabled, speak]);

  return (
    <div className="card stage-card-main preparation-card">
      <div className="stage-header">
        <div className="preparation-badge-row">
          <span className="badge badge-primary">Chuẩn bị trước camera</span>
          <span className="badge badge-secondary">Nghiên cứu</span>
        </div>
        <h2 className="stage-title">Kiểm tra điều kiện trước khi bật camera</h2>
        <p className="stage-subtitle">
          Những câu trả lời này chỉ được lưu làm metadata tự khai. Camera và quality gate vẫn kiểm tra độc lập.
        </p>
      </div>

      <div className="preparation-step-shell">
        <div className="preparation-step-progress">
          {steps.map((step, index) => (
            <button
              key={step.id}
              type="button"
              className={`prep-step-dot ${index === stepIndex ? 'active' : ''} ${index < stepIndex ? 'done' : ''}`}
              onClick={() => {
                if (index <= stepIndex) {
                  setStepIndex(index);
                  setShowBlockReason(false);
                }
              }}
              aria-label={`Bước ${index + 1}: ${step.title}`}
            >
              {index + 1}
            </button>
          ))}
        </div>

        <section className="preparation-panel preparation-panel-single">
          <div className="prep-illustration" aria-hidden="true">
            <svg viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <path d={current.art} />
            </svg>
          </div>
          <div className="prep-step-copy">
            <span className="prep-step-count">Bước {stepIndex + 1}/{steps.length}</span>
            <h3>{current.title}</h3>
            <p>{current.subtitle}</p>
          </div>
          {current.content}
          {current.id === 'glasses' && (
            <p className="preparation-note">
              Chính sách kính: TODO_CLINICAL_REVIEW. Lựa chọn này chưa quyết định trẻ có được kết luận hay không.
            </p>
          )}
        </section>
      </div>

      {showBlockReason && (
        <div className="preparation-block" role="alert">
          {current.invalidText}
        </div>
      )}

      <div className="preparation-footer">
        <div className="preparation-device">
          Thiết bị: {deviceContext.os} / {deviceContext.browser}. Camera sẽ xin `facingMode: environment`.
        </div>
        <div className="preparation-actions">
          {stepIndex > 0 && (
            <button type="button" className="btn btn-secondary btn-large" onClick={() => setStepIndex((prev) => prev - 1)}>
              Quay lại
            </button>
          )}
          <button type="button" className="btn btn-primary btn-large" onClick={goNext}>
            {isLastStep ? 'Tiếp tục và bật camera' : 'Tiếp tục'}
          </button>
        </div>
      </div>
    </div>
  );
}

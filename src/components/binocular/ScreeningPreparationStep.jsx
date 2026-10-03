import React, { useMemo, useState } from 'react';
import {
  RESEARCH_CAMERA_CONFIG,
  RESEARCH_ELIGIBILITY_CONFIG,
  getDeviceContext,
} from '../../constants/researchScreeningConfig.js';

const INITIAL_FORM = {
  guardianConsent: false,
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

  const lightingInstruction = deviceContext.isAndroid
    ? 'Android: hệ thống sẽ thử bật đèn flash sau khi bạn cấp quyền camera. Nếu trình duyệt không hỗ trợ torch, dùng đèn nhỏ đặt sát camera.'
    : 'iOS hoặc thiết bị không hỗ trợ torch: dùng một đèn nhỏ đặt sát camera, không dùng ring light hay đèn khuếch tán lớn.';

  const checkAllValid = (f) =>
    Boolean(
      f.guardianConsent &&
      f.phoneFixed &&
      f.headStraightReady &&
      f.lightingReady &&
      f.fixationTargetReady &&
      f.coverHelperReady
    );

  const handleSubmit = (targetForm = form) => {
    if (!checkAllValid(targetForm)) {
      const firstInvalidIndex = steps.findIndex((s) => !s.isValid(targetForm));
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
        guardianConsent: targetForm.guardianConsent,
        ageYears: null,
        minAgeYears: RESEARCH_ELIGIBILITY_CONFIG.minAgeYears,
        maxAgeYears: RESEARCH_ELIGIBILITY_CONFIG.maxAgeYears,
        redFlagPresent: false,
        redFlagQuestions: RESEARCH_ELIGIBILITY_CONFIG.redFlagQuestions,
      },
      selfReported: {
        glassesOn: null,
        phoneFixed: targetForm.phoneFixed,
        headStraightReady: targetForm.headStraightReady,
        lightingReady: targetForm.lightingReady,
        fixationTargetReady: targetForm.fixationTargetReady,
        coverHelperReady: targetForm.coverHelperReady,
      },
      device: deviceContext,
      cameraPlan: {
        facingMode: 'user',
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
      ],
    };

    onComplete?.(metadata);
  };

  const update = (key, value) => {
    const nextForm = { ...form, [key]: value };
    setForm(nextForm);
    setShowBlockReason(false);

    // Khi đánh dấu tích ở bước cuối cùng, tự động chuyển ngay sang luồng 2 (Vị trí / Camera)
    if (stepIndex === steps.length - 1 && value === true) {
      if (checkAllValid(nextForm)) {
        handleSubmit(nextForm);
      }
    }
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
      isValid: (f = form) => f.guardianConsent,
      invalidText: 'Cần xác nhận đồng ý trước khi tiếp tục.',
    },
    {
      id: 'phoneFixed',
      title: 'Cố định điện thoại',
      subtitle: 'Dùng giá đỡ hoặc tripod, đặt thẳng tầm mắt của trẻ.',
      art: 'M 26 10 H 46 V 58 H 26 Z M 22 62 H 50 M 36 58 V 62',
      content: (
        <label className="prep-check-row prep-single-control">
          <input
            type="checkbox"
            checked={form.phoneFixed}
            onChange={(e) => update('phoneFixed', e.target.checked)}
          />
          <span>Điện thoại đã cố định trên giá đỡ/tripod, hướng camera trước về phía trẻ.</span>
        </label>
      ),
      isValid: (f = form) => f.phoneFixed,
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
      isValid: (f = form) => f.headStraightReady,
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
      isValid: (f = form) => f.lightingReady,
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
      isValid: (f = form) => f.fixationTargetReady,
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
      isValid: (f = form) => f.coverHelperReady,
      invalidText: 'Cần có người lớn hỗ trợ che mắt.',
    },
  ];

  const current = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  const goNext = () => {
    if (!current.isValid(form)) {
      setShowBlockReason(true);
      return;
    }
    setShowBlockReason(false);
    if (isLastStep) {
      handleSubmit(form);
      return;
    }
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
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
        </section>
      </div>

      {showBlockReason && (
        <div className="preparation-block" role="alert">
          {current.invalidText}
        </div>
      )}

      <div className="preparation-footer">
        <div className="preparation-device">
          Thiết bị: {deviceContext.os} / {deviceContext.browser}.
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

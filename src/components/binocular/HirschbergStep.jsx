import React, { useState, useRef, useCallback, useEffect } from 'react';
import AudioButton from '../audio/AudioButton';
import { measureResearchGeometry } from '../../api/researchMeasurementApi.js';
import HirschbergQualityReviewModal from './HirschbergQualityReviewModal.jsx';
import { inspectHirschbergImage } from '../../services/hirschbergQualityPrescreenService.js';
import { classifyResearchMeasurementError } from '../../services/researchMeasurementErrorService.js';

/**
 * HirschbergStep (B1 - Hirschberg Screening)
 *
 * Primary default screening step:
 * 1. Instruction: Guide user on camera posture, 30–50 cm distance, head straight, target fixation, lighting.
 * 2. Upload / Photo Capture: User selects or takes a photo.
 * 3. Quality Gate: Inspects face, both eyes, openness, blur, lighting, corneal reflex before inference.
 * 4. AI Analysis: Calls backend research geometry measurement API (/api/v1/research/measurements).
 */
export default function HirschbergStep({
  preparationData,
  sessionId,
  onComplete,
  speak,
  isVoiceEnabled = true,
  toggleSound,
}) {
  const [stepStatus, setStepStatus] = useState('GUIDE'); // 'GUIDE' | 'REVIEWING' | 'COMPLETED'
  const fileInputRef = useRef(null);

  // Pre-screening review candidate
  const [reviewCandidate, setReviewCandidate] = useState(null);
  const [isInspecting, setIsInspecting] = useState(false);

  // Backend analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const abortControllerRef = useRef(null);

  // Abort on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Voice intro
  useEffect(() => {
    if (isVoiceEnabled && speak) {
      speak('Chào mừng bạn đến với RemiCare. Chụp hoặc tải ảnh theo hướng dẫn để AI kiểm tra chất lượng nghen.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build backend payload from captureRecord
  const buildResearchMeasurementPayload = useCallback(
    (captureRecord) => {
      const eligibility = preparationData?.eligibility || {};
      const qualityMeta = captureRecord?.researchQuality?.metadata || {};
      return {
        schemaVersion: 'remicare-research-quality-v0.1',
        featureVersion: 'research-geometry-v0.1',
        protocolVersion: 'hirschberg-photo-v1',
        configVersion: 'TODO_PILOT',
        testType: 'HIRSCHBERG',
        sessionId: sessionId || `client-${Date.now()}`,
        requestId: `hirschberg-${Date.now()}`,
        distance_bucket: qualityMeta.distanceBucket || '30_50_CM',
        eligibility: {
          consent: Boolean(eligibility.guardianConsent ?? true),
          redFlag: Boolean(eligibility.redFlagPresent),
        },
        quality: captureRecord?.researchQuality?.checks || {},
        metadata: {
          ...(qualityMeta || {}),
          landmarks: captureRecord?.researchLandmarks || [],
          selfReported: preparationData?.selfReported || {},
          preparationSchemaVersion: preparationData?.schemaVersion || null,
        },
        imageDataUrl: captureRecord?.originalFrame,
      };
    },
    [preparationData, sessionId]
  );

  // Finalize: send to backend, then call onComplete
  const handleFinalizeStep = useCallback(
    async (captureRecord) => {
      let hirschbergResult = null;

      if (captureRecord?.originalFrame) {
        try {
          setIsAnalyzing(true);
          setAnalysisError(null);
          const controller = new AbortController();
          abortControllerRef.current = controller;

          hirschbergResult = await measureResearchGeometry(
            buildResearchMeasurementPayload(captureRecord),
            { signal: controller.signal, timeoutMs: 25000 }
          );
        } catch (err) {
          if (err.name === 'AbortError') return;
          console.warn('Hirschberg backend warning:', err);
          const researchError = classifyResearchMeasurementError(err);
          hirschbergResult = {
            status: 'INCONCLUSIVE',
            result: researchError.result,
            reasonCodes: [researchError.reasonCode],
            measurements: {},
            quality: captureRecord?.researchQuality || {},
            experimental: true,
            message: researchError.message,
          };
        } finally {
          setIsAnalyzing(false);
        }
      } else {
        hirschbergResult = {
          status: 'INCONCLUSIVE',
          result: 'INVALID_FRAME',
          reasonCodes: ['ORIGINAL_FRAME_MISSING'],
          measurements: {},
          quality: captureRecord?.researchQuality || {},
          experimental: true,
          message: 'Không tìm thấy ảnh chụp để phân tích.',
        };
      }

      setStepStatus('COMPLETED');

      onComplete?.({
        method: 'HIRSCHBERG',
        completedAt: new Date().toISOString(),
        captures: { hirschberg: captureRecord },
        hirschbergResult,
        strabismusResult: {
          status: hirschbergResult?.aiPrediction?.predictedClass ? 'COMPLETED' : 'INCONCLUSIVE',
          prediction: hirschbergResult?.aiPrediction?.predictedClass || 'INCONCLUSIVE',
          confidence: hirschbergResult?.aiPrediction?.confidence ?? null,
          probabilities: hirschbergResult?.aiPrediction?.probabilities ?? null,
          screening_status: hirschbergResult?.result === 'INELIGIBLE'
            ? 'HIRSCHBERG_INELIGIBLE'
            : hirschbergResult?.aiPrediction
            ? 'HIRSCHBERG_AI_PREDICTION'
            : 'HIRSCHBERG_MEASUREMENT_ONLY',
          message: hirschbergResult?.message || null,
          hirschbergResult,
        },
      });
    },
    [buildResearchMeasurementPayload, onComplete]
  );

  // File upload handler
  const handleFileUpload = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setStepStatus('REVIEWING');
      setIsInspecting(true);
      setAnalysisError(null);

      try {
        const result = await inspectHirschbergImage(file, { distanceCm: null });

        const researchLandmarks = result.landmarks
          ? result.landmarks.slice(0, 478).map((p) => ({
              x: Number(p.x.toFixed(5)),
              y: Number(p.y.toFixed(5)),
              z: typeof p.z === 'number' ? Number(p.z.toFixed(5)) : undefined,
            }))
          : null;

        const captureRecord = {
          direction: 'hirschberg',
          directionName: 'HIRSCHBERG',
          method: 'HIRSCHBERG_UPLOAD',
          timestamp: new Date().toISOString(),
          image: result.dataUrl,
          originalFrame: result.backendDataUrl || result.dataUrl,
          eyeRoi: null,
          roiBox: null,
          landmarks: researchLandmarks,
          researchLandmarks,
          qualityScore: result.validation.isAcceptable ? 0.95 : 0.4,
          distanceCm: null,
          gazeOffsets: { meanDx: 0, meanDy: 0 },
          researchQuality: result.validation.qualityReport,
          backendResearchPayload: {
            payloadType: 'HIRSCHBERG_ORIGINAL_FRAME_WITH_METADATA',
            preparedOnly: false,
            imageField: 'originalFrame',
            metadata: {
              ...(result.validation.qualityReport?.metadata || {}),
              landmarks: researchLandmarks,
              source: 'USER_UPLOADED_FILE',
              originalImage: {
                width: result.width,
                height: result.height,
              },
              backendImage: {
                width: result.backendWidth || result.width,
                height: result.backendHeight || result.height,
                resized: Boolean(result.backendImage?.resized),
                estimatedBytes: result.backendImage?.estimatedBytes || null,
              },
            },
            quality: result.validation.qualityReport?.checks || {},
          },
        };

        setReviewCandidate({
          dataUrl: result.dataUrl,
          landmarks: researchLandmarks,
          captureRecord,
          validation: result.validation,
        });
      } catch (err) {
        console.error('Failed to process uploaded image:', err);
        setReviewCandidate({
          dataUrl: null,
          landmarks: null,
          captureRecord: null,
          validation: {
            isAcceptable: false,
            title: 'Lỗi đọc tệp ảnh',
            summary: err.message || 'Không thể đọc tệp ảnh đã chọn.',
            errors: [
              {
                code: 'FILE_READ_ERROR',
                label: 'Tệp không hợp lệ',
                tip: 'Vui lòng chọn tệp ảnh JPEG/PNG/WebP rõ nét.',
              },
            ],
            warnings: [],
            passedChecks: [],
            metrics: {},
          },
        });
      } finally {
        setIsInspecting(false);
        if (event.target) event.target.value = '';
      }
    },
    []
  );

  // Confirm: send image to backend
  const handleConfirmReview = useCallback(async () => {
    if (!reviewCandidate?.captureRecord) return;
    await handleFinalizeStep(reviewCandidate.captureRecord);
  }, [handleFinalizeStep, reviewCandidate]);

  // Retake: back to guide
  const handleRetake = useCallback(() => {
    setReviewCandidate(null);
    setStepStatus('GUIDE');
  }, []);

  // Trigger file picker
  const handleTriggerUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="card stage-card-main gaze-4-directions-card">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {/* Backend analyzing overlay */}
      {isAnalyzing && (
        <div className="gaze-analyzing-overlay fade-in">
          <div className="analyzing-pill-box">
            <div className="analyzing-spinner" />
            <div className="analyzing-text-block">
              <strong>Đang phân tích Hirschberg...</strong>
              <small>Hệ thống AI đang đo phản xạ giác mạc và phân loại nhãn cầu</small>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="gaze-step-header">
        <div className="gaze-header-left">
          <span className="badge badge-primary">Bước 1: Hirschberg</span>
          <span className="badge badge-secondary">Sàng lọc phản xạ giác mạc</span>
        </div>
        <div className="gaze-header-center">
          <h2 className="gaze-current-direction-title">
            <span className="highlight-dir">Hướng dẫn chụp ảnh Hirschberg</span>
          </h2>
        </div>
        <div className="gaze-header-right">
          {toggleSound && (
            <AudioButton
              isVoiceEnabled={isVoiceEnabled}
              onToggle={toggleSound}
              variant="compact"
            />
          )}
        </div>
      </div>

      {/* Upload Guide — shown when in GUIDE state */}
      {stepStatus === 'GUIDE' && (
        <div className="hirschberg-upload-guide fade-in">
          {/* Guide header */}
          <div className="upload-guide-header">
            <h2 className="upload-guide-title">Cách chụp ảnh sàng lọc đúng chuẩn</h2>
            <p className="upload-guide-subtitle">
              Chụp ảnh theo hướng dẫn bên dưới, sau đó tải lên để AI kiểm tra chất lượng trước khi phân tích.
            </p>
          </div>

          {/* Steps */}
          <div className="upload-guide-steps">
            <div className="guide-step">
              <div className="guide-step-icon">💡</div>
              <div className="guide-step-body">
                <strong>1. Nguồn sáng nhỏ thẳng mắt</strong>
                <p>Bật đèn pin nhỏ hoặc đèn flash điện thoại khác chiếu nhẹ thẳng về phía mắt để tạo điểm phản quang giác mạc.</p>
              </div>
            </div>
            <div className="guide-step">
              <div className="guide-step-icon">📏</div>
              <div className="guide-step-body">
                <strong>2. Khoảng cách 30–50 cm</strong>
                <p>Giữ điện thoại cách mặt khoảng 30–50 cm. Khuôn mặt chiếm trên 50% khung hình, thấy rõ cả hai mắt.</p>
              </div>
            </div>
            <div className="guide-step">
              <div className="guide-step-icon">👁️</div>
              <div className="guide-step-body">
                <strong>3. Nhìn thẳng vào ống kính</strong>
                <p>Người được test giữ đầu thẳng, không nghiêng. Hai mắt mở to, nhìn thẳng vào điểm sáng sát camera.</p>
              </div>
            </div>
            <div className="guide-step">
              <div className="guide-step-icon">📸</div>
              <div className="guide-step-body">
                <strong>4. Chụp rõ nét, không rung</strong>
                <p>Cố định tay hoặc dùng giá đỡ. Ảnh chụp cần thấy rõ mống mắt, đồng tử và chấm sáng phản xạ trên giác mạc.</p>
              </div>
            </div>
          </div>

          {/* AI auto-check pills */}
          <div className="upload-guide-checklist">
            <p className="checklist-label">Hệ thống AI sẽ kiểm tra tự động (Quality Gate):</p>
            <div className="checklist-pills">
              <span className="check-pill">✓ Có khuôn mặt trong ảnh</span>
              <span className="check-pill">✓ Đủ cả hai mắt & mở rõ</span>
              <span className="check-pill">✓ Độ sắc nét cao, không mờ</span>
              <span className="check-pill">✓ Ánh sáng đủ, không chói lóa</span>
              <span className="check-pill">✓ Phát hiện điểm phản xạ giác mạc</span>
              <span className="check-pill">✓ Góc đầu thẳng (Yaw/Pitch/Roll)</span>
            </div>
          </div>

          {/* Upload CTA */}
          <div className="upload-guide-cta">
            <button
              id="btn-hirschberg-upload"
              type="button"
              className="btn btn-primary btn-large"
              onClick={handleTriggerUpload}
              style={{ minWidth: '240px', fontSize: '1.05rem' }}
            >
              📂 Tải ảnh lên để AI phân tích
            </button>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Hỗ trợ định dạng JPEG, PNG, WebP. Tự động kiểm tra chất lượng trước khi gửi.
            </p>
          </div>
        </div>
      )}

      {/* Pre-screening Review Modal */}
      {stepStatus === 'REVIEWING' && reviewCandidate && (
        <HirschbergQualityReviewModal
          imageDataUrl={reviewCandidate.dataUrl}
          validation={reviewCandidate.validation}
          isInspecting={isInspecting}
          isAnalyzing={isAnalyzing}
          analysisError={analysisError}
          onConfirm={handleConfirmReview}
          onRetake={handleRetake}
          onReupload={handleTriggerUpload}
        />
      )}
    </div>
  );
}

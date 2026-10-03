import React, { useState, useRef, useCallback, useEffect } from 'react';
import AudioButton from '../audio/AudioButton';
import { measureResearchGeometry } from '../../api/researchMeasurementApi.js';
import HirschbergQualityReviewModal from './HirschbergQualityReviewModal.jsx';
import { inspectHirschbergImage } from '../../services/hirschbergQualityPrescreenService.js';

/**
 * HirschbergStep (formerly Gaze4DirectionsStep)
 * Upload-only Hirschberg photo submission with AI quality pre-screening.
 * Flow: Guide → Upload → AI inspect quality → Review modal → Confirm → Backend
 */
export default function Gaze4DirectionsStep({
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
      speak('Chụp ảnh theo hướng dẫn rồi tải lên để AI kiểm tra nghen.');
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
        distance_bucket: qualityMeta.distanceBucket || 'UNKNOWN',
        eligibility: {
          consent: Boolean(eligibility.guardianConsent),
          ageYears: eligibility.ageYears ?? null,
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
          hirschbergResult = {
            status: 'INCONCLUSIVE',
            result: 'SYSTEM_ERROR',
            reasonCodes: ['RESEARCH_BACKEND_UNAVAILABLE'],
            measurements: {},
            quality: captureRecord?.researchQuality || {},
            experimental: true,
            message: err.userMessage || 'Không thể kết nối backend Hirschberg.',
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
      if (isVoiceEnabled && speak) speak('Giờ mình lùi ra xa một chút nghen.');

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
          screening_status: hirschbergResult?.aiPrediction ? 'HIRSCHBERG_AI_PREDICTION' : 'HIRSCHBERG_MEASUREMENT_ONLY',
          hirschbergResult,
        },
      });
    },
    [buildResearchMeasurementPayload, isVoiceEnabled, speak, onComplete]
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
          originalFrame: result.dataUrl,
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
            title: 'Lỗi tải ảnh',
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
              <strong>Đang đo Hirschberg...</strong>
              <small>Backend nghiên cứu đang đo phản xạ giác mạc trên ảnh gốc</small>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="gaze-step-header">
        <div className="gaze-header-left">
          <span className="badge badge-primary">Hirschberg</span>
          <span className="badge badge-secondary">1/1</span>
        </div>
        <div className="gaze-header-center">
          <h2 className="gaze-current-direction-title">
            <span className="highlight-dir">Chụp ảnh Hirschberg</span>
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
            <h2 className="upload-guide-title">Cách chụp ảnh đúng chuẩn</h2>
            <p className="upload-guide-subtitle">
              Chụp ảnh theo hướng dẫn bên dưới, sau đó tải lên để AI kiểm tra chất lượng trước khi phân tích.
            </p>
          </div>

          {/* Steps */}
          <div className="upload-guide-steps">
            <div className="guide-step">
              <div className="guide-step-icon">💡</div>
              <div className="guide-step-body">
                <strong>1. Ánh sáng điểm nhỏ</strong>
                <p>Dùng đèn pin nhỏ hoặc đèn flash điện thoại khác chiếu thẳng vào mắt từ khoảng 20–25 cm. Không dùng ring light hay đèn tán rộng.</p>
              </div>
            </div>
            <div className="guide-step">
              <div className="guide-step-icon">📏</div>
              <div className="guide-step-body">
                <strong>2. Khoảng cách 20–25 cm</strong>
                <p>Camera cách mặt trẻ khoảng 20–25 cm. Mặt trẻ phải lấp đầy &gt;50% khung ảnh, thấy rõ cả hai mắt.</p>
              </div>
            </div>
            <div className="guide-step">
              <div className="guide-step-icon">👁️</div>
              <div className="guide-step-body">
                <strong>3. Nhìn thẳng vào ống kính</strong>
                <p>Trẻ nhìn thẳng vào camera. Đầu thẳng, không nghiêng. Hai mắt mở to, không nhắm.</p>
              </div>
            </div>
            <div className="guide-step">
              <div className="guide-step-icon">📸</div>
              <div className="guide-step-body">
                <strong>4. Chụp rõ nét, không rung</strong>
                <p>Dùng tay cầm cố định hoặc giá đỡ. Ảnh phải thấy rõ đồng tử, mống mắt và điểm phản quang ánh sáng trên mắt.</p>
              </div>
            </div>
          </div>

          {/* AI auto-check pills */}
          <div className="upload-guide-checklist">
            <p className="checklist-label">AI sẽ kiểm tra tự động:</p>
            <div className="checklist-pills">
              <span className="check-pill">✓ Khuôn mặt phát hiện được</span>
              <span className="check-pill">✓ Cả hai mắt rõ</span>
              <span className="check-pill">✓ Ảnh đủ nét</span>
              <span className="check-pill">✓ Ánh sáng phù hợp</span>
              <span className="check-pill">✓ Điểm phản quang corneal</span>
              <span className="check-pill">✓ Đầu không nghiêng quá</span>
            </div>
          </div>

          {/* Upload CTA */}
          <div className="upload-guide-cta">
            <button
              id="btn-hirschberg-upload"
              type="button"
              className="btn btn-primary btn-large"
              onClick={handleTriggerUpload}
              style={{ minWidth: '220px', fontSize: '1rem' }}
            >
              📂 Chọn ảnh để AI kiểm tra
            </button>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Hỗ trợ JPEG, PNG, WebP. Ảnh sẽ được kiểm tra chất lượng trước khi gửi.
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

      {/* Thumbnail strip */}
      <div className="gaze-capture-strip">
        <div className={`gaze-strip-card active ${stepStatus === 'COMPLETED' ? 'done' : ''}`}>
          <div className="gaze-strip-thumb">
            {reviewCandidate?.dataUrl ? (
              <img src={reviewCandidate.dataUrl} alt="Hirschberg" className="gaze-strip-img" />
            ) : (
              <span className="gaze-strip-placeholder">H</span>
            )}
          </div>
          <span className="gaze-strip-title">Hirschberg</span>
          <span className="gaze-strip-badge">
            {stepStatus === 'COMPLETED' ? '✓ Đã kiểm tra' : 'Đang thực hiện'}
          </span>
        </div>
      </div>
    </div>
  );
}

import './hirschbergOutcome.css';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { hirschbergGuideVideo } from '../../content/hirschbergGuideVideo.js';
import AudioButton from '../audio/AudioButton';
import { predictHirschberg } from '../../api/hirschbergApi.js';
import { toHirschbergSessionResult } from '../../services/hirschbergResultService.js';
import HirschbergQualityReviewModal from './HirschbergQualityReviewModal.jsx';
import { inspectHirschbergImage } from '../../services/hirschbergQualityPrescreenService.js';


/**
 * HirschbergStep (B1 - Hirschberg Screening)
 *
 * Primary default screening step:
 * 1. Instruction: Guide user on camera posture, 30–50 cm distance, head straight, target fixation, lighting.
 * 2. Upload / Photo Capture: User selects or takes a photo.
 * 3. Quality Gate: Inspects face, both eyes, openness, blur, lighting, corneal reflex before inference.
 * 4. AI Analysis: Calls the trained Hirschberg multipart API (/api/v1/hirschberg/predict).
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
  const inspectionVersionRef = useRef(0);
  const [orientation, setOrientation] = useState('auto');
  const [fixation, setFixation] = useState('unknown');

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
      inspectionVersionRef.current += 1;
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

          const eligibility = preparationData?.eligibility || {};
          if (eligibility.guardianConsent === false || eligibility.redFlagPresent) {
            hirschbergResult = { status: 'INELIGIBLE', message: eligibility.guardianConsent === false
              ? 'Cần xác nhận đồng ý tham gia sàng lọc trước khi phân tích.'
              : 'Có dấu hiệu cần khám chuyên khoa trước khi sàng lọc tự động.' };
          } else {
            hirschbergResult = await predictHirschberg(captureRecord.image || captureRecord.originalFrame, {
              signal: controller.signal, orientation, fixation, sessionId,
            });
          }
        } catch (err) {
          if (err.name === 'AbortError') return;
          console.warn('Hirschberg backend warning:', err);
          hirschbergResult = {
            status: 'SYSTEM_ERROR', message: err.userMessage || err.message || 'Không thể kết nối hệ thống AI. Vui lòng thử lại.',
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
        ...toHirschbergSessionResult(hirschbergResult),
      });
    },
    [onComplete, preparationData, sessionId, orientation, fixation]
  );

  // File upload handler
  const handleFileUpload = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const inspectionVersion = ++inspectionVersionRef.current;
      event.target.value = '';

      setReviewCandidate(null);
      setOrientation('auto');
      setFixation('unknown');
      setStepStatus('REVIEWING');
      setIsInspecting(true);
      setAnalysisError(null);

      try {
        const result = await inspectHirschbergImage(file, { distanceCm: null });
        if (inspectionVersion !== inspectionVersionRef.current) return;

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
        if (inspectionVersion !== inspectionVersionRef.current) return;
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
        if (inspectionVersion === inspectionVersionRef.current) setIsInspecting(false);
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
    inspectionVersionRef.current += 1;
    setIsInspecting(false);
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
          <figure className="hirschberg-guide-video">
            <video controls playsInline preload="none" aria-label="Video hướng dẫn chụp ảnh Hirschberg"
              src={hirschbergGuideVideo.src}>
              Trình duyệt không hỗ trợ video. <a href={hirschbergGuideVideo.src}>Mở video</a>.
            </video>
            <figcaption>{hirschbergGuideVideo.caption}</figcaption>
          </figure>

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
      {stepStatus === 'REVIEWING' && (
        <HirschbergQualityReviewModal
          imageDataUrl={reviewCandidate?.dataUrl}
          validation={reviewCandidate?.validation}
          isInspecting={isInspecting}
          isAnalyzing={isAnalyzing}
          analysisError={analysisError}
          orientation={orientation}
          onOrientationChange={setOrientation}
          fixation={fixation}
          onFixationChange={setFixation}
          canSubmit={Boolean(reviewCandidate?.captureRecord)}
          onConfirm={handleConfirmReview}
          onRetake={handleRetake}
          onReupload={handleTriggerUpload}
        />
      )}
    </div>
  );
}

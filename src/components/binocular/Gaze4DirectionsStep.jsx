import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Gaze4DirectionsQualityGate,
  captureGazeFrameDataUrl,
  captureBilateralEyeRoi,
} from '../../services/cv/gaze4DirectionsQualityGate.js';
import { evaluateResearchFrameQuality } from '../../services/cv/researchQualityGate.js';
import CameraView from '../CameraView';
import AudioButton from '../audio/AudioButton';
import { measureResearchGeometry } from '../../api/researchMeasurementApi.js';
import HirschbergQualityReviewModal from './HirschbergQualityReviewModal.jsx';
import {
  inspectHirschbergImage,
  validateHirschbergQuality,
  loadImageElement,
} from '../../services/hirschbergQualityPrescreenService.js';

const HIRSCHBERG_CAPTURE_CONFIG = {
  id: 'hirschberg',
  direction: 'straight',
  name: 'HIRSCHBERG',
  label: 'HIRSCHBERG',
  stepNumber: '1/1',
  voiceText: 'Nhìn thẳng vào chấm ở giữa màn hình và giữ yên nghen.',
  targetPosition: { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' },
  arrowHint: 'Nhìn thẳng vào chấm sáng',
};

/**
 * Hirschberg capture & upload step with AI quality pre-screening.
 * Allows users to either capture live via camera or upload an image file.
 * Evaluates image quality (face, eyes, head pose, focus, exposure, reflex) before submitting to AI.
 */
export default function Gaze4DirectionsStep({
  videoRef,
  stream,
  landmarks,
  positionReport,
  preparationData,
  sessionId,
  onComplete,
  speak,
  isVoiceEnabled = true,
  toggleSound,
  onVideoReady,
}) {
  // Status state: 'OBSERVING' | 'CAPTURING' | 'REVIEWING' | 'SUCCESS_TRANSITION' | 'COMPLETED'
  const [stepStatus, setStepStatus] = useState('OBSERVING');

  // Input mode: 'CAMERA' | 'UPLOAD'
  const [inputMode, setInputMode] = useState('CAMERA');
  const fileInputRef = useRef(null);

  // Pre-screening review candidate
  const [reviewCandidate, setReviewCandidate] = useState(null);
  const [isInspecting, setIsInspecting] = useState(false);

  // Real-time quality gate feedback
  const [progressRatio, setProgressRatio] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isPassing, setIsPassing] = useState(false);
  const [countdownPhase, setCountdownPhase] = useState(null); // null | '1' | '2' | 'snap'
  const [isOrienting, setIsOrienting] = useState(true);

  // Captured images store
  const [captures, setCaptures] = useState({});

  // Strabismus Deep Learning screening state for STRAIGHT gaze
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const isAnalyzingRef = useRef(false);
  const abortControllerRef = useRef(null);

  // Abort in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Quality gate instance (2100ms stable hold for 1... 2... Chụp!)
  const gateRef = useRef(
    new Gaze4DirectionsQualityGate({
      requiredStableMs: 2100,
      minDistanceCm: 20,
      maxDistanceCm: 25,
    })
  );

  // Audio speech tracking refs to avoid duplicate speaks
  const spokenIntroRef = useRef(false);
  const spokenOneRef = useRef(false);
  const spokenTwoRef = useRef(false);
  const spokenSnapRef = useRef(false);
  const orientTimeoutRef = useRef(null);

  // Flash animation state
  const [showShutterFlash, setShowShutterFlash] = useState(false);
  const [videoAspect, setVideoAspect] = useState(null);
  const activeConfig = HIRSCHBERG_CAPTURE_CONFIG;
  const estimatedDistanceCm =
    positionReport?.stableDistanceCm ?? positionReport?.estimatedDistanceCm ?? null;

  const handleVideoReady = useCallback(
    (videoEl) => {
      if (onVideoReady) onVideoReady(videoEl);
      if (videoEl?.videoWidth && videoEl?.videoHeight) {
        setVideoAspect(`${videoEl.videoWidth} / ${videoEl.videoHeight}`);
      }
    },
    [onVideoReady]
  );

  const buildCaptureRecord = useCallback(
    ({ gateResult = null, manual = false } = {}) => {
      const capturedDataUrl = captureGazeFrameDataUrl(videoRef.current);

      let eyeRoiDataUrl = null;
      let eyeRoiBox = null;
      const roiRes = captureBilateralEyeRoi(videoRef.current, landmarks);
      if (roiRes?.bothEyesDetected && roiRes?.dataUrl) {
        eyeRoiDataUrl = roiRes.dataUrl;
        eyeRoiBox = roiRes.roiBox;
      }

      const researchLandmarks = landmarks
        ? landmarks.slice(0, 478).map((p) => ({
            x: Number(p.x.toFixed(5)),
            y: Number(p.y.toFixed(5)),
            z: typeof p.z === 'number' ? Number(p.z.toFixed(5)) : undefined,
          }))
        : null;
      const researchQuality = evaluateResearchFrameQuality({
        video: videoRef.current,
        landmarks,
        distanceCm: estimatedDistanceCm,
        gazeGateResult: gateResult,
        positionReport,
      });

      return {
        direction: activeConfig.id,
        directionName: activeConfig.name,
        method: 'HIRSCHBERG',
        timestamp: new Date().toISOString(),
        image: capturedDataUrl,
        originalFrame: capturedDataUrl,
        eyeRoi: eyeRoiDataUrl,
        roiBox: eyeRoiBox,
        landmarks: landmarks
          ? landmarks.slice(0, 478).map((p) => ({ x: Number(p.x.toFixed(3)), y: Number(p.y.toFixed(3)) }))
          : null,
        researchLandmarks,
        qualityScore: gateResult?.qualityScore ?? (manual ? 0.95 : null),
        distanceCm: estimatedDistanceCm,
        gazeOffsets: gateResult?.gazeOffsets ?? { meanDx: 0, meanDy: 0 },
        researchQuality,
        backendResearchPayload: {
          payloadType: 'HIRSCHBERG_ORIGINAL_FRAME_WITH_METADATA',
          preparedOnly: false,
          imageField: 'originalFrame',
          metadata: {
            ...researchQuality.metadata,
            landmarks: researchLandmarks,
          },
          quality: researchQuality.checks,
        },
      };
    },
    [activeConfig, estimatedDistanceCm, landmarks, positionReport, videoRef]
  );

  useEffect(() => {
    const v = videoRef?.current;
    if (v && v.videoWidth && v.videoHeight) {
      setVideoAspect(`${v.videoWidth} / ${v.videoHeight}`);
    }
  }, [videoRef, stream]);

  // Announce Hirschberg capture and give a short grace period to orient eyes.
  useEffect(() => {
    gateRef.current.reset();
    spokenIntroRef.current = false;
    spokenOneRef.current = false;
    spokenTwoRef.current = false;
    spokenSnapRef.current = false;
    setCountdownPhase(null);
    setProgressRatio(0);
    setIsPassing(false);
    setIsOrienting(true);

    if (activeConfig && isVoiceEnabled && speak) {
      speak(activeConfig.voiceText);
      spokenIntroRef.current = true;
    }

    if (orientTimeoutRef.current) clearTimeout(orientTimeoutRef.current);
    const orientDelay = 500;
    orientTimeoutRef.current = setTimeout(() => {
      setIsOrienting(false);
    }, orientDelay);

    return () => {
      if (orientTimeoutRef.current) clearTimeout(orientTimeoutRef.current);
    };
  }, [activeConfig, isVoiceEnabled, speak]);

  const activeConfigRef = useRef(activeConfig);
  const capturesRef = useRef(captures);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    activeConfigRef.current = activeConfig;
    capturesRef.current = captures;
    onCompleteRef.current = onComplete;
  }, [activeConfig, captures, onComplete]);

  const buildResearchMeasurementPayload = useCallback(
    (captureRecord) => {
      const eligibility = preparationData?.eligibility || {};
      const qualityMeta = captureRecord?.researchQuality?.metadata || {};
      const distanceBucket =
        qualityMeta.distanceBucket ||
        captureRecord?.researchQuality?.checks?.distance?.bucket ||
        'UNKNOWN';

      return {
        schemaVersion: 'remicare-research-quality-v0.1',
        featureVersion: 'research-geometry-v0.1',
        protocolVersion: 'hirschberg-photo-v1',
        configVersion: 'TODO_PILOT',
        testType: 'HIRSCHBERG',
        sessionId: sessionId || `client-${Date.now()}`,
        requestId: `hirschberg-${Date.now()}`,
        distance_bucket: distanceBucket,
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

  // Finalizes the Hirschberg capture and calls the research geometry endpoint.
  const handleFinalizeGazeStep = useCallback(
    async (newCaptureRecord, currentCaptures) => {
      const currentConfig = activeConfigRef.current;
      const updatedCaptures = {
        ...currentCaptures,
        ...capturesRef.current,
        [currentConfig.id]: newCaptureRecord,
      };
      setCaptures(updatedCaptures);

      let hirschbergResult = null;

      if (newCaptureRecord?.originalFrame && newCaptureRecord?.researchLandmarks?.length >= 478) {
        try {
          setIsAnalyzing(true);
          isAnalyzingRef.current = true;
          setAnalysisError(null);

          const controller = new AbortController();
          abortControllerRef.current = controller;

          hirschbergResult = await measureResearchGeometry(
            buildResearchMeasurementPayload(newCaptureRecord),
            {
              signal: controller.signal,
              timeoutMs: 20000,
            }
          );
        } catch (err) {
          if (err.name === 'AbortError') {
            console.log('Hirschberg research measurement was aborted.');
            return;
          }
          console.warn('Hirschberg research measurement warning / fallback:', err);
          hirschbergResult = {
            status: 'INCONCLUSIVE',
            result: 'SYSTEM_ERROR',
            reasonCodes: ['RESEARCH_BACKEND_UNAVAILABLE'],
            measurements: {},
            quality: newCaptureRecord?.researchQuality || {},
            experimental: true,
            message: err.userMessage || 'Không thể kết nối backend Hirschberg nghiên cứu.',
          };
        } finally {
          setIsAnalyzing(false);
          isAnalyzingRef.current = false;
        }
      } else {
        hirschbergResult = {
          status: 'INCONCLUSIVE',
          result: 'INVALID_LANDMARKS',
          reasonCodes: ['ORIGINAL_FRAME_OR_LANDMARKS_MISSING'],
          measurements: {},
          quality: newCaptureRecord?.researchQuality || {},
          experimental: true,
          message: 'Không đủ ảnh gốc hoặc landmarks để đo Hirschberg.',
        };
      }

      setStepStatus('COMPLETED');
      if (isVoiceEnabled && speak) {
        speak('Giờ mình lùi ra xa một chút nghen.');
      }

      const fullGazeTrackingData = {
        method: 'HIRSCHBERG',
        distanceCm: '20-25',
        completedAt: new Date().toISOString(),
        researchQualitySchema: 'remicare-research-quality-v0.1',
        aiPayloadPolicy: {
          diagnosticModelInput: 'not_used_in_hirschberg_step',
          researchImageInput: 'original_hirschberg_frame_with_metadata',
          backendResearchTransfer: 'POST /api/v1/research/measurements',
        },
        captures: updatedCaptures,
        hirschbergResult,
        strabismusResult: {
          status: 'INCONCLUSIVE',
          prediction: 'INCONCLUSIVE',
          confidence: null,
          confidence_type: 'NONE',
          screening_status: 'HIRSCHBERG_MEASUREMENT_ONLY',
          quality: hirschbergResult?.status || 'INCONCLUSIVE',
          quality_score: newCaptureRecord?.qualityScore || null,
          message:
            'Bước này đã chuyển sang Hirschberg đo hình học nghiên cứu; không chạy model ảnh ROI cũ.',
          hirschbergResult,
        },
      };

      if (onCompleteRef.current) {
        onCompleteRef.current(fullGazeTrackingData);
      }
    },
    [buildResearchMeasurementPayload, isVoiceEnabled, speak]
  );

  // Triggers pre-screening quality review modal for a captured frame
  const triggerPreScreenReview = useCallback(
    async (captureRecord) => {
      setStepStatus('REVIEWING');
      setIsInspecting(true);
      setShowShutterFlash(true);
      setTimeout(() => setShowShutterFlash(false), 250);

      try {
        const img = await loadImageElement(captureRecord.originalFrame);
        const validation = validateHirschbergQuality({
          element: img,
          landmarks: captureRecord.researchLandmarks || landmarks,
          distanceCm: estimatedDistanceCm,
        });

        setReviewCandidate({
          dataUrl: captureRecord.originalFrame,
          landmarks: captureRecord.researchLandmarks || landmarks,
          captureRecord,
          validation,
          source: 'CAMERA',
        });
      } catch (err) {
        console.error('Prescreen review error:', err);
        setReviewCandidate({
          dataUrl: captureRecord.originalFrame,
          landmarks: captureRecord.researchLandmarks || landmarks,
          captureRecord,
          validation: {
            isAcceptable: false,
            title: 'Lỗi kiểm tra chất lượng',
            summary: err.message || 'Không thể kiểm tra chất lượng ảnh chụp.',
            errors: [
              {
                code: 'INSPECT_ERROR',
                label: 'Lỗi đọc ảnh',
                tip: 'Vui lòng thử chụp lại.',
              },
            ],
            warnings: [],
            passedChecks: [],
            metrics: {},
          },
          source: 'CAMERA',
        });
      } finally {
        setIsInspecting(false);
      }
    },
    [estimatedDistanceCm, landmarks]
  );

  // File upload handler
  const handleFileUpload = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setInputMode('UPLOAD');
      setStepStatus('REVIEWING');
      setIsInspecting(true);
      setAnalysisError(null);

      try {
        const result = await inspectHirschbergImage(file, {
          distanceCm: estimatedDistanceCm,
        });

        const researchLandmarks = result.landmarks
          ? result.landmarks.slice(0, 478).map((p) => ({
              x: Number(p.x.toFixed(5)),
              y: Number(p.y.toFixed(5)),
              z: typeof p.z === 'number' ? Number(p.z.toFixed(5)) : undefined,
            }))
          : null;

        const captureRecord = {
          direction: activeConfig.id,
          directionName: activeConfig.name,
          method: 'HIRSCHBERG_UPLOAD',
          timestamp: new Date().toISOString(),
          image: result.dataUrl,
          originalFrame: result.dataUrl,
          eyeRoi: null,
          roiBox: null,
          landmarks: researchLandmarks,
          researchLandmarks,
          qualityScore: result.validation.isAcceptable ? 0.95 : 0.4,
          distanceCm: estimatedDistanceCm,
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
          source: 'UPLOAD',
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
          source: 'UPLOAD',
        });
      } finally {
        setIsInspecting(false);
        if (event.target) event.target.value = '';
      }
    },
    [activeConfig, estimatedDistanceCm]
  );

  // Confirms the pre-screened photo and sends to backend AI
  const handleConfirmReview = useCallback(async () => {
    if (!reviewCandidate?.captureRecord || !reviewCandidate?.validation?.isAcceptable) return;
    await handleFinalizeGazeStep(reviewCandidate.captureRecord, captures);
  }, [handleFinalizeGazeStep, reviewCandidate, captures]);

  // Retake photo: resets review and returns to live camera
  const handleRetake = useCallback(() => {
    setReviewCandidate(null);
    setStepStatus('OBSERVING');
    setInputMode('CAMERA');
    gateRef.current.reset();
    spokenIntroRef.current = false;
    spokenOneRef.current = false;
    spokenTwoRef.current = false;
    spokenSnapRef.current = false;
  }, []);

  // Trigger file upload dialog
  const handleTriggerReupload = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  // Main evaluation frame loop
  useEffect(() => {
    if (stepStatus !== 'OBSERVING') return;

    if (isOrienting) {
      setFeedbackMessage('Đang hướng dẫn... Cô chú nhìn thẳng vào chấm ở giữa màn hình nghen.');
      return;
    }

    const gate = gateRef.current;
    const res = gate.evaluate({
      landmarks,
      targetDirection: 'straight',
      distanceCm: estimatedDistanceCm,
      timestampMs: performance.now(),
    });

    setProgressRatio(res.progressRatio);
    setIsPassing(res.isPassing);
    setCountdownPhase(res.countdownPhase);
    setFeedbackMessage(res.feedbackText);

    // Audible Countdown Rhythm: "Một..." -> "Hai..." -> "Chụp!"
    if (res.countdownPhase === '1' && !spokenOneRef.current) {
      spokenOneRef.current = true;
      if (isVoiceEnabled && speak) {
        speak('Một...');
      }
    } else if (res.countdownPhase === '2' && !spokenTwoRef.current) {
      spokenTwoRef.current = true;
      if (isVoiceEnabled && speak) {
        speak('Hai...');
      }
    } else if (res.countdownPhase === null) {
      // User looked away, blinked, or lost alignment -> reset countdown speech triggers
      spokenOneRef.current = false;
      spokenTwoRef.current = false;
      spokenSnapRef.current = false;
    }

    // Trigger auto-capture if Quality Gate is fulfilled (~2.1s stable hold)
    if (res.isReadyToCapture) {
      if (isVoiceEnabled && speak && !spokenSnapRef.current) {
        spokenSnapRef.current = true;
        speak('Chụp!');
      }

      const captureRecord = buildCaptureRecord({ gateResult: res });
      gate.reset();
      triggerPreScreenReview(captureRecord);
    }
  }, [
    landmarks,
    stepStatus,
    isOrienting,
    activeConfig,
    estimatedDistanceCm,
    videoRef,
    isVoiceEnabled,
    speak,
    buildCaptureRecord,
    triggerPreScreenReview,
  ]);

  // Click-to-snap handler: allows instant capture on clicking the target
  const handleManualSnap = () => {
    if (isAnalyzing || stepStatus !== 'OBSERVING') return;

    if (isVoiceEnabled && speak && !spokenSnapRef.current) {
      spokenSnapRef.current = true;
      speak('Chụp!');
    }

    const captureRecord = buildCaptureRecord({ manual: true });
    gateRef.current.reset();
    triggerPreScreenReview(captureRecord);
  };

  // Circumference for circular progress ring (r = 36, perimeter = 2 * PI * 36 ~= 226)
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progressRatio * circumference;
  const compactFeedback = isOrienting
    ? activeConfig.voiceText
    : isPassing
    ? 'Giữ yên...'
    : feedbackMessage || activeConfig.voiceText;

  return (
    <div className="card stage-card-main gaze-4-directions-card">
      {/* Shutter flash overlay */}
      {showShutterFlash && <div className="gaze-shutter-flash" />}

      {/* Hirschberg input mode switcher: Camera vs Upload */}
      <div className="hirschberg-mode-toolbar">
        <button
          type="button"
          className={`btn-mode-tab ${inputMode === 'CAMERA' ? 'active' : ''}`}
          onClick={() => {
            setInputMode('CAMERA');
            if (stepStatus === 'REVIEWING') handleRetake();
          }}
        >
          📷 Camera trực tiếp
        </button>

        <button
          type="button"
          className={`btn-mode-tab ${inputMode === 'UPLOAD' ? 'active' : ''}`}
          onClick={handleTriggerReupload}
          title="Chọn ảnh khuôn mặt rõ nét từ thiết bị"
        >
          📁 Tải ảnh từ thiết bị
        </button>

        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </div>

      {/* Hirschberg backend measurement overlay */}
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

      {/* Analysis Error / Inconclusive Notice */}
      {analysisError && !isAnalyzing && (
        <div className="gaze-error-banner fade-in">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{analysisError}</span>
          <button
            type="button"
            className="btn btn-sm btn-retry-error"
            onClick={() => setAnalysisError(null)}
          >
            Chụp lại
          </button>
        </div>
      )}

      {/* Header bar with direction and step counter */}
      <div className="gaze-step-header">
        <div className="gaze-header-left">
          <span className="badge badge-primary">Hirschberg</span>
          <span className="badge badge-secondary">{activeConfig.stepNumber}</span>
        </div>

        <div className="gaze-header-center">
          <h2 className="gaze-current-direction-title">
            <span className="highlight-dir">{activeConfig.label}</span>
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

      {/* Main Video Viewport with Fixed Target Overlay */}
      <div
        className="gaze-camera-viewport"
        style={{
          '--camera-aspect-ratio': videoAspect || undefined,
        }}
      >
        <CameraView
          videoRef={videoRef}
          stream={stream}
          landmarks={landmarks}
          onVideoReady={handleVideoReady}
          showLandmarkPoints={false}
          showMeshConnections={false}
        />

        {/* 1 FIXED NON-MOVING TARGET */}
        {stepStatus === 'OBSERVING' && (
          <div
            className={`gaze-fixed-target-wrapper target-${activeConfig.id}`}
            style={{ ...activeConfig.targetPosition, pointerEvents: 'auto', cursor: 'pointer' }}
            onClick={handleManualSnap}
            title={`${activeConfig.arrowHint} (tự chụp hoặc bấm vào để chụp ngay)`}
          >
            <div className="target-ring-container">
              {/* SVG Circular Progress Ring */}
              <svg className="target-progress-ring" width="88" height="88" viewBox="0 0 88 88">
                <circle className="target-ring-bg" cx="44" cy="44" r={radius} fill="none" />
                <circle
                  className="target-ring-fill"
                  cx="44"
                  cy="44"
                  r={radius}
                  fill="none"
                  style={{
                    strokeDasharray: circumference,
                    strokeDashoffset,
                  }}
                />
              </svg>

              {/* Glowing Target Core with Countdown Number (1, 2, snap) */}
              <div
                className={`target-glowing-core ${countdownPhase ? 'counting' : ''} ${
                  isPassing ? 'core-locking' : ''
                }`}
              >
                {countdownPhase === 'snap' ? (
                  <span className="core-counter-text">OK</span>
                ) : countdownPhase === '2' ? (
                  <span className="core-counter-text">2</span>
                ) : countdownPhase === '1' ? (
                  <span className="core-counter-text">1</span>
                ) : (
                  <span className="core-bullseye-icon">•</span>
                )}
              </div>
            </div>

            {/* Direction Arrow Hint */}
            <div className="target-floating-hint">
              <span>{activeConfig.arrowHint}</span>
              <span style={{ fontSize: '0.72rem', opacity: 0.85, marginLeft: '6px' }}>
                • Tự chụp hoặc bấm để chụp
              </span>
            </div>
          </div>
        )}

        {/* Distance Range Indicator Banner */}
        <div className="gaze-distance-badge">
          {estimatedDistanceCm !== null ? (
            estimatedDistanceCm > 25 ? (
              <span className="dist-pill dist-far">Gần hơn ({estimatedDistanceCm} cm)</span>
            ) : estimatedDistanceCm < 20 ? (
              <span className="dist-pill dist-close">Xa hơn ({estimatedDistanceCm} cm)</span>
            ) : (
              <span className="dist-pill dist-ok">✓ {estimatedDistanceCm} cm</span>
            )
          ) : (
            <span className="dist-pill dist-detecting">Đang đo cự ly...</span>
          )}
        </div>

        {/* Real-time Voice Guidance & Feedback Subtitle Bar */}
        <div className="gaze-feedback-bottom-bar">
          <div className="feedback-voice-bubble">
            <span className="voice-icon">🔊</span>
            <span className="feedback-text">{compactFeedback}</span>
          </div>

          {/* Linear Progress Bar for Hold Stability */}
          <div className="gaze-hold-progress-bar-bg">
            <div
              className="gaze-hold-progress-bar-fill"
              style={{ width: `${progressRatio * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Pre-screening Review Modal when photo is captured or uploaded */}
      {stepStatus === 'REVIEWING' && reviewCandidate && (
        <HirschbergQualityReviewModal
          imageDataUrl={reviewCandidate.dataUrl}
          validation={reviewCandidate.validation}
          isInspecting={isInspecting}
          isAnalyzing={isAnalyzing}
          analysisError={analysisError}
          onConfirm={handleConfirmReview}
          onRetake={handleRetake}
          onReupload={handleTriggerReupload}
        />
      )}

      {/* Captured Hirschberg thumbnail strip */}
      <div className="gaze-capture-strip">
        {(() => {
          const cap = captures[HIRSCHBERG_CAPTURE_CONFIG.id];
          const isDone = Boolean(cap);
          return (
            <div className={`gaze-strip-card active ${isDone ? 'done' : ''}`}>
              <div className="gaze-strip-thumb">
                {isDone && cap?.image ? (
                  <img src={cap.image} alt="Hirschberg" className="gaze-strip-img" />
                ) : (
                  <span className="gaze-strip-placeholder">H</span>
                )}
              </div>
              <span className="gaze-strip-title">Hirschberg</span>
              <span className="gaze-strip-badge">{isDone ? '✓ Đã kiểm tra' : 'Đang thực hiện'}</span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

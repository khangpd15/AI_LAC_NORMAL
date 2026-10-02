import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { EXPERIENCE_STAGES } from './storyData';
import CameraView from './CameraView';
import VoiceController from './VoiceController';
import './experienceVision.css';

/**
 * InteractiveCheckQuestion
 * Thẻ câu hỏi kiểm tra nhanh y khoa dành cho cha mẹ:
 * - Tối đa 1-3 câu trong toàn bộ hành trình (Giai đoạn 3, 6, 7).
 * - AI tự động đọc to câu hỏi và 2 đáp án để người không rành chữ vẫn nghe hiểu.
 * - 2 nút bấm to rõ: Nút Màu Xanh Lá vs Nút Màu Cam kèm biểu tượng trực quan.
 * - Tự động biến mất sau khi trả lời đúng để không che tầm nhìn trải nghiệm camera!
 */
function InteractiveCheckQuestion({
  question,
  userAnswer,
  onSelectOption,
  onClose,
  onReplayVoice,
  isVoiceActive,
}) {
  if (!question) return null;

  const selectedOpt = question.options.find((opt) => opt.id === userAnswer?.optionId);

  return (
    <div className="hud-question-card fade-in-up">
      <div className="hud-question-header">
        <span className="question-badge">❓ {question.title}</span>
        <div className="hud-question-header-actions">
          {isVoiceActive && (
            <span className="speaking-indicator">
              <span className="live-dot-pulse" />
              AI đang đọc giải thích…
            </span>
          )}
          {onClose && (
            <button
              type="button"
              className="btn-dismiss-question"
              onClick={onClose}
              title="Ẩn câu hỏi để trải nghiệm camera"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <h4 className="hud-question-text">{question.text}</h4>

      <div className="hud-options-grid">
        {question.options.map((opt) => {
          const isSelected = userAnswer?.optionId === opt.id;
          const isGreen = opt.color === 'green';
          return (
            <button
              key={opt.id}
              type="button"
              className={`btn-check-option btn-${opt.color} ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectOption(opt)}
            >
              <span className="option-color-chip">
                {isGreen ? '🟢 LỰA CHỌN' : '🟠 LỰA CHỌN'}
              </span>
              <span className="option-text">{opt.text}</span>
            </button>
          );
        })}
      </div>

      {/* KHUNG GIẢI THÍCH Y KHOA TƯỜNG TẬN RIÊNG BIỆT CHO TỪNG LỰA CHỌN */}
      {selectedOpt && (
        <div className={`hud-explanation-card ${selectedOpt.isCorrect ? 'explanation-correct' : 'explanation-insight'} fade-in-up`}>
          <div className="explanation-header">
            <span className="explanation-icon">{selectedOpt.isCorrect ? '🩺' : '💡'}</span>
            <div className="explanation-meta">
              <span className="explanation-badge-pill">
                {selectedOpt.isCorrect ? 'Góc nhìn Y khoa chuẩn xác' : 'Bác sĩ nhãn khoa chia sẻ thực tế'}
              </span>
              <h5 className="explanation-title">{selectedOpt.explanationTitle}</h5>
            </div>
          </div>

          <p className="explanation-detail">{selectedOpt.explanationDetail}</p>

          <div className="explanation-footer">
            <button
              type="button"
              className="btn-replay-explanation"
              onClick={() => onReplayVoice?.(selectedOpt.feedbackVoice)}
              title="Nghe lại giọng đọc giải thích của bác sĩ"
            >
              🔊 Nghe lại giọng đọc
            </button>
            <button
              type="button"
              className="btn-confirm-understood"
              onClick={onClose}
              title="Đóng câu hỏi để trải nghiệm camera"
            >
              ✕ Thu gọn câu hỏi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ExperienceVisionPage
 * Trải nghiệm góc nhìn lác lé Fullscreen Camera Realtime cho phụ huynh.
 */
export default function ExperienceVisionPage({
  onStartScreening,
  onExit,
  className = '',
}) {
  // Journey state: 'START_PROMPT' | 'CAMERA_READY' | 'IN_EXPERIENCE'
  const [sessionPhase, setSessionPhase] = useState('START_PROMPT');
  const [currentStageIdx, setCurrentStageIdx] = useState(0);

  // Camera & Voice flags
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);

  // Track user answers per stage: { [stageId]: { optionId, isCorrect } }
  const [userAnswers, setUserAnswers] = useState({});

  // Question visibility per stage
  const [showQuestion, setShowQuestion] = useState(false);

  // Voice narration text dynamically switches between stage story, question, and feedback
  const [speakingText, setSpeakingText] = useState('');

  // Giai đoạn 7: AI nhận diện che mắt trái / phải
  const [isEyeCovered, setIsEyeCovered] = useState(false);
  const [aiDetectedSide, setAiDetectedSide] = useState(null);
  const [hasTestedCover, setHasTestedCover] = useState(false);

  const activeStage = EXPERIENCE_STAGES[currentStageIdx] || EXPERIENCE_STAGES[0];
  const totalStages = EXPERIENCE_STAGES.length - 1; // 7 stages + 1 ending
  const isEndingStage = activeStage.id === 8;
  const isStage7 = activeStage.id === 7 || activeStage.effect === 'severeAmblyopia';

  const activeStageRef = useRef(activeStage);
  useEffect(() => {
    activeStageRef.current = activeStage;
  }, [activeStage]);

  // When changing stages, set initial voice text and reset stage-specific states
  useEffect(() => {
    if (sessionPhase === 'IN_EXPERIENCE') {
      setSpeakingText(activeStage.voiceText);
      setShowQuestion(false);
      setIsEyeCovered(false);
      setAiDetectedSide(null);
      setHasTestedCover(false);
    }
  }, [currentStageIdx, sessionPhase, activeStage]);

  // Handle camera permission granted
  const handleCameraReady = useCallback(() => {
    setSessionPhase((prev) => (prev === 'START_PROMPT' ? 'CAMERA_READY' : prev));
  }, []);

  // Start camera on user click
  const handleEnableCamera = () => {
    setIsCameraActive(true);
  };

  // Begin experience journey
  const handleStartExperience = () => {
    setSessionPhase('IN_EXPERIENCE');
    setCurrentStageIdx(0);
  };

  // Voice completion callback
  const handleVoiceComplete = useCallback(() => {
    const stage = activeStageRef.current;
    // In stages 3 & 6: after stage voice, reveal question if not answered
    // In stage 7: let user test covering eye first, do NOT auto-reveal here
    if (stage?.question && !showQuestion && stage.id !== 7 && !userAnswers[stage.id]) {
      setShowQuestion(true);
      setSpeakingText(stage.question.voiceText);
    }
  }, [showQuestion, userAnswers]);

  const hasSpokenCoverFeedbackRef = useRef(false);
  useEffect(() => {
    hasSpokenCoverFeedbackRef.current = false;
  }, [currentStageIdx]);

  // Realtime AI Eye & Hand Occlusion Detection callback (Từ MediaPipe FaceMesh)
  const handleEyeCoverDetected = useCallback((data) => {
    if (activeStageRef.current?.id === 7) {
      if (data.isCovered) {
        setIsEyeCovered(true);
        setAiDetectedSide(data.side || 'one_eye');
        setHasTestedCover(true);
        if (!hasSpokenCoverFeedbackRef.current) {
          hasSpokenCoverFeedbackRef.current = true;
          setSpeakingText('Bạn đang trải nghiệm góc nhìn của mắt bị nhược thị nặng. Hình ảnh rất tối và mờ. Khi đã sẵn sàng, ba mẹ hãy bấm nút Tiếp theo ở góc dưới.');
        }
      } else {
        setIsEyeCovered(false);
        setAiDetectedSide(null);
      }
    }
  }, []);



  // Handle Option selection
  const handleSelectOption = useCallback((option) => {
    const stage = activeStageRef.current;
    if (!stage) return;

    const isCorrect = option.isCorrect;

    setUserAnswers((prev) => ({
      ...prev,
      [stage.id]: {
        optionId: option.id,
        isCorrect: isCorrect,
      },
    }));

    // AI reads feedback voice
    if (option.feedbackVoice) {
      setSpeakingText(option.feedbackVoice);
    }
  }, []);

  // Determine if user can proceed to next stage
  const hasQuestion = Boolean(activeStage.question);
  const isQuestionAnswered = Boolean(userAnswers[activeStage.id]);
  const canProceed = isStage7 ? hasTestedCover : (!hasQuestion || isQuestionAnswered);

  // Navigation: Next / Prev
  const handleNext = () => {
    if (canProceed && currentStageIdx < EXPERIENCE_STAGES.length - 1) {
      setCurrentStageIdx((prev) => prev + 1);
      setIsEyeCovered(false);
    }
  };

  const handlePrev = () => {
    if (currentStageIdx > 0) {
      setCurrentStageIdx((prev) => prev - 1);
      setIsEyeCovered(false);
    }
  };

  const handleRestart = () => {
    setCurrentStageIdx(0);
    setUserAnswers({});
    setShowQuestion(false);
    setIsEyeCovered(false);
    setSessionPhase('IN_EXPERIENCE');
  };

  // Options bundle for VisualEffectEngine
  const effectOptions = useMemo(() => ({
    isEyeCovered,
  }), [isEyeCovered]);

  // Fallback: click viewport in Stage 7 to toggle eye cover
  const handleViewportClick = useCallback(() => {
    if (activeStageRef.current?.id === 7) {
      setIsEyeCovered((prev) => {
        const next = !prev;
        if (next) setHasTestedCover(true);
        return next;
      });
    }
  }, []);

  return (
    <div className={`experience-fullscreen-container ${className}`}>
      {/* Background Camera Realtime Engine */}
      <CameraView
        effect={sessionPhase === 'IN_EXPERIENCE' ? activeStage.effect : 'normal'}
        effectOptions={effectOptions}
        isCameraActive={isCameraActive}
        onCameraReady={handleCameraReady}
        onEyeCoverDetected={handleEyeCoverDetected}
        onClick={handleViewportClick}
      />

      {/* Subtle Top-Right Exit */}
      {onExit && (
        <button
          type="button"
          className="btn-fullscreen-exit"
          onClick={onExit}
          title="Thoát về màn hình Sàng lọc"
        >
          <span>✕ Thoát</span>
        </button>
      )}

      {/* ==================================================================
          1. MÀN HÌNH BẮT ĐẦU (2 BƯỚC: Bật camera -> Nhấn Bắt đầu)
          ================================================================== */}
      {sessionPhase !== 'IN_EXPERIENCE' && (
        <div className={`fullscreen-welcome-backdrop ${sessionPhase === 'CAMERA_READY' ? 'camera-ready-preview' : ''}`}>
          <div className="welcome-cinematic-card fade-in">
            <span className="welcome-tag">TRẢI NGHIỆM GÓC NHÌN</span>

            <h1 className="welcome-headline">
              "Bạn đã sẵn sàng trải nghiệm thế giới qua một góc nhìn khác?"
            </h1>

            <div className="welcome-camera-icon" aria-hidden="true">
              <span>📷</span>
            </div>

            <p className="welcome-subtext">
              Camera sẽ được sử dụng để<br />tạo hiệu ứng thị giác realtime.
            </p>

            <div className="welcome-actions-cluster">
              {sessionPhase === 'START_PROMPT' && (
                <button
                  type="button"
                  className="btn-cinematic-primary pulse-glow"
                  onClick={handleEnableCamera}
                  id="btn-enable-camera"
                >
                  <span>Bật camera</span>
                  <span className="arrow">→</span>
                </button>
              )}

              {sessionPhase === 'CAMERA_READY' && (
                <div className="camera-ready-box fade-in">
                  <div className="camera-live-indicator">
                    <span className="live-dot" />
                    <span>Camera sẵn sàng</span>
                  </div>
                  <button
                    type="button"
                    className="btn-cinematic-primary pulse-glow"
                    onClick={handleStartExperience}
                    id="btn-start-journey"
                  >
                    <span>Bắt đầu trải nghiệm</span>
                    <span className="arrow">→</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================
          2. CAMERA FULLSCREEN HUD OVERLAYS (TRONG QUÁ TRÌNH TRẢI NGHIỆM)
          ================================================================== */}
      {sessionPhase === 'IN_EXPERIENCE' && (
        <div className="fullscreen-hud-layer">
          {/* Top Bar: "Stage X • 7" + Voice Controller */}
          <div className="hud-top-bar">
            {!isEndingStage && (
              <div className="hud-minimal-indicator">
                <span>{activeStage.stageNumber} • {totalStages}</span>
              </div>
            )}

            {/* Voice Controller */}
            <VoiceController
              voiceText={speakingText}
              isVoiceEnabled={isVoiceEnabled}
              onToggleVoice={() => setIsVoiceEnabled((v) => !v)}
              onVoiceComplete={handleVoiceComplete}
            />
          </div>

          {/* Middle Zone: Floating Gesture & Check Questions */}
          <div className="hud-middle-zone">
            {/* GIAI ĐOẠN 7: DƠ TAY CHE MẮT KHỎE ĐỂ TRẢI NGHIỆM */}
            {isStage7 && (
              <div className="stage7-hud-wrapper fade-in">
                {!isEyeCovered ? (
                  <div className="stage7-instruction-box">
                    <div className="stage7-instruction-tag">TRẢI NGHIỆM GÓC NHÌN</div>
                    <h2 className="stage7-instruction-title">
                      Hãy dùng tay che mắt khỏe của bạn
                    </h2>
                    <p className="stage7-instruction-sub">
                      Tưởng tượng một bên là mắt khỏe, còn bên kia là mắt bị nhược thị nặng. Khi che mắt khỏe đi, bạn sẽ cảm nhận góc nhìn của mắt bị ảnh hưởng khó khăn như thế nào.
                    </p>
                    <div className="stage7-status-pill status-waiting">
                      <span className="live-dot-pulse" />
                      <span>● Đang chờ bạn đưa tay che mắt...</span>
                    </div>
                  </div>
                ) : (
                  <div className="stage7-active-simulation-card fade-in">
                    <div className="stage7-simulation-badge">
                      <span className="dot-red-pulse" />
                      <span>
                        {aiDetectedSide === 'left'
                          ? '✋ Đang che Mắt Trái (mắt khỏe)'
                          : aiDetectedSide === 'right'
                          ? '✋ Đang che Mắt Phải (mắt khỏe)'
                          : '✋ Đang che cả hai mắt'}
                      </span>
                    </div>

                    <h3 className="stage7-sim-title">
                      {aiDetectedSide === 'left'
                        ? 'Bạn đang nhìn bằng Mắt Phải bị ảnh hưởng (mô phỏng)'
                        : aiDetectedSide === 'right'
                        ? 'Bạn đang nhìn bằng Mắt Trái bị ảnh hưởng (mô phỏng)'
                        : 'Bạn đang che cả hai mắt'}
                    </h3>

                    <p className="stage7-sim-desc">
                      Hình ảnh trở nên rất tối, mờ và khó nhận biết chi tiết. Trẻ nhỏ bị nhược thị thường rất sợ hãi hoặc phản kháng khi mắt khỏe bị che.
                    </p>

                    <div className="stage7-disclaimer-note">
                      * Hiệu ứng mô phỏng giáo dục, không phải chẩn đoán y khoa
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CÂU HỎI KIỂM TRA NHANH (Giai đoạn 3, 6) */}
            {showQuestion && activeStage.question && (
              <InteractiveCheckQuestion
                question={activeStage.question}
                userAnswer={userAnswers[activeStage.id]}
                onSelectOption={handleSelectOption}
                onClose={() => setShowQuestion(false)}
                onReplayVoice={(voice) => setSpeakingText(voice)}
                isVoiceActive={Boolean(speakingText)}
              />
            )}

            {/* Nút nhỏ xem lại câu hỏi nếu đã trả lời xong và câu hỏi đã tự động ẩn */}
            {activeStage.question && isQuestionAnswered && !showQuestion && (
              <button
                type="button"
                className="btn-reopen-question fade-in"
                onClick={() => setShowQuestion(true)}
                title="Bấm để xem lại câu hỏi"
              >
                <span>❓ Xem lại câu hỏi</span>
              </button>
            )}

            {/* GIAI ĐOẠN 8: KẾT THÚC */}
            {isEndingStage && (
              <div className="hud-conclusion-panel fade-in-up">
                <h2 className="conclusion-headline">Hiểu con hơn. Nhận biết sớm hơn.</h2>
                <p className="conclusion-subtext">
                  Lác lé và nhược thị hoàn toàn có thể phục hồi nếu được phát hiện trước 7 tuổi. Hãy chủ động kiểm tra mắt cho bé định kỳ.
                </p>

                <div className="conclusion-actions">
                  <button
                    type="button"
                    className="btn-cinematic-cta pulse-glow"
                    onClick={onStartScreening}
                    id="btn-goto-screening"
                  >
                    <span>🔎 Bắt đầu sàng lọc hai mắt cho con</span>
                    <span className="arrow">→</span>
                  </button>

                  <button
                    type="button"
                    className="btn-cinematic-secondary"
                    onClick={handleRestart}
                  >
                    <span>↺ Trải nghiệm lại từ đầu</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ==================================================================
              3. THANH ĐIỀU HƯỚNG DƯỚI CÙNG (CỐ ĐỊNH SÁT ĐÁY MÀN HÌNH - KHÔNG BỊ CẮT)
              ================================================================== */}
          {!isEndingStage && (
            <div className="hud-bottom-stage-bar">
              {/* Stage Title & Short Prompt */}
              <div className="stage-caption-box">
                <span className="stage-prefix">Giai đoạn {activeStage.stageNumber}</span>
                <h3 className="stage-title">{activeStage.name}</h3>
                <p className="stage-prompt-text">{activeStage.promptText}</p>
              </div>

              {/* TWO BUTTONS: [← Quay lại] [Tiếp tục →] */}
              <div className="stage-nav-two-buttons">
                {currentStageIdx > 0 && (
                  <button
                    type="button"
                    className="btn-hud-nav btn-hud-prev"
                    onClick={handlePrev}
                  >
                    <span className="nav-arrow">←</span>
                    <span>Quay lại</span>
                  </button>
                )}

                {isStage7 ? (
                  hasTestedCover ? (
                    <button
                      type="button"
                      className="btn-hud-nav btn-hud-next ready-pulse"
                      onClick={handleNext}
                      id="btn-stage-next"
                      title="Bấm để tiếp tục sang Giai đoạn Kết thúc"
                    >
                      <span>Tiếp theo</span>
                      <span className="nav-arrow">→</span>
                    </button>
                  ) : (
                    <div className="stage7-pending-cue">
                      <span className="cue-dot-pulse" />
                      <span>Che mắt để tiếp tục</span>
                    </div>
                  )
                ) : (
                  <button
                    type="button"
                    className={`btn-hud-nav btn-hud-next ${canProceed ? 'ready-pulse' : 'disabled-pending'}`}
                    onClick={handleNext}
                    disabled={!canProceed}
                    id="btn-stage-next"
                    title={!canProceed ? 'Vui lòng trả lời câu hỏi bên trên để tiếp tục' : 'Bấm nút màu xanh để tiếp tục'}
                  >
                    <span>{currentStageIdx === 0 ? 'Bắt đầu trải nghiệm' : 'Tiếp tục'}</span>
                    <span className="nav-arrow">→</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

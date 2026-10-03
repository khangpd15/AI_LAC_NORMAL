/**
 * VisualEffectEngine.js
 * Realtime Canvas Rendering Engine for Experience Vision.
 * 
 * Takes realtime video stream from getUserMedia() and applies clinical vision effects:
 * - normal: High clarity, mirrored selfie view, 60fps
 * - doubleVision: Two horizontally displaced ghosted passes simulating diplopia (song thị)
 * - blur: Optical blur simulating refractive defocus & loss of high-frequency spatial details
 * - suppression: Cortical suppression with hemispheric gradient fade & central contrast wash
 * - oneEyePriority: Imbalanced cortical dominance (Split View, Dominant Eye, or Neglected Eye)
 * - amblyopia: Amblyopic neural vision (foveal deficit, crowding, contrast loss, glasses comparison)
 * - severeAmblyopia: Interactive covered-eye simulation with 6 progressive severity stages:
 *   Rõ → Mờ → Rất mờ → Giảm tương phản → Mất chi tiết → Tối mạnh
 *   Includes real-time webcam hand/eye occlusion detection!
 */

export class VisualEffectEngine {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement?.getContext?.('2d') || null;
    this.currentEffect = 'normal';
    this.effectOptions = {};
    this.isRunning = false;
    this.animationFrameId = null;
    this.startTime = performance.now();
    this.stageStartTime = performance.now();
    this.severeAmblyopiaPhase = 0; // 0 to 5
    this.mirror = true;

    // Lightweight offscreen analysis canvas for real-time hand/eye occlusion detection
    this.analysisCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (this.analysisCanvas) {
      this.analysisCanvas.width = 48;
      this.analysisCanvas.height = 36;
      this.analysisCtx = this.analysisCanvas.getContext('2d', { willReadFrequently: true });
    }
    this.lastAnalysisTime = 0;
    this.lastCoveredState = null;
    this.consecutiveCoverCount = 0;
    this.consecutiveUncoverCount = 0;
  }

  setEffect(effectName, options = {}) {
    this.currentEffect = effectName;
    this.effectOptions = options || {};
    this.stageStartTime = performance.now();
    if (options.severePhase !== undefined) {
      this.severeAmblyopiaPhase = options.severePhase;
    }
  }

  setSeverePhase(phaseIndex) {
    this.severeAmblyopiaPhase = Math.max(0, Math.min(5, phaseIndex));
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = performance.now();
    this.stageStartTime = performance.now();

    const loop = (timestamp) => {
      if (!this.isRunning) return;
      this.render(timestamp);
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  render(timestamp) {
    if (!this.ctx || !this.video || this.video.readyState < 2) {
      return;
    }

    const width = this.canvas.width;
    const height = this.canvas.height;
    if (width === 0 || height === 0) return;


    const ctx = this.ctx;
    ctx.save();

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // Apply mirror flip for natural selfie camera view
    if (this.mirror) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    // Dispatch effect renderer
    switch (this.currentEffect) {
      case 'doubleVision':
        this.renderDoubleVision(ctx, width, height, timestamp);
        break;

      case 'blur':
        this.renderBlur(ctx, width, height);
        break;

      case 'suppression':
        this.renderSuppression(ctx, width, height, timestamp);
        break;

      case 'oneEyePriority':
        this.renderOneEyePriority(ctx, width, height, timestamp);
        break;

      case 'amblyopia':
        this.renderAmblyopia(ctx, width, height, timestamp);
        break;

      case 'severeAmblyopia':
        this.renderSevereAmblyopia(ctx, width, height, timestamp);
        break;

      case 'normal':
      default:
        this.renderNormal(ctx, width, height);
        break;
    }

    ctx.restore();
  }



  /**
   * Tính toán khung vẽ tỉ lệ chuẩn (cover mode) bảo toàn nguyên vẹn aspect-ratio của camera
   * Không bị kéo dãn bề ngang, không bị dẹt khuôn mặt, cân đối ngay giữa màn hình ở tầm mắt!
   */
  getDrawRect(canvasWidth, canvasHeight) {
    const vW = this.video?.videoWidth || 1280;
    const vH = this.video?.videoHeight || 720;
    const vRatio = vW / vH;
    const cRatio = canvasWidth / canvasHeight;

    let dW, dH, dX, dY;

    if (cRatio > vRatio) {
      // Màn hình ngang hơn camera: khớp chiều rộng, cắt trên dưới cân đối
      dW = canvasWidth;
      dH = canvasWidth / vRatio;
      dX = 0;
      // Điểm vàng tầm mắt: 36% từ đỉnh để khuôn mặt và mắt luôn ở trung tâm tầm nhìn
      dY = (canvasHeight - dH) * 0.36;
    } else {
      // Màn hình dọc hơn camera: khớp chiều cao, cắt 2 bên cân đối
      dH = canvasHeight;
      dW = canvasHeight * vRatio;
      dX = (canvasWidth - dW) * 0.5;
      dY = 0;
    }

    return { x: dX, y: dY, width: dW, height: dH };
  }

  // 1. NORMAL: Crystal clear mirror stream
  renderNormal(ctx, width, height) {
    const rect = this.getDrawRect(width, height);
    ctx.filter = 'none';
    ctx.globalAlpha = 1.0;
    ctx.drawImage(this.video, rect.x, rect.y, rect.width, rect.height);
  }

  // 2. DOUBLE VISION (SONG THỊ): Two offset, semi-transparent ghosted passes
  renderDoubleVision(ctx, width, height, timestamp) {
    const rect = this.getDrawRect(width, height);
    const elapsed = timestamp - this.stageStartTime;
    const offset = 26 + Math.sin(elapsed * 0.0025) * 12;

    ctx.filter = 'none';
    ctx.globalAlpha = 0.65;
    ctx.drawImage(this.video, rect.x - offset, rect.y, rect.width, rect.height);

    ctx.globalAlpha = 0.65;
    ctx.drawImage(this.video, rect.x + offset, rect.y - 4, rect.width, rect.height);

    ctx.globalAlpha = 1.0;
  }

  // 3. BLUR: Defocus and spatial frequency degradation
  // Dual-layer approach for 100% reliability on iOS Safari WebKit & Android:
  // - Downsample to 1/14 size & upscale with bilinear smoothing in Canvas2D (works on 100% of devices)
  // - Supported by compositor-level CSS -webkit-filter on canvas element for soft defocus glow
  renderBlur(ctx, width, height) {
    const rect = this.getDrawRect(width, height);
    if (!this.blurCanvas && typeof document !== 'undefined') {
      this.blurCanvas = document.createElement('canvas');
      this.blurCtx = this.blurCanvas.getContext('2d');
    }
    if (this.blurCanvas && this.blurCtx) {
      const downW = Math.max(32, Math.round(rect.width / 14));
      const downH = Math.max(24, Math.round(rect.height / 14));
      if (this.blurCanvas.width !== downW || this.blurCanvas.height !== downH) {
        this.blurCanvas.width = downW;
        this.blurCanvas.height = downH;
      }
      this.blurCtx.drawImage(this.video, 0, 0, downW, downH);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low';
      ctx.drawImage(this.blurCanvas, 0, 0, downW, downH, rect.x, rect.y, rect.width, rect.height);
    } else {
      ctx.drawImage(this.video, rect.x, rect.y, rect.width, rect.height);
    }
  }

  // 4. SUPPRESSION: Brain dims down and cuts off misaligned image stream
  renderSuppression(ctx, width, height, timestamp) {
    const rect = this.getDrawRect(width, height);
    const elapsed = timestamp - this.stageStartTime;
    ctx.filter = 'contrast(0.7) brightness(0.85)';
    ctx.drawImage(this.video, rect.x, rect.y, rect.width, rect.height);
    ctx.filter = 'none';

    const pulseFade = 0.45 + Math.sin(elapsed * 0.002) * 0.15;
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, 'rgba(0, 84, 93, 0.05)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
    grad.addColorStop(1, `rgba(0, 0, 0, ${pulseFade + 0.3})`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // 5. ONE EYE PRIORITY: Một mắt được ưu tiên ít hơn
  // Mô phỏng trực quan: Một nửa thị trường sáng rõ (mắt khỏe), một nửa bị mờ nhạt & mất màu (mắt yếu bị bỏ quên)
  renderOneEyePriority(ctx, width, height, timestamp) {
    const rect = this.getDrawRect(width, height);
    const elapsed = timestamp - this.stageStartTime;

    // 1. Nền mắt khỏe (sáng rõ nét 100%)
    ctx.filter = 'contrast(1.05) saturate(1.05)';
    ctx.drawImage(this.video, rect.x, rect.y, rect.width, rect.height);
    ctx.filter = 'none';

    // 2. Vùng mắt yếu: Não giảm ưu tiên -> mờ nhạt, mất chi tiết
    ctx.save();
    ctx.beginPath();
    ctx.rect(width * 0.5, 0, width * 0.5, height);
    ctx.clip();

    ctx.filter = 'blur(14px) saturate(0.2) contrast(0.55) brightness(0.75)';
    ctx.drawImage(this.video, rect.x, rect.y, rect.width, rect.height);
    ctx.filter = 'none';

    // Phủ sương mờ ức chế của vỏ não
    const suppressGrad = ctx.createLinearGradient(width * 0.5, 0, width, 0);
    suppressGrad.addColorStop(0, 'rgba(10, 20, 25, 0.2)');
    suppressGrad.addColorStop(1, 'rgba(10, 20, 25, 0.45)');
    ctx.fillStyle = suppressGrad;
    ctx.fillRect(width * 0.5, 0, width * 0.5, height);
    ctx.restore();

    // 3. Đường phân cách mềm mại giữa 2 góc nhìn
    const dividerPulse = 0.5 + Math.sin(elapsed * 0.003) * 0.2;
    ctx.save();
    const lineGrad = ctx.createLinearGradient(width * 0.5 - 4, 0, width * 0.5 + 4, 0);
    lineGrad.addColorStop(0, 'rgba(0, 240, 212, 0)');
    lineGrad.addColorStop(0.5, `rgba(0, 240, 212, ${dividerPulse})`);
    lineGrad.addColorStop(1, 'rgba(0, 240, 212, 0)');
    ctx.fillStyle = lineGrad;
    ctx.fillRect(width * 0.5 - 3, 0, 6, height);
    ctx.restore();
  }

  // 6. AMBLYOPIA (NHƯỢC THỊ): Suy giảm thị lực thần kinh sâu sắc
  // Mờ toàn diện, mất tương phản, mất chi tiết trung tâm do não ức chế lâu ngày
  renderAmblyopia(ctx, width, height) {
    const rect = this.getDrawRect(width, height);
    ctx.filter = 'blur(13px) contrast(0.52) saturate(0.35) brightness(0.82)';
    ctx.drawImage(this.video, rect.x, rect.y, rect.width, rect.height);
    ctx.filter = 'none';

    // Ức chế hoàng điểm trung tâm (Foveal cortical suppression)
    const centerGrad = ctx.createRadialGradient(
      width / 2, height / 2, width * 0.04,
      width / 2, height / 2, width * 0.48
    );
    centerGrad.addColorStop(0, 'rgba(160, 180, 190, 0.25)');
    centerGrad.addColorStop(0.7, 'rgba(20, 30, 35, 0.15)');
    centerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = centerGrad;
    ctx.fillRect(0, 0, width, height);
  }

  // 7. SEVERE AMBLYOPIA: Che một bên mắt -> Màn hình mờ đen
  renderSevereAmblyopia(ctx, width, height) {
    const isCovered = Boolean(this.effectOptions.isEyeCovered);

    // Khi MỞ 2 MẮT: Sáng rõ bình thường
    if (!isCovered) {
      this.renderNormal(ctx, width, height);
      return;
    }

    const rect = this.getDrawRect(width, height);

    // Khi BỊ CHE 1 MẮT: MÀN HÌNH MỜ ĐEN (Blur cực mạnh + Tối đen)
    ctx.filter = 'blur(45px) contrast(0.15) brightness(0.12) saturate(0.1)';
    ctx.drawImage(this.video, rect.x, rect.y, rect.width, rect.height);
    ctx.filter = 'none';

    // Blackout vignette overlay
    const darkGrad = ctx.createRadialGradient(
      width / 2, height / 2, width * 0.08,
      width / 2, height / 2, width * 0.72
    );
    darkGrad.addColorStop(0, 'rgba(12, 16, 20, 0.88)');
    darkGrad.addColorStop(0.6, 'rgba(6, 8, 10, 0.95)');
    darkGrad.addColorStop(1, 'rgba(0, 0, 0, 0.99)');
    ctx.fillStyle = darkGrad;
    ctx.fillRect(0, 0, width, height);
  }
}

import React, { useState, useCallback, useEffect, useRef, useImperativeHandle } from 'react';
import EyeOverlay from './EyeOverlay';
import CameraQualityStatus from './CameraQualityStatus';
import { attachStreamToVideo } from '../services/cameraService';
import {
  getOccluderScreenClass,
  getTrackedEyeScreenClass,
  toCanonicalEye,
} from '../utils/eyeCoordinateMapping';

/**
 * CameraView Component - Houses webcam video feed, overlay canvas, and tracking quality indicators.
 * Architecture:
 *   <div className="camera-frame">
 *     <video ... />        (z-index: 1, scaleX(-1) if mirrored)
 *     <EyeOverlay ... />    (z-index: 2, scaleX(-1) if mirrored, transparent)
 *     {occluder}           (z-index: 3, visual cover instruction)
 *     {overlays}           (z-index: 4, placeholder, loading, error)
 *   </div>
 */
export default function CameraView({
  videoRef,
  stream = null,
  landmarks = null,
  features = null,
  featuresRef = null,
  quality = null,
  isActive = false,
  isLoading = false,
  error = null,
  videoWidth: propWidth = 640,
  videoHeight: propHeight = 480,
  onVideoReady,
  occluderEye = null, // 'left' | 'right' | 'LEFT' | 'RIGHT' | null (eye being covered)
  trackedEye = null,  // 'left' | 'right' | 'LEFT' | 'RIGHT' | null (eye being tracked)
  cleanMode = false,  // Child-friendly test mode: suppresses technical tracking badges
  compact = false,
  isMirrored = true,  // Default true for webcam mirror view
  showDebug = false,
  speak = null,
  voiceEnabled = false,
}) {
  const nodeRef = useRef(null);
  const [actualDimensions, setActualDimensions] = useState(() => {
    const isPortrait = typeof window !== 'undefined' && window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
    if (isPortrait && propWidth === 640 && propHeight === 480) {
      return { width: 480, height: 640 };
    }
    return { width: propWidth, height: propHeight };
  });
  const [cameraStatus, setCameraStatus] = useState(isLoading ? 'REQUESTING' : error ? 'ERROR' : isActive ? 'TRACKING' : 'IDLE');

  const syncDimensions = useCallback((node) => {
    const v = node || nodeRef.current;
    if (v && v.videoWidth > 0 && v.videoHeight > 0) {
      setActualDimensions((prev) => {
        if (prev.width === v.videoWidth && prev.height === v.videoHeight) return prev;
        return { width: v.videoWidth, height: v.videoHeight };
      });
    }
  }, []);

  // Poll video dimensions periodically to catch iOS Safari WebRTC resolution changes
  // which occur without firing 'resize' or 'loadedmetadata'.
  useEffect(() => {
    const timer = setInterval(() => {
      syncDimensions(nodeRef.current);
    }, 250);
    return () => clearInterval(timer);
  }, [syncDimensions]);

  // Callback ref: stores internal node
  const setVideoNode = useCallback(
    (node) => {
      nodeRef.current = node;

      if (node) {
        node.muted = true;
        node.defaultMuted = true;
        node.playsInline = true;
        node.setAttribute('playsinline', 'true');
        node.setAttribute('webkit-playsinline', 'true');
        node.setAttribute('muted', '');
      }

      if (typeof videoRef === 'function') {
        videoRef(node);
      } else if (videoRef && typeof videoRef === 'object') {
        videoRef.current = node;
      }

      if (node && stream) {
        attachStreamToVideo(node, stream);
      }

      syncDimensions(node);

      if (node && onVideoReady) {
        Promise.resolve().then(() => onVideoReady(node));
      }
    },
    [videoRef, stream, onVideoReady, syncDimensions]
  );

  // Expose the owned video node through React's ref lifecycle.
  useImperativeHandle(videoRef && typeof videoRef === 'object' ? videoRef : null, () => nodeRef.current, []);

  // Re-attach stream whenever stream changes or becomes available
  useEffect(() => {
    const video = nodeRef.current;
    if (video && stream) {
      attachStreamToVideo(video, stream);
    }
  }, [stream]);

  // Update status and log debug telemetry
  useEffect(() => {
    const video = nodeRef.current;
    let status = 'IDLE';
    if (error) status = 'ERROR';
    else if (isLoading) status = 'REQUESTING';
    else if (isActive && landmarks) status = 'TRACKING';
    else if (video && video.readyState >= 2 && !video.paused) status = 'VIDEO_READY';
    else if (stream) status = 'STREAM_READY';

    setCameraStatus(status);

    if (video) {
      syncDimensions(video);
      console.debug('[Camera]', {
        cameraStatus: status,
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        paused: video.paused,
        srcObject: Boolean(video.srcObject),
      });
    }
  }, [error, isLoading, stream, isActive, landmarks, syncDimensions]);

  const handleMetadata = (e) => {
    const v = e.target;
    syncDimensions(v);
    if (v.paused && v.srcObject) {
      v.play().catch(() => {});
    }
    setCameraStatus(isActive && landmarks ? 'TRACKING' : 'VIDEO_READY');
    if (v.videoWidth > 0 && v.videoHeight > 0) {
      console.debug('[Camera] Metadata loaded:', {
        width: v.videoWidth,
        height: v.videoHeight,
      });
    }
  };

  return (
    <div className={`camera-view-container ${compact ? 'compact' : ''}`}>
      <div
        className="camera-frame"
        style={{
          '--camera-aspect-ratio':
            actualDimensions.width && actualDimensions.height
              ? `${actualDimensions.width} / ${actualDimensions.height}`
              : undefined,
        }}
      >
        {/* Layer 1: Base Video Stream */}
        <video
          ref={setVideoNode}
          autoPlay
          playsInline
          webkit-playsinline="true"
          muted
          onLoadedMetadata={handleMetadata}
          onCanPlay={handleMetadata}
          onResize={handleMetadata}
          onTimeUpdate={(e) => syncDimensions(e.target)}
          onLoadedData={(e) => {
            handleMetadata(e);
            if (e.target.paused) e.target.play().catch(() => {});
          }}
          onPlay={() => {
            setCameraStatus(isActive && landmarks ? 'TRACKING' : 'VIDEO_READY');
          }}
          className={`camera-video-feed camera-preview ${isMirrored ? '' : 'unmirrored'}`}
          style={isMirrored ? undefined : { transform: 'none' }}
          aria-label="Khung hình webcam"
        />

        {/* Layer 2: Eye Landmarks Canvas Overlay */}
        {isActive && !isLoading && (cameraStatus === 'TRACKING' || cameraStatus === 'VIDEO_READY') && (
          <EyeOverlay
            landmarks={landmarks}
            features={features}
            featuresRef={featuresRef}
            quality={quality}
            videoWidth={actualDimensions.width}
            videoHeight={actualDimensions.height}
            isTrackingValid={quality ? quality.isValid : Boolean(landmarks)}
            isMirrored={isMirrored}
            showDebug={showDebug}
          />
        )}

        {/* Layer 3: Visual Occluder Overlay for Cover Test */}
        {occluderEye && (
          <div
            className={`camera-occluder-zone ${getOccluderScreenClass(occluderEye, isMirrored)}`}
            aria-live="polite"
          >
            <div className="occluder-patch">
              <span className="occluder-icon" aria-hidden="true">✋</span>
              <span className="occluder-text">
                {toCanonicalEye(occluderEye) === 'LEFT' ? 'CHE MẮT TRÁI' : 'CHE MẮT PHẢI'}
              </span>
              <small className="occluder-subtext">
                (Dùng tay che kín mắt {toCanonicalEye(occluderEye) === 'LEFT' ? 'trái' : 'phải'} của bạn)
              </small>
            </div>
          </div>
        )}

        {/* Layer 3b: Tracked Eye Focus Reticle */}
        {trackedEye && !occluderEye && (
          <div
            className={`camera-tracked-indicator ${getTrackedEyeScreenClass(trackedEye, isMirrored)}`}
          >
            <div className="tracked-reticle">
              <span className="reticle-ring" />
              <span className="reticle-label">
                👁 THEO DÕI {toCanonicalEye(trackedEye) === 'LEFT' ? 'MẮT TRÁI' : 'MẮT PHẢI'}
              </span>
            </div>
          </div>
        )}

        {/* Layer 4: Fallback / Placeholder / Loading / Error Overlays */}
        {!isActive && !isLoading && !error && (
          <div className="camera-placeholder">
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="placeholder-icon"
              aria-hidden="true"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <p>Camera chưa được kích hoạt</p>
            {onVideoReady && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onVideoReady(nodeRef.current)}
                style={{ marginTop: '12px', zIndex: 10 }}
              >
                📷 Bật camera
              </button>
            )}
          </div>
        )}

        {isLoading && (
          <div className="camera-loading-overlay">
            <div className="spinner" aria-hidden="true"></div>
            <p>Đang kết nối camera &amp; MediaPipe Face Mesh...</p>
          </div>
        )}

        {error && (
          <div className="camera-error-overlay">
            <p className="error-title">Lỗi kết nối camera</p>
            <p className="error-desc">{error}</p>
            {onVideoReady && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onVideoReady(nodeRef.current)}
                style={{ marginTop: '10px', zIndex: 10 }}
              >
                🔄 Thử lại
              </button>
            )}
          </div>
        )}

        {/* UI QUALITY STATUS */}
        {isActive && !isLoading && (cameraStatus === 'TRACKING' || cameraStatus === 'VIDEO_READY') && (
          <CameraQualityStatus
            quality={quality}
            speak={speak}
            voiceEnabled={voiceEnabled}
            active={isActive}
          />
        )}

        {!cleanMode && import.meta.env.DEV && (
          <div className="camera-debug-status-pill" title="Trạng thái camera runtime">
            {cameraStatus}
          </div>
        )}
      </div>
    </div>
  );
}

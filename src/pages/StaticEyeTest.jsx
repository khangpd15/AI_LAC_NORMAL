import React, { useState, useEffect, useRef, useCallback } from 'react';
import CameraView from '../components/CameraView';
import MedicalDisclaimer from '../components/MedicalDisclaimer';
import { useCamera } from '../hooks/useCamera';
import { useFaceMesh } from '../hooks/useFaceMesh';
import { useEyeTracking } from '../hooks/useEyeTracking';
import { SCREENING_CONFIG } from '../constants/screeningConfig';

/**
 * StaticEyeTest Page - Preserves the original static eye alignment measurement
 * Robust frame reception, direct ratio tracking, and clear status progression.
 */
export default function StaticEyeTest() {
  const videoRef = useRef(null);
  const historyRef = useRef([]);
  const [currentRatios, setCurrentRatios] = useState(null);
  const [avgDiff, setAvgDiff] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Chưa bắt đầu. Bấm "Bật camera & bắt đầu".');
  const [isAlert, setIsAlert] = useState(false);

  const { stream, isActive, isLoading: isCameraLoading, error: cameraError, start: startCam, stop: stopCam } = useCamera();
  const { quality, features, rawLandmarks, latestQualityRef, processResults, reset: resetTracking } = useEyeTracking();

  // Robust onResults callback directly connected to useFaceMesh
  const onResults = useCallback(
    (results) => {
      const res = processResults(results);

      if (!res || !res.features) {
        const currentReason = latestQualityRef.current?.reason || 'Không phát hiện khuôn mặt';
        setStatusMessage(currentReason);
        setIsAlert(false);
        return;
      }

      const { leftHorizontalRatio, rightHorizontalRatio } = res.features;

      // Update instantaneous ratios for immediate UI responsiveness
      setCurrentRatios({
        left: leftHorizontalRatio,
        right: rightHorizontalRatio,
      });

      const diff = Math.abs(leftHorizontalRatio - rightHorizontalRatio);

      const next = [...historyRef.current, diff];
      if (next.length > SCREENING_CONFIG.STATIC_HISTORY_MAX) {
        next.shift();
      }
      historyRef.current = next;

      const avg = next.reduce((acc, v) => acc + v, 0) / next.length;
      setAvgDiff(avg);

      if (next.length >= SCREENING_CONFIG.STATIC_STABLE_MIN) {
        if (avg > SCREENING_CONFIG.STATIC_DIFF_ALERT_THRESHOLD) {
          setStatusMessage(
            'Chênh lệch vị trí hai mắt cao hơn mức thường thấy. Đây KHÔNG phải chẩn đoán — nếu lặp lại nhiều lần, hãy khám bác sĩ nhãn khoa.'
          );
          setIsAlert(true);
        } else {
          setStatusMessage(
            'Chênh lệch trong khoảng thường thấy khi đo bằng webcam thường. Vẫn khuyến nghị khám định kỳ nếu có triệu chứng.'
          );
          setIsAlert(false);
        }
      } else {
        setStatusMessage(
          `Đang thu thập dữ liệu ổn định (${next.length}/${SCREENING_CONFIG.STATIC_STABLE_MIN})...`
        );
        setIsAlert(false);
      }
    },
    [processResults, latestQualityRef]
  );

  const { startLoop, stopLoop } = useFaceMesh(onResults);

  const handleStart = async () => {
    try {
      historyRef.current = [];
      setCurrentRatios(null);
      setAvgDiff(null);
      setIsAlert(false);
      setStatusMessage('Đang kết nối camera & tải MediaPipe Face Mesh...');

      const videoEl = videoRef.current;
      if (!videoEl) {
        throw new Error('Không tìm thấy khung hình video webcam.');
      }

      await startCam(videoEl);
      if (videoEl.paused) {
        await videoEl.play().catch(() => {});
      }
      await startLoop(videoEl);
      setStatusMessage('Camera hoạt động. Đang nhận diện mống mắt — hãy nhìn thẳng vào màn hình.');
    } catch (err) {
      console.error('Lỗi khởi động đo tĩnh:', err);
      setStatusMessage(err.message || 'Không thể khởi động camera.');
      setIsAlert(true);
    }
  };

  const handleStop = () => {
    stopLoop();
    stopCam();
    resetTracking();
    historyRef.current = [];
    setCurrentRatios(null);
    setAvgDiff(null);
    setStatusMessage('Đã dừng kiểm tra. Bấm "Bật camera & bắt đầu" để đo lại.');
    setIsAlert(false);
  };

  // Ensure camera stops if user navigates away
  useEffect(() => {
    return () => {
      stopLoop();
      stopCam();
    };
  }, [stopCam, stopLoop]);

  // Normalized thumb slider positions (0.0 to 1.0)
  const leftRatio = currentRatios
    ? Math.min(1, Math.max(0, currentRatios.left))
    : features
    ? Math.min(1, Math.max(0, features.leftHorizontalRatio))
    : 0.5;

  const rightRatio = currentRatios
    ? Math.min(1, Math.max(0, currentRatios.right))
    : features
    ? Math.min(1, Math.max(0, features.rightHorizontalRatio))
    : 0.5;

  return (
    <div className="page-container static-eye-page">
      <div className="page-header">
        <h1 className="page-title">Đo tĩnh vị trí mống mắt</h1>
        <p className="page-subtitle">
          Ước tính tương quan vị trí mống mắt hai bên khi nhìn thẳng vào camera ở trạng thái tĩnh.
        </p>
      </div>

      <MedicalDisclaimer />

      <div className="card stage-card-main">
        <div className="measurement-grid">
          <div className="cam-column">
            <CameraView
              videoRef={videoRef}
              stream={stream}
              landmarks={rawLandmarks}
              quality={quality}
              isActive={isActive}
              isLoading={isCameraLoading}
              error={cameraError}
            />
          </div>

          <div className="readouts-column">
            <div className="readout-card">
              <div className="readout-header">
                <span className="readout-label">Mắt bên trái màn hình (Mắt phải)</span>
                <span className="readout-value">
                  {currentRatios
                    ? currentRatios.right.toFixed(2)
                    : features
                    ? features.rightHorizontalRatio.toFixed(2)
                    : '--'}
                </span>
              </div>
              <div className="ratio-bar-track">
                <div
                  className="ratio-bar-thumb"
                  style={{ left: `${rightRatio * 100}%` }}
                  title="Vị trí mống mắt"
                />
              </div>
            </div>

            <div className="readout-card">
              <div className="readout-header">
                <span className="readout-label">Mắt bên phải màn hình (Mắt trái)</span>
                <span className="readout-value">
                  {currentRatios
                    ? currentRatios.left.toFixed(2)
                    : features
                    ? features.leftHorizontalRatio.toFixed(2)
                    : '--'}
                </span>
              </div>
              <div className="ratio-bar-track">
                <div
                  className="ratio-bar-thumb"
                  style={{ left: `${leftRatio * 100}%` }}
                  title="Vị trí mống mắt"
                />
              </div>
            </div>

            <div className="diff-highlight-card">
              <span className="diff-label">Chênh lệch trung bình (2s gần nhất):</span>
              <span className="diff-value">
                {avgDiff !== null ? avgDiff.toFixed(3) : '--'}
              </span>
            </div>

            <div className={`status-box ${isAlert ? 'alert' : ''}`} role="status">
              {statusMessage}
            </div>

            <div className="actions-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStart}
                disabled={isActive || isCameraLoading}
              >
                {isActive ? 'Đang hoạt động' : 'Bật camera & bắt đầu'}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleStop}
                disabled={!isActive}
              >
                Dừng
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card educational-section">
        <h2 className="edu-title">Thông tin tham khảo y khoa</h2>
        <p className="edu-subtitle">Kiến thức giáo dục chung về thị giác hai mắt và mỏi cơ vận nhãn.</p>
        <div className="edu-grid">
          <div className="edu-card">
            <h3>Giai đoạn đầu</h3>
            <p>Mỏi mắt, đau nhức nhẹ quanh hốc mắt, thỉnh thoảng nhìn mờ thoáng qua khi làm việc gần liên tục.</p>
          </div>
          <div className="edu-card">
            <h3>Giai đoạn giữa</h3>
            <p>Nếu có tật khúc xạ chưa chỉnh kính hoặc mất cân bằng cơ vận nhãn, tình trạng lệch mắt có thể biểu hiện rõ hơn.</p>
          </div>
          <div className="edu-card">
            <h3>Giai đoạn can thiệp</h3>
            <p>Lệch mắt kéo dài không được can thiệp ở trẻ em có thể dẫn tới nhược thị (mắt lười). Khám mắt định kỳ là phương pháp tốt nhất.</p>
          </div>
        </div>
        <p className="tech-footnote">
          Công nghệ: MediaPipe Face Mesh (refineLandmarks: true) xử lý 100% cục bộ trên trình duyệt — không truyền hình ảnh lên máy chủ.
        </p>
      </div>
    </div>
  );
}

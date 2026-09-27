import React from 'react';
import { CLINICAL_CALIBRATION_STATUS } from '../../constants/clinicalCalibrationConfig.js';

export default function ClinicalCalibrationResult({ result, movement }) {
  const validated = result?.status === CLINICAL_CALIBRATION_STATUS.CLINICALLY_VALIDATED;
  return (
    <div className="clinical-calibration-result">
      <h4>Đánh giá chuyển động mắt</h4>
      <div className="calibration-result-row"><span>Hướng chuyển động</span><strong>{movement?.horizontalDirection || '--'}</strong></div>
      <div className="calibration-result-row"><span>Độ dịch chuyển chuẩn hóa</span><strong>{Number.isFinite(movement?.normalizedDisplacement) ? movement.normalizedDisplacement.toFixed(4) : '--'}</strong></div>
      <h4>Độ lệch quy đổi lâm sàng</h4>
      {validated ? (
        <>
          <div className="calibration-result-row"><span>Độ lệch ngang ước tính</span><strong>{result.horizontalDeviationPD.toFixed(1)} Δ {result.horizontalDirection || ''}</strong></div>
          <div className="calibration-result-row"><span>Độ lệch dọc ước tính</span><strong>{result.verticalDeviationPD.toFixed(1)} Δ {result.verticalDirection || ''}</strong></div>
          <div className="calibration-result-row"><span>Model</span><strong>Clinical Calibration v{result.modelVersion}</strong></div>
          <div className="calibration-result-row"><span>Reference</span><strong>{result.referenceMethod}</strong></div>
          <p>Giá trị trên là ước tính từ dữ liệu sàng lọc, không thay thế phép đo lâm sàng.</p>
        </>
      ) : (
        <>
          <div className="calibration-result-row"><span>Trạng thái</span><strong>{result?.status === CLINICAL_CALIBRATION_STATUS.INSUFFICIENT_DATA ? 'Dữ liệu chưa đủ ổn định' : 'Chưa hiệu chuẩn'}</strong></div>
          <div className="calibration-result-row"><span>Độ lăng kính (Δ)</span><strong>Chưa có dữ liệu hiệu chuẩn lâm sàng</strong></div>
          <p>ⓘ Hệ thống hiện chỉ ghi nhận chuyển động mắt trong bài kiểm tra. Chưa quy đổi sang đơn vị lăng kính lâm sàng.</p>
        </>
      )}
    </div>
  );
}

import React from 'react';
import { MEDICAL_DISCLAIMER_TEXT } from '../constants/screeningConfig';

/**
 * Medical Disclaimer Banner
 * Clinical disclaimer warning users that this screening tool is educational and non-diagnostic.
 */
export default function MedicalDisclaimer({ compact = false }) {
  return (
    <div className={`disclaimer-card ${compact ? 'compact' : ''}`} role="note" aria-label="Cảnh báo y khoa">
      <div className="disclaimer-badge">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span>Lưu ý y khoa quan trọng</span>
      </div>
      <p className="disclaimer-text">
        <strong>{MEDICAL_DISCLAIMER_TEXT}</strong> Ánh sáng môi trường, góc nghiêng đầu và khoảng cách tới camera đều có thể gây sai lệch kết quả. Nếu bạn hoặc người thân nghi ngờ có dấu hiệu lác mắt hoặc suy giảm thị lực, hãy đến cơ sở chuyên khoa Mắt để được bác sĩ nhãn khoa thăm khám trực tiếp.
      </p>
    </div>
  );
}

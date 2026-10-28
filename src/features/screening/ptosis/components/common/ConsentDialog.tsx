/**
 * Hộp thoại đồng ý quyền riêng tư và xử lý dữ liệu sinh trắc học tạm thời (SP-004).
 * Thiết kế giao diện hỗ trợ cả hai chế độ Sáng / Tối theo RemiCare Brand Guidelines.
 * Tái sử dụng component dùng chung PrivacyConsentCard.
 */

import React from 'react';
import PrivacyConsentCard from '../../../../../components/common/PrivacyConsentCard';

interface ConsentDialogProps {
  onAccept: () => void;
}

export const ConsentDialog: React.FC<ConsentDialogProps> = ({ onAccept }) => {
  return (
    <PrivacyConsentCard
      title="Cam kết Quyền Riêng tư & Bảo mật"
      subtitle="Xử lý hoàn toàn trong bộ nhớ khả biến (In-Memory Zero-Retention)"
      noStorageTitle="Không lưu trữ vĩnh viễn:"
      noStorageDesc="Ảnh của bạn được xử lý trực tiếp trong bộ nhớ RAM máy chủ và bị giải phóng tức thì ngay khi hoàn tất phép đo. Hệ thống không ghi ảnh xuống ổ đĩa, không lưu trữ cơ sở dữ liệu."
      purposeTitle="Mục đích sử dụng:"
      purposeDesc="Ảnh chỉ được dùng để tính toán các chỉ số hình thái mi mắt bán định lượng phục vụ sàng lọc hỗ trợ ban đầu."
      safetyTitle="Thông cáo an toàn:"
      safetyDesc="Kết quả chỉ mang tính tham khảo sàng lọc hình thái học, không thay thế cho việc thăm khám trực tiếp tại cơ sở chuyên khoa mắt."
      checkboxLabel="Tôi đã đọc, hiểu rõ chính sách bảo vệ dữ liệu và đồng ý cung cấp hình ảnh phục vụ sàng lọc hình thái học mi mắt."
      buttonText="Bắt đầu sàng lọc"
      buttonId="btn-confirm-consent"
      checkboxId="consent-checkbox"
      onAccept={onAccept}
    />
  );
};

const ELIGIBILITY_ERROR_MESSAGES = {
  'Research consent is required.':
    'Cần xác nhận đồng ý tham gia phép đo nghiên cứu trước khi phân tích.',
  'Red flag present; measurement must not run.':
    'Có dấu hiệu cần khám chuyên khoa trước, hệ thống không thực hiện phân tích tự động.',
};

const IMAGE_PAYLOAD_ERROR_MESSAGES = {
  'Image payload exceeds research limit.':
    'Ảnh tải lên quá lớn. Hệ thống đã giới hạn kích thước ảnh nghiên cứu để xử lý ổn định.',
  'Image pixel count exceeds research limit.':
    'Ảnh tải lên có độ phân giải quá lớn. Vui lòng thử lại sau khi hệ thống nén ảnh hoặc chọn ảnh nhỏ hơn.',
  'imageDataUrl must be an image/* data URL.':
    'Tệp tải lên không đúng định dạng ảnh được hỗ trợ.',
  'HIRSCHBERG request requires imageDataUrl or imageBase64.':
    'Không tìm thấy ảnh Hirschberg để gửi phân tích.',
};

export function getResearchErrorDetail(error) {
  const detail = error?.data?.detail;
  if (detail && typeof detail === 'object') {
    return {
      code: detail.code || error?.code || null,
      message: detail.message || error?.message || null,
    };
  }

  return {
    code: error?.code || null,
    message: typeof detail === 'string' ? detail : error?.message || null,
  };
}

export function classifyResearchMeasurementError(error) {
  const { code, message } = getResearchErrorDetail(error);
  const status = Number(error?.status || 0);
  const isClientValidation =
    status === 400 ||
    status === 403 ||
    status === 422 ||
    code === 'INVALID_REQUEST' ||
    code === 'FEATURE_CONTRACT_MISMATCH';

  if (code === 'INVALID_REQUEST' && IMAGE_PAYLOAD_ERROR_MESSAGES[message]) {
    return {
      result: 'INVALID_FRAME',
      reasonCode: 'IMAGE_PAYLOAD_INVALID',
      message: IMAGE_PAYLOAD_ERROR_MESSAGES[message],
    };
  }

  if (isClientValidation) {
    return {
      result: 'INELIGIBLE',
      reasonCode: code || 'INVALID_REQUEST',
      message:
        ELIGIBILITY_ERROR_MESSAGES[message] ||
        message ||
        'Thông tin sàng lọc chưa đủ điều kiện để hệ thống phân tích.',
    };
  }

  return {
    result: 'SYSTEM_ERROR',
    reasonCode: code || 'RESEARCH_BACKEND_UNAVAILABLE',
    message: message || error?.userMessage || 'Không thể kết nối backend Hirschberg.',
  };
}

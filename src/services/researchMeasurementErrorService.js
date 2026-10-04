const ELIGIBILITY_ERROR_MESSAGES = {
  'Research consent is required.':
    'Cần xác nhận đồng ý tham gia phép đo nghiên cứu trước khi phân tích.',
  'Red flag present; measurement must not run.':
    'Có dấu hiệu cần khám chuyên khoa trước, hệ thống không thực hiện phân tích tự động.',
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

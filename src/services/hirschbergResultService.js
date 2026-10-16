export const HIRSCHBERG_CLASSES = {
  NORMAL: 'Chưa ghi nhận dấu hiệu lác rõ',
  ESOTROPIA: 'Tín hiệu lác trong',
  EXOTROPIA: 'Tín hiệu lác ngoài',
};
const validScore = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const reasonMessages = {
  fixation_not_confirmed: 'Chưa xác nhận hướng nhìn vào nguồn sáng gần camera khi chụp.',
  invalid_input_contract: 'Ảnh hoặc thông tin chụp chưa đủ điều kiện phân tích. Hãy kiểm tra hướng ảnh và chụp lại theo hướng dẫn.',
  invalid_reflex_landmark: 'Chấm phản quang hoặc mốc mắt chưa đạt chất lượng để đánh giá.',
  missing_binocular_geometry: 'Chưa xác định đủ đồng tử, phản quang hoặc mống mắt của cả hai mắt.',
  common_direction_ambiguous: 'Hướng phản quang hai mắt chưa đủ rõ để đánh giá. Hãy chụp lại khi nhìn nguồn sáng gần camera.',
};
export function normalizeHirschbergResult(input = {}) {
  const wrapped = input?.hirschbergResult || input || {};
  const data = wrapped.aiPrediction || wrapped;
  const status = String(data.status || wrapped.result || 'INCONCLUSIVE').toUpperCase();
  const isInconclusive = status === 'INCONCLUSIVE';
  const isError = ['UNAVAILABLE', 'SYSTEM_ERROR', 'ERROR'].includes(status);
  const isIneligible = ['INELIGIBLE', 'INVALID_FRAME'].includes(status);
  const evaluated = data.screening?.classifier_called !== false;
  const rawScores = data.uncalibratedModelScores ?? data.screening?.uncalibrated_model_scores ?? data.probabilities;
  const scores = evaluated && rawScores && typeof rawScores === 'object' && !Array.isArray(rawScores)
    ? Object.entries(rawScores).filter(([key, value]) => HIRSCHBERG_CLASSES[key.toUpperCase()] && validScore(value))
      .map(([key, value]) => ({ key: key.toUpperCase(), label: HIRSCHBERG_CLASSES[key.toUpperCase()], value })) : [];
  const confidence = evaluated && validScore(data.confidence) ? data.confidence : null;
  const proposed = String(data.predictedClass || data.screening?.class_proposal || '').toUpperCase();
  const proposal = !isInconclusive && !isError && !isIneligible && evaluated && HIRSCHBERG_CLASSES[proposed] ? proposed : null;
  const hasScores = !isError && !isIneligible && (scores.length > 0 || confidence !== null);
  const reason = data.reason || data.screening?.reason || wrapped.reasonCodes?.[0];
  const title = isError ? 'Chưa hoàn tất phân tích'
    : isIneligible ? 'Chưa đủ điều kiện sàng lọc'
    : isInconclusive || !proposal ? 'Chưa đủ điều kiện đánh giá'
    : 'Có kết quả sàng lọc — cần chuyên gia xem xét';
  return {
    raw: data, status, statusLabel: isError ? 'Chưa hoàn tất phân tích' : proposal ? 'Cần chuyên gia xem xét' : 'Chưa đủ điều kiện', proposal, scores: hasScores ? scores : [], confidence: hasScores ? confidence : null,
    hasScores, title, reason,
    message: data.message || wrapped.message || reasonMessages[reason] || (proposal
      ? 'Đây là gợi ý từ mô hình nghiên cứu, cần được chuyên gia đánh giá.'
      : 'Chưa đủ thông tin để đưa ra đánh giá sàng lọc. Bạn có thể chụp lại theo hướng dẫn.'),
    scoreLabel: data.model?.calibrated_probabilities === true && !data.uncalibratedModelScores
      ? 'Điểm phân lớp của mô hình' : 'Điểm mô hình (chưa hiệu chuẩn)',
    badge: isError ? 'badge-error' : proposal ? 'badge-attention' : 'badge-inconclusive',
  };
}

export function toHirschbergSessionResult(raw) {
  const view = normalizeHirschbergResult(raw);
  const measurement = { ...raw, aiPrediction: raw, result: view.status, reasonCodes: raw.reason ? [raw.reason] : [], experimental: true };
  return {
    hirschbergResult: measurement,
    strabismusResult: {
      status: view.status, prediction: view.proposal || 'INCONCLUSIVE',
      confidence: view.confidence, probabilities: raw.probabilities ?? null,
      uncalibratedModelScores: raw.uncalibratedModelScores ?? null,
      screening_status: 'HIRSCHBERG_CNN', message: view.message,
      model_version: raw.modelId ?? raw.modelVersion, inference_latency_ms: raw.latencyMs,
      hirschbergResult: measurement,
    },
  };
}

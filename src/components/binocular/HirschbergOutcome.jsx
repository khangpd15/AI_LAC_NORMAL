import React from 'react';
import { HIRSCHBERG_CLASSES, normalizeHirschbergResult } from '../../services/hirschbergResultService.js';
import './hirschbergOutcome.css';

export default function HirschbergOutcome({ result }) {
  const view = normalizeHirschbergResult(result);
  return <section className="hirschberg-outcome" aria-label="Kết quả sàng lọc Hirschberg" aria-live="polite">
    <span className={`badge ${view.badge}`}>{view.statusLabel}</span>
    <h3>{view.title}</h3>
    <p>{view.message}</p>
    {view.proposal && <p className="hirschberg-proposal"><strong>Gợi ý sàng lọc:</strong> {HIRSCHBERG_CLASSES[view.proposal]}</p>}
    {view.hasScores ? <div className="hirschberg-scores">
      <h4>{view.scoreLabel}</h4>
      {view.scores.map(score => <div className="hirschberg-score" key={score.key}>
        <div><span>{score.label}</span><strong>{(score.value * 100).toFixed(1)}%</strong></div>
        <meter min="0" max="1" value={score.value} aria-label={score.label} />
      </div>)}
      {view.scores.length === 0 && view.confidence !== null && <p>Điểm mô hình trả về: <strong>{(view.confidence * 100).toFixed(1)}%</strong></p>}
      <p className="hirschberg-score-note">Các phần trăm là điểm đầu ra của mô hình, không phải xác suất mắc bệnh.{view.status === 'INCONCLUSIVE' && ' Kết quả này vẫn chưa đủ điều kiện để kết luận.'}</p>
    </div> : <p className="hirschberg-no-score">Chưa có điểm phần trăm sàng lọc cho ảnh này.</p>}
    <p className="hirschberg-score-note">Kết quả sàng lọc cần được chuyên gia xem xét và không thay thế chẩn đoán của bác sĩ mắt.</p>
  </section>;
}

import React from 'react';

function MiniPlot({ rows, xKey, yKey, title }) {
  const points = rows.filter((row) => Number.isFinite(row[xKey]) && Number.isFinite(row[yKey]));
  if (!points.length) return <div className="research-empty-plot">{title}: Chưa có kết quả mô hình để phân tích.</div>;
  const values = points.flatMap((point) => [point[xKey], point[yKey]]);
  const min = Math.min(...values, 0); const max = Math.max(...values, 1); const scale = (value) => 18 + ((value - min) / (max - min || 1)) * 264;
  return <figure className="research-plot"><figcaption>{title}</figcaption><svg viewBox="0 0 300 220" role="img" aria-label={title}><line x1="18" y1="202" x2="282" y2="18" stroke="currentColor" opacity="0.25" />{points.map((point, index) => <circle key={index} cx={scale(point[xKey])} cy={220 - scale(point[yKey])} r="4" fill="var(--primary)" />)}</svg></figure>;
}

export default function CalibrationAnalysis({ rows = [] }) {
  const residualRows = rows.map((row) => ({ clinical: row.clinical, residual: Number.isFinite(row.estimated) ? row.estimated - row.clinical : null }));
  return <section className="research-analysis"><h3>Phân tích hiệu chuẩn dành cho nghiên cứu</h3><div className="research-plots"><MiniPlot rows={rows} xKey="clinical" yKey="estimated" title="PACT Δ so với ước tính mô hình" /><MiniPlot rows={residualRows} xKey="clinical" yKey="residual" title="Residual plot" /><div className="research-empty-plot">Bland–Altman và histogram lỗi sẽ được tạo sau khi có dự đoán trên tập kiểm tra độc lập.</div></div></section>;
}

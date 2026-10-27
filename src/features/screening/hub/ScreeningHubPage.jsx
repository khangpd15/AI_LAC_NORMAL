import React from 'react';
import { Link } from 'react-router-dom';
import { Eye, Scan, Sparkles, ArrowRight, Activity, HelpCircle } from 'lucide-react';
import './screeningHub.css';

export default function ScreeningHubPage() {
  return (
    <div className="screening-hub-container">
      {/* Hero Header */}
      <div className="screening-hub-header">
        <div className="hub-badge-pill">
          <Sparkles className="w-4 h-4 text-[#00AB9B]" />
          <span>TRUNG TÂM SÀNG LỌC THỊ LỰC REMICARE AI</span>
        </div>
        <h1 className="hub-title">
          Chọn phương pháp <em>sàng lọc mắt</em> phù hợp
        </h1>
        <p className="hub-subtitle">
          RemiCare AI ứng dụng công nghệ thị giác máy tính và trí tuệ nhân tạo hỗ trợ tầm soát sớm các bất thường thị giác phổ biến ở trẻ em và người lớn.
        </p>
      </div>

      {/* Methods Selection Grid */}
      <div className="screening-methods-grid">
        {/* Method Card 1: Strabismus (Lác / Lé) */}
        <div className="screening-method-card strabismus-card">
          <div className="card-top-row">
            <span className="card-badge badge-strabismus">
              <Activity className="w-3.5 h-3.5" />
              Hirschberg & Cover Test
            </span>
            <span className="card-voice-tag">🎙️ Giọng đọc Iris</span>
          </div>

          <div className="card-icon-box">
            <Scan className="w-8 h-8 text-[#00AB9B]" />
          </div>

          <h2 className="card-method-title">Sàng lọc Lác / Lé</h2>
          <p className="card-method-desc">
            Đánh giá độ lệch trục nhãn cầu (Esotropia / Exotropia) bằng ánh phản xạ giác mạc Hirschberg và phương pháp che mắt Digital Cover Test chuyên sâu.
          </p>

          <ul className="card-features-list">
            <li>
              <span className="feature-check">✓</span>
              <span>Đo góc lệch giác mạc Hirschberg tự động</span>
            </li>
            <li>
              <span className="feature-check">✓</span>
              <span>Quy trình Cover Test chuẩn lâm sàng</span>
            </li>
            <li>
              <span className="feature-check">✓</span>
              <span>Trợ lý Iris hướng dẫn từng thao tác bằng giọng nói</span>
            </li>
          </ul>

          <div className="card-action-box">
            <Link to="/sang-loc/lac-le" className="card-start-btn btn-mint">
              <span>Bắt đầu sàng lọc lác lé</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Method Card 2: Ptosis (Sụp Mí) */}
        <div className="screening-method-card ptosis-card">
          <div className="card-top-row">
            <span className="card-badge badge-ptosis">
              <Eye className="w-3.5 h-3.5" />
              Hình thái học Mi mắt
            </span>
            <span className="card-ram-tag">🔒 RAM Safe</span>
          </div>

          <div className="card-icon-box">
            <Eye className="w-8 h-8 text-[#00545D]" />
          </div>

          <h2 className="card-method-title">Sàng lọc Sụp Mí</h2>
          <p className="card-method-desc">
            Phân tích mức độ che phủ của mi mắt trên đồng tử (chỉ số MRD-1 và chiều cao khe mi) nhằm phát hiện dấu hiệu sụp mí và bất đối xứng hai mắt.
          </p>

          <ul className="card-features-list">
            <li>
              <span className="feature-check">✓</span>
              <span>Tính toán khoảng cách bờ mi MRD-1 (mm)</span>
            </li>
            <li>
              <span className="feature-check">✓</span>
              <span>Phân hạng nguy cơ Tier 1, Tier 2, Tier 3</span>
            </li>
            <li>
              <span className="feature-check">✓</span>
              <span>Bảo mật Zero-Retention RAM (không lưu ảnh trên server)</span>
            </li>
          </ul>

          <div className="card-action-box">
            <Link to="/sang-loc/sup-mi" className="card-start-btn btn-teal">
              <span>Bắt đầu sàng lọc sụp mí</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Safety Notice Footer */}
      <div className="screening-hub-notice">
        <HelpCircle className="w-5 h-5 flex-shrink-0 text-[#00AB9B]" />
        <p>
          <strong>Lưu ý quan trọng:</strong> Cả hai công cụ sàng lọc của RemiCare đều hoạt động dựa trên thuật toán AI và chỉ mang tính chất tham khảo, tầm soát ban đầu. Kết quả không thay thế cho kết luận và chỉ định thăm khám từ bác sĩ chuyên khoa mắt.
        </p>
      </div>
    </div>
  );
}

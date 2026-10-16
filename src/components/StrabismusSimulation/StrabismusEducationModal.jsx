import React from 'react';
import { STRABISMUS_DEFINITIONS } from './strabismusData';

export default function StrabismusEducationModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="sim-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sim-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="sim-modal-header">
          <div className="sim-modal-title-group">
            <span className="sim-badge-mint">Y KHOA NHÃN KHOA</span>
            <h2>Kiến Thức Toàn Diện Về Lác Lé & Thị Giác Hai Mắt</h2>
          </div>
          <button type="button" className="sim-btn-close" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>

        <div className="sim-modal-body">
          {/* Section 1: Khái niệm & Cơ vận nhãn */}
          <section className="sim-edu-section">
            <h3 className="sim-edu-heading">1. Lác lé là gì và do cơ chế nào gây ra?</h3>
            <p>
              <strong>Lác (Lé - Strabismus)</strong> là tình trạng hai mắt không cùng nhìn về một hướng
              khi quan sát một vật. Ở trạng thái bình thường, chuyển động của mỗi mắt được điều khiển
              chính xác bởi <strong>6 cơ vận nhãn</strong>:
            </p>
            <div className="sim-muscles-grid">
              <div className="muscle-item">
                <span className="muscle-name">Cơ trực trong (Medial Rectus)</span>
                <span className="muscle-func">Kéo mắt quay vào trong (sống mũi)</span>
              </div>
              <div className="muscle-item">
                <span className="muscle-name">Cơ trực ngoài (Lateral Rectus)</span>
                <span className="muscle-func">Kéo mắt quay ra ngoài (thái dương)</span>
              </div>
              <div className="muscle-item">
                <span className="muscle-name">Cơ trực trên (Superior Rectus)</span>
                <span className="muscle-func">Kéo mắt quay lên trên</span>
              </div>
              <div className="muscle-item">
                <span className="muscle-name">Cơ trực dưới (Inferior Rectus)</span>
                <span className="muscle-func">Kéo mắt quay xuống dưới</span>
              </div>
              <div className="muscle-item">
                <span className="muscle-name">Cơ chéo trên (Superior Oblique)</span>
                <span className="muscle-func">Xoay nhãn cầu vào trong và đưa xuống</span>
              </div>
              <div className="muscle-item">
                <span className="muscle-name">Cơ chéo dưới (Inferior Oblique)</span>
                <span className="muscle-func">Xoay nhãn cầu ra ngoài và đưa lên</span>
              </div>
            </div>
            <p className="sim-edu-sub">
              Khi có sự mất cân bằng lực kéo hoặc liệt một trong các dây thần kinh sọ não (III, IV, VI),
              nhãn cầu sẽ bị lệch trục, tạo nên các dạng lác tương ứng.
            </p>
          </section>

          {/* Section 2: Các dạng lác trong mô phỏng */}
          <section className="sim-edu-section">
            <h3 className="sim-edu-heading">2. Lác trong và lác ngoài</h3>
            <div className="sim-types-cards">
              {Object.values(STRABISMUS_DEFINITIONS)
                .filter((d) => d.id !== 'CUSTOM' && d.id !== 'ORTHOTROPIA')
                .map((def) => (
                  <div key={def.id} className="sim-type-card-mini">
                    <div className="card-mini-top">
                      <span className="mini-icon">{def.icon}</span>
                      <strong className="mini-name">{def.title}</strong>
                      <span className="mini-latin">{def.medicalName}</span>
                    </div>
                    <p className="mini-desc">{def.description}</p>
                    <div className="mini-meta">
                      <small>
                        <strong>Cơ liên quan:</strong> {def.musclesInvolved}
                      </small>
                    </div>
                  </div>
                ))}
            </div>
          </section>

          {/* Section 3: Nghiệm pháp Hirschberg */}
          <section className="sim-edu-section">
            <h3 className="sim-edu-heading">3. Nguyên lý kiểm tra quang học Hirschberg</h3>
            <div className="sim-hirschberg-callout">
              <div className="callout-icon">💡</div>
              <div className="callout-text">
                <p>
                  Bác sĩ rọi đèn pin (penlight) vào sống mũi từ cự ly khoảng 33 - 50 cm và quan sát ánh phản xạ
                  giác mạc (Corneal Light Reflex):
                </p>
                <ul>
                  <li>
                    <strong>Mắt bình thường:</strong> Đốm sáng nằm đối xứng ngay trung tâm con ngươi.
                  </li>
                  <li>
                    <strong>Lác trong (Esotropia):</strong> Đốm sáng bị lệch ra phía ngoài (thái dương).
                  </li>
                  <li>
                    <strong>Lác ngoài (Exotropia):</strong> Đốm sáng bị lệch vào phía trong (sống mũi).
                  </li>
                  <li>
                    <strong>Quy tắc Hirschberg:</strong> Mỗi 1 mm đốm sáng bị lệch tương đương khoảng{' '}
                    <strong>15 - 20 độ lăng kính (Prism Diopters - Δ)</strong>, tương đương 7 - 10 độ góc mắt.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 4: Nguy cơ nhược thị & Giai đoạn vàng */}
          <section className="sim-edu-section alert-box-gold">
            <h3 className="sim-edu-heading text-amber">
              ⚠️ Vì sao cần can thiệp sớm trong Giai đoạn vàng trước 7 tuổi?
            </h3>
            <p>
              Khi một mắt bị lác, hai mắt thu nhận hai hình ảnh khác nhau, gây ra hiện tượng{' '}
              <strong>nhìn đôi (song thị - diplopia)</strong>. Để bảo vệ đứa trẻ không bị chóng mặt, não bộ sẽ
              tự động <strong>ức chế (suppression)</strong> và bỏ qua tín hiệu từ mắt bị lác.
            </p>
            <p>
              Nếu tình trạng này kéo dài qua 7 tuổi (khi đường dẫn truyền thị giác lên vỏ não đã hoàn thiện và đóng lại),
              mắt bị ức chế sẽ biến thành <strong>Nhược thị sâu (Amblyopia - Mắt lười)</strong> không thể phục hồi
              hoàn toàn, đồng thời trẻ sẽ mất vĩnh viễn <strong>thị giác lập thể 3D (Stereopsis)</strong>.
            </p>
          </section>
        </div>

        <div className="sim-modal-footer">
          <p className="footer-disclaimer">
            * Nội dung giáo dục cộng đồng bởi RemiCare AI. Không thay thế quy trình chẩn đoán y khoa chuyên sâu.
          </p>
          <button type="button" className="btn-modal-done" onClick={onClose}>
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}

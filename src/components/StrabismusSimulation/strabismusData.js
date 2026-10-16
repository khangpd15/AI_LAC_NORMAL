/**
 * Strabismus clinical data & voice guidance scripts for Strabismus Simulation
 */

import { STRABISMUS_TYPES, AFFECTED_EYE } from '../../services/cv/strabismusEngine.js';

export const STRABISMUS_DEFINITIONS = {
  [STRABISMUS_TYPES.ESOTROPIA]: {
    id: STRABISMUS_TYPES.ESOTROPIA,
    title: 'Lác Trong',
    medicalName: 'Esotropia (Convergent Strabismus)',
    badgeColor: '#00D1B2',
    icon: '👈👉',
    summary: 'Một hoặc cả hai mắt lệch hướng vào phía trong (hướng sống mũi).',
    description:
      'Lác trong là dạng lác phổ biến nhất ở trẻ nhỏ, thường chiếm tới 50% các ca lác trẻ em. Có thể do điều tiết quá mức (lác trong do viễn thị) hoặc do mất cân bằng giữa cơ trực trong và cơ trực ngoài.',
    musclesInvolved: 'Cơ trực trong (Medial Rectus) co kéo mạnh hoặc cơ trực ngoài (Lateral Rectus) bị yếu.',
    hirschbergNote: 'Ánh phản xạ giác mạc bị dịch chuyển ra phía ngoài (thái dương) so với tâm con ngươi.',
    voiceScript:
      'Lác trong là khi con ngươi của mắt bị lệch vào phía trong, hướng về sống mũi. Dạng này rất thường gặp ở trẻ nhỏ và có thể gây nhược thị nếu không được chỉnh kính hoặc tập luyện sớm.',
    recommendation: 'Cần đo khúc xạ liệt điều tiết để phát hiện viễn thị kèm theo và can thiệp trước 7 tuổi.',
  },

  [STRABISMUS_TYPES.EXOTROPIA]: {
    id: STRABISMUS_TYPES.EXOTROPIA,
    title: 'Lác Ngoài',
    medicalName: 'Exotropia (Divergent Strabismus)',
    badgeColor: '#3B82F6',
    icon: '👉👈',
    summary: 'Một hoặc cả hai mắt lệch hướng ra phía ngoài (hướng thái dương / tai).',
    description:
      'Lác ngoài thường xuất hiện từng lúc (Intermittent Exotropia), đặc biệt khi trẻ mệt mỏi, thiếu ngủ, mơ màng hoặc khi ra ngoài trời có ánh nắng chói chang (trẻ thường hay nheo một mắt).',
    musclesInvolved: 'Cơ trực ngoài (Lateral Rectus) co kéo quá mức hoặc cơ trực trong (Medial Rectus) suy giảm trương lực.',
    hirschbergNote: 'Ánh phản xạ giác mạc bị dịch chuyển vào phía trong (sống mũi) so with tâm con ngươi.',
    voiceScript:
      'Lác ngoài là khi mắt bị lệch ra phía ngoài, hướng về phía tai. Ba mẹ thường thấy trẻ hay nheo một mắt khi ra trời nắng hoặc khi nhìn xa.',
    recommendation: 'Tập luyện thị giác hai mắt, tập hội tụ hoặc phẫu thuật chỉnh cơ vận nhãn khi độ lác lớn.',
  },

  [STRABISMUS_TYPES.CUSTOM]: {
    id: STRABISMUS_TYPES.CUSTOM,
    title: 'Tự Do 360°',
    medicalName: 'Custom 2D Vector Strabismus',
    badgeColor: '#A855F7',
    icon: '🕹️',
    summary: 'Mô phỏng bất kỳ góc xoay nào của nhãn cầu thông qua cần điều khiển 2D.',
    description:
      'Cho phép bạn tự do kéo thả con ngươi theo nhiều hướng để quan sát các dạng lệch phối hợp.',
    musclesInvolved: 'Sự phối hợp không đồng vận của nhiều cơ vận nhãn cùng lúc.',
    hirschbergNote: 'Ánh phản xạ di chuyển ngược chiều với vector con ngươi theo nguyên lý quang học.',
    voiceScript:
      'Bạn đang ở chế độ điều khiển tự do. Hãy thử xoay cần điều khiển để xem mắt lệch theo bất kỳ hướng nào bạn muốn nhé!',
    recommendation: 'Công cụ trực quan lý tưởng để giảng dạy và quan sát sự biến đổi quang học của mắt.',
  },

  [STRABISMUS_TYPES.ORTHOTROPIA]: {
    id: STRABISMUS_TYPES.ORTHOTROPIA,
    title: 'Mắt Bình Thường',
    medicalName: 'Orthotropia (Chính thị / Thẳng trục)',
    badgeColor: '#10B981',
    icon: '👁️',
    summary: 'Hai mắt đồng trục hoàn hảo, cùng hướng vào một tiêu điểm duy nhất.',
    description:
      'Thị giác hai mắt bình thường cho phép não bộ hợp nhất hai hình ảnh từ hai mắt thành một hình ảnh 3D nổi duy nhất với chiều sâu lập thể hoàn hảo (Stereopsis).',
    musclesInvolved: 'Cả 6 cặp cơ vận nhãn phối hợp nhịp nhàng và đồng bộ theo định luật Hering và Sherrington.',
    hirschbergNote: 'Ánh phản xạ nằm đối xứng và đồng tâm ở cả hai con ngươi.',
    voiceScript:
      'Đây là đôi mắt bình thường, hai mắt hoàn toàn cân xứng và đồng trục, giúp bạn nhìn thế giới sống động dưới dạng không gian ba chiều.',
    recommendation: 'Duy trì thói quen kiểm tra định kỳ mỗi 6 tháng để bảo vệ thị lực.',
  },
};

export const ANGLE_PRESETS = [
  { label: 'Nhẹ', angleDeg: 8, prism: 14, desc: 'Lác kín đáo, khó nhận biết bằng mắt thường' },
  { label: 'Vừa', angleDeg: 18, prism: 32, desc: 'Lác rõ rệt khi nhìn thẳng' },
  { label: 'Nặng', angleDeg: 28, prism: 53, desc: 'Lệch trục nặng, nguy cơ nhược thị sâu' },
];

export const EYE_OPTIONS = [
  { id: AFFECTED_EYE.RIGHT, label: 'Mắt Phải (OD)', icon: '👁️' },
  { id: AFFECTED_EYE.LEFT, label: 'Mắt Trái (OS)', icon: '👁️' },
  { id: AFFECTED_EYE.BOTH, label: 'Cả Hai Mắt', icon: '👀' },
  { id: AFFECTED_EYE.ALTERNATING, label: 'Luân Phiên', icon: '🔀' },
];

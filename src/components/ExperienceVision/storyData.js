/**
 * STORY DATA - EXPERIENCE VISION (TRẢI NGHIỆM GÓC NHÌN)
 * Fullscreen Cinematic Realtime Camera Experience
 * 
 * Thiết kế tinh gọn, thuần trải nghiệm cho cha mẹ & người bình dân:
 * - 100% TRẢI NGHIỆM THỊ GIÁC TRỰC DIỆN qua camera realtime.
 * - Hướng dẫn giọng nói AI chi tiết, dùng từ ngữ mộc mạc, chỉ dẫn nút màu sắc rõ ràng (Nút màu xanh / Nút màu cam).
 * - Đúng 3 câu hỏi kiểm tra nhanh (Giai đoạn 3, 6, 7) - AI tự động đọc cả câu hỏi lẫn đáp án thành tiếng.
 * - Giai đoạn 7: Dơ tay che mắt TRÁI hoặc PHẢI -> AI tự động nhận diện mờ đen!
 */

export const EXPERIENCE_STAGES = [
  {
    id: 1,
    stageNumber: 1,
    name: 'Bình thường',
    effect: 'normal',
    promptText: 'Hai mắt cùng phối hợp nhìn thẳng và rõ ràng.',
    voiceText: 'Chào ba mẹ. Hãy nhìn vào khuôn mặt của mình trên màn hình. Đây là hình ảnh rõ nét khi hai mắt phối hợp bình thường. Sau đây, chúng ta sẽ xem mắt thay đổi thế nào khi bị lác. Ba mẹ hãy bấm vào nút màu xanh ở góc dưới màn hình để tiếp tục.',
    question: null,
  },
  {
    id: 2,
    stageNumber: 2,
    name: 'Song thị',
    subtitle: 'Nhìn đôi',
    effect: 'doubleVision',
    promptText: 'Hình ảnh trước mắt bị tách làm hai (nhìn đôi).',
    voiceText: 'Khi một mắt bị lác lệch trục, não nhận hai hình ảnh không khớp nhau, khiến mọi vật bị nhìn đôi thành hai hình. Trẻ sẽ rất khó chịu, dễ nghiêng đầu hoặc nheo mắt để nhìn. Ba mẹ hãy bấm nút màu xanh ở góc dưới màn hình để tiếp tục.',
    question: null,
  },
  {
    id: 3,
    stageNumber: 3,
    name: 'Nhìn mờ',
    subtitle: 'Mất độ nét',
    effect: 'blur',
    promptText: 'Đường nét xung quanh mờ dần do não giảm nhận tín hiệu.',
    voiceText: 'Để bớt khó chịu do nhìn đôi, hình ảnh từ mắt lệch bắt đầu bị mờ đi. Ba mẹ hãy cùng trả lời một câu hỏi nhanh sau đây.',
    question: {
      id: 'q1',
      title: 'Câu hỏi kiểm tra nhanh',
      text: 'Trẻ nhỏ khi bị nhìn mờ hoặc lác lệch mắt, trẻ có tự biết để nói với ba mẹ không?',
      voiceText: 'Câu hỏi cho ba mẹ: Trẻ nhỏ khi bị nhìn mờ hoặc lác lệch mắt, trẻ có tự biết để nói với ba mẹ không? Ba mẹ hãy bấm nút màu xanh nếu chọn Không, hoặc bấm nút màu cam nếu chọn Có.',
      options: [
        {
          id: 'opt_no',
          text: 'KHÔNG — Trẻ tưởng ai cũng nhìn giống mình',
          color: 'green',
          isCorrect: true,
          feedbackVoice: 'Rất chính xác! Trẻ nhỏ từ bé đã nhìn như vậy nên tưởng mắt ai cũng thế, trẻ không thể tự nói. Ba mẹ hãy bấm nút màu xanh ở góc dưới để tiếp tục.',
        },
        {
          id: 'opt_yes',
          text: 'CÓ — Trẻ sẽ tự nói ngay với ba mẹ',
          color: 'orange',
          isCorrect: false,
          feedbackVoice: 'Chưa đúng rồi ba mẹ. Thực ra trẻ nhỏ tưởng ai cũng nhìn giống mình nên không thể tự nói được. Ba mẹ hãy bấm nút màu xanh ở góc dưới để tiếp tục.',
        },
      ],
    },
  },
  {
    id: 4,
    stageNumber: 4,
    name: 'Não thích nghi',
    subtitle: 'Tự tắt hình ảnh mắt lệch',
    effect: 'suppression',
    promptText: 'Não tự động tắt tín hiệu từ mắt lệch để khỏi hoa mắt.',
    voiceText: 'Để tránh bị hoa mắt do nhìn đôi, bộ não của trẻ tự động tắt bớt hình ảnh từ mắt bị lệch. Nhìn bề ngoài bé có vẻ bình thường, nhưng mắt lệch đang dần bị não bỏ rơi. Ba mẹ hãy bấm nút màu xanh ở góc dưới màn hình để tiếp tục.',
    question: null,
  },
  {
    id: 5,
    stageNumber: 5,
    name: 'Một mắt được ưu tiên ít hơn',
    subtitle: 'Não chỉ dùng mắt khỏe',
    effect: 'oneEyePriority',
    promptText: 'Một nửa thị trường (mắt khỏe) sáng rõ, một nửa (mắt yếu) bị mờ nhạt.',
    voiceText: 'Lúc này, não bộ chỉ tập trung vào mắt khỏe, còn mắt lé bị bỏ quên, hình ảnh mờ nhạt dần như bên phải màn hình. Ba mẹ hãy bấm nút màu xanh ở góc dưới màn hình để tiếp tục.',
    question: null,
  },
  {
    id: 6,
    stageNumber: 6,
    name: 'Nhược thị',
    subtitle: 'Suy giảm thị lực sâu',
    effect: 'amblyopia',
    promptText: 'Thị lực suy giảm nghiêm trọng do não đã quen ức chế mắt này.',
    voiceText: 'Khi mắt bị bỏ quên quá lâu, nhược thị hình thành. Toàn bộ hình ảnh trở nên mờ sương và mất độ nét nghiêm trọng. Ba mẹ hãy trả lời câu hỏi y khoa quan trọng sau.',
    question: {
      id: 'q2',
      title: 'Câu hỏi y khoa quan trọng',
      text: 'Nếu để nhược thị quá tuổi vàng (sau 7-8 tuổi), sau này lớn lên đeo kính có giúp mắt sáng 10/10 trở lại không?',
      voiceText: 'Câu hỏi cho ba mẹ: Nếu để nhược thị quá tuổi vàng sau bảy, tám tuổi, sau này lớn lên đeo kính có giúp mắt sáng rõ mười trên mười trở lại không? Ba mẹ hãy bấm nút màu xanh nếu chọn Không thể, hoặc bấm nút màu cam nếu chọn Có thể.',
      options: [
        {
          id: 'opt_no',
          text: 'KHÔNG THỂ — Não đã mất liên kết vĩnh viễn',
          color: 'green',
          isCorrect: true,
          feedbackVoice: 'Chính xác tuyệt đối! Nhược thị là tổn thương đường dẫn thần kinh ở não. Qua tuổi vàng thì đeo kính hay mổ cũng không sáng lại được. Ba mẹ hãy bấm nút màu xanh ở góc dưới để thử nghiệm che mắt.',
        },
        {
          id: 'opt_yes',
          text: 'CÓ THỂ — Chỉ cần đeo kính là sáng lại',
          color: 'orange',
          isCorrect: false,
          feedbackVoice: 'Rất tiếc là không thể ba mẹ nhé! Đeo kính chỉ chỉnh khúc xạ ngoài mắt, không sửa được thần kinh não đã bị teo. Ba mẹ hãy bấm nút màu xanh ở góc dưới để thử nghiệm che mắt.',
        },
      ],
    },
  },
  {
    id: 7,
    stageNumber: 7,
    name: 'Che mắt khỏe',
    subtitle: 'Mô phỏng góc nhìn mắt nhược thị',
    effect: 'severeAmblyopia',
    promptText: 'Hãy dùng tay che mắt khỏe (Trái hoặc Phải) để cảm nhận góc nhìn của mắt bị ảnh hưởng.',
    voiceText: 'Bây giờ, hãy tưởng tượng một bên mắt là mắt khỏe, còn bên kia là mắt bị nhược thị nặng. Hãy dùng tay che mắt khỏe của bạn lại — bạn có thể che mắt trái hoặc mắt phải. Khi mắt khỏe bị che, bạn sẽ cảm nhận hình ảnh phía trước trở nên rất tối, mờ và khó nhận biết chi tiết. Đây là hiệu ứng mô phỏng giáo dục để ba mẹ thấu hiểu cảm giác của con. Sau khi che mắt trải nghiệm xong, ba mẹ hãy bấm nút Tiếp theo màu xanh ở góc dưới.',
    question: null,
  },
  {
    id: 8,
    stageNumber: 8,
    name: 'Kết thúc',
    subtitle: 'Hiểu con hơn · Khám sớm hơn',
    effect: 'normal',
    promptText: 'Chủ động nhận biết dấu hiệu để bảo vệ đôi mắt sáng của con.',
    voiceText: 'Hành trình trải nghiệm đã hoàn tất. Lác lé và nhược thị hoàn toàn có thể chữa khỏi nếu phát hiện trước bảy tuổi. Ba mẹ hãy bấm vào nút màu xanh lớn ở giữa màn hình để vào bài kiểm tra sàng lọc mắt cho con ngay bây giờ.',
    question: null,
  },
];

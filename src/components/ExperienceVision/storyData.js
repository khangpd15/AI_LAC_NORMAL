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
      title: 'Kiểm tra nhận thức thị giác',
      text: 'Trẻ nhỏ khi bị nhìn mờ hoặc lác lệch mắt, trẻ có tự biết để nói với ba mẹ không?',
      voiceText: 'Câu hỏi cho ba mẹ: Trẻ nhỏ khi bị nhìn mờ hoặc lác lệch mắt, trẻ có tự biết để nói với ba mẹ không? Ba mẹ hãy chọn một trong hai phương án bên dưới để lắng nghe giải thích y khoa nghen.',
      options: [
        {
          id: 'opt_yes',
          text: 'CÓ — Trẻ sẽ tự nói với ba mẹ khi thấy mờ',
          color: 'orange',
          isCorrect: false,
          explanationTitle: 'Vì sao trẻ thường không thể tự nói với ba mẹ?',
          explanationDetail: 'Rất nhiều phụ huynh nghĩ rằng mắt mờ thì con sẽ khó chịu và nói ngay. Nhưng thực tế: trẻ sinh ra đã nhìn như vậy nên xem đó là điều hiển nhiên của thế giới, con chưa từng biết thế nào là "nhìn rõ 10/10" để so sánh! Trẻ sẽ không bao giờ tự nói, mà chỉ âm thầm thích nghi bằng cách nheo mắt, nghiêng đầu hoặc nhìn sát màn hình.',
          feedbackVoice: 'Dạ, rất nhiều ba mẹ cũng nghĩ là bé sẽ tự nói. Nhưng thực tế là từ khi sinh ra bé đã nhìn như vậy nên bé tưởng ai cũng thấy giống mình, bé không hề biết thế nào là nhìn rõ mười trên mười để nói với ba mẹ. Vì vậy trẻ sẽ không bao giờ tự nói, chỉ có ba mẹ quan sát thấy con hay nheo mắt, nghiêng đầu hoặc cho con đi khám thì mới phát hiện được thôi nghen.',
        },
        {
          id: 'opt_no',
          text: 'KHÔNG — Trẻ chưa thể tự nhận biết được',
          color: 'green',
          isCorrect: true,
          explanationTitle: 'Chính xác! Trẻ nhỏ không có hệ quy chiếu để so sánh thị lực',
          explanationDetail: 'Trẻ nhỏ hoàn toàn không thể tự nhận biết thị lực của mình bị suy giảm. Đối với con, thế giới mờ ảo hay nhìn đôi đã là điều "bình thường" từ thuở lọt lòng. Trẻ sẽ tự thích nghi bằng các thói quen như nghiêng một bên đầu, nheo một mắt hoặc hay vấp ngã. Sự quan sát tinh tế của ba mẹ chính là cơ hội duy nhất để cứu đôi mắt của con!',
          feedbackVoice: 'Dạ, ba mẹ trả lời rất chính xác nghen! Trẻ nhỏ từ bé đã nhìn như vậy nên xem đó là điều hiển nhiên, trẻ hoàn toàn không biết mắt mình đang bị mờ để nói với ba mẹ. Do đó, sự quan sát tinh tế của ba mẹ là cứu cánh duy nhất để phát hiện sớm cho con nha.',
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
    voiceText: 'Khi mắt bị bỏ quên quá lâu, nhược thị hình thành. Toàn bộ hình ảnh trở nên mờ sương và mất độ nét nghiêm trọng. Ba mẹ hãy cùng xem xét câu hỏi y khoa quan trọng sau.',
    question: {
      id: 'q2',
      title: 'Kiến thức y khoa quan trọng',
      text: 'Nếu để nhược thị quá tuổi vàng (sau 7-8 tuổi), sau này lớn lên đeo kính có giúp mắt sáng 10/10 trở lại không?',
      voiceText: 'Câu hỏi cho ba mẹ: Nếu để nhược thị quá tuổi vàng sau bảy, tám tuổi, sau này lớn lên đeo kính có giúp mắt sáng rõ mười trên mười trở lại không? Ba mẹ hãy chọn một phương án bên dưới để lắng nghe bác sĩ giải thích nghen.',
      options: [
        {
          id: 'opt_yes',
          text: 'CÓ THỂ — Chỉ cần đeo kính đúng số là sáng lại',
          color: 'orange',
          isCorrect: false,
          explanationTitle: 'Hiểu lầm phổ biến: "Cứ lớn lên rồi cắt kính hoặc mổ là xong"',
          explanationDetail: 'Đeo kính chỉ giúp bẻ cong ánh sáng vào tròng mắt (chữa khúc xạ ngoài mắt). Nhưng NHƯỢC THỊ LÀ BỆNH Ở NÃO BỘ — vùng vỏ não thị giác nhận tín hiệu từ mắt yếu đã bị teo thoái hóa do bị ức chế nhiều năm. Sau 7-8 tuổi (khi vùng não thị giác đóng lại vĩnh viễn), dù có đeo kính đắt tiền nhất hay phẫu thuật tinh vi cỡ nào, mắt cũng KHÔNG THỂ phục hồi về 10/10 được nữa!',
          feedbackVoice: 'Dạ, đây là hiểu lầm rất tai hại của nhiều người nghen. Đeo kính chỉ giúp chỉnh khúc xạ ngoài tròng mắt, chứ không sửa được tế bào não thị giác đã bị teo. Sau bảy, tám tuổi thì não bộ đã cố định vĩnh viễn rồi, nên dù đeo kính số mấy hay phẫu thuật cũng không sáng mười trên mười lại được đâu nha ba mẹ.',
        },
        {
          id: 'opt_no',
          text: 'KHÔNG THỂ — Vùng não thị giác đã mất liên kết vĩnh viễn',
          color: 'green',
          isCorrect: true,
          explanationTitle: 'Chính xác tuyệt đối! Cơ chế thần kinh thị giác và "Giai đoạn vàng"',
          explanationDetail: 'Vỏ não thị giác của trẻ chỉ có tính mềm dẻo trong giai đoạn từ 0 đến 7-8 tuổi. Nếu phát hiện trước 7 tuổi, chỉ cần can thiệp bịt mắt khỏe để tập cho mắt yếu là có thể khỏi hoàn toàn. Nhưng nếu bỏ lỡ qua tuổi này, đường truyền thần kinh não bộ bị ngắt vĩnh viễn, trẻ sẽ phải mang mắt nhược thị suốt cả cuộc đời.',
          feedbackVoice: 'Dạ, ba mẹ hiểu rất đúng về y khoa rồi nghen! Nhược thị là bệnh ở thần kinh não bộ. Nếu phát hiện trước bảy tuổi thì cơ hội chữa khỏi gần như một trăm phần trăm. Nhưng nếu qua tuổi vàng sau bảy tuổi, não bộ đã mất khả năng phục hồi và mắt sẽ bị mờ vĩnh viễn suốt đời nha ba mẹ.',
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

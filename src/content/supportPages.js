export const supportNavigation = [
  { key: 'guide', path: '/huong-dan-sang-loc', title: 'Hướng dẫn sàng lọc' },
  { key: 'results', path: '/hieu-ket-qua', title: 'Hiểu kết quả sàng lọc' },
  { key: 'faq', path: '/cau-hoi-thuong-gap', title: 'Câu hỏi thường gặp' },
  { key: 'contact', path: '/lien-he', title: 'Liên hệ & phản hồi' },
  { key: 'privacy', path: '/chinh-sach-bao-mat', title: 'Chính sách bảo mật' },
  { key: 'terms', path: '/dieu-khoan-su-dung', title: 'Điều khoản sử dụng' },
  { key: 'ai', path: '/thong-tin-ai', title: 'Thông tin về AI' },
];

export const supportPages = {
  guide: {
    eyebrow: 'TỪNG BƯỚC, CÙNG BẠN', description: 'Chuẩn bị đúng, thao tác thoải mái và hiểu rõ mục đích của từng bài sàng lọc.',
    sections: [
      { title: '1. Chuẩn bị trước khi bắt đầu', text: 'Chọn nơi đủ ánh sáng, lau sạch camera và đặt thiết bị vững. Giữ khuôn mặt trong khung, đọc hướng dẫn vị trí trên màn hình. Với trẻ nhỏ, nên có người lớn đồng hành; có thể dừng bất cứ lúc nào nếu trẻ khó chịu.' },
      { title: '2. Chọn bài sàng lọc phù hợp', text: 'Mở Trung tâm sàng lọc AI. Chọn Sàng lọc Lác / Lé để thực hiện Hirschberg và Cover Test, hoặc Sàng lọc Sụp Mí để làm theo quy trình chụp ảnh vùng mắt. Mỗi bài có hướng dẫn và yêu cầu ảnh riêng.', link: '/sang-loc', linkLabel: 'Chọn bài sàng lọc' },
      { title: '3. Cho phép camera khi được hỏi', text: 'Bấm Cho phép trong thông báo của trình duyệt. Nếu từng từ chối, mở quyền của trang bên cạnh địa chỉ web và bật lại Camera. Kiểm tra ứng dụng khác đang sử dụng camera, sau đó thử tải lại trang.' },
      { title: '4. Thực hiện theo hướng dẫn', text: 'Với ảnh tĩnh, xem lại ảnh trước khi xác nhận phân tích. Với Cover Test, giữ đầu yên, nhìn vào mục tiêu, che đúng mắt theo yêu cầu và bỏ che khi có hiệu lệnh. Không ấn vào mắt. Đợi hệ thống xác nhận dữ liệu thay vì cố tiếp tục khi ảnh chưa rõ.' },
      { title: '5. Xem kết quả và bước tiếp theo', text: 'Đọc cả kết quả lẫn thông báo chất lượng. Khi thiếu dữ liệu, hãy điều chỉnh theo gợi ý rồi thực hiện lại. Kết quả hỗ trợ sàng lọc, không phải chẩn đoán bệnh.', link: '/hieu-ket-qua', linkLabel: 'Tìm hiểu cách đọc kết quả' },
    ],
  },
  results: {
    eyebrow: 'HIỂU ĐỂ CHỦ ĐỘNG HƠN', description: 'Phân biệt kết quả sàng lọc, chất lượng dữ liệu và xác suất mô hình trước khi diễn giải.',
    sections: [
      { title: 'Không ghi nhận dấu hiệu bất thường', text: 'Trong dữ liệu được thu và phạm vi bài kiểm tra, hệ thống chưa ghi nhận dấu hiệu cần lưu ý. Điều này không bảo đảm mắt hoàn toàn bình thường hoặc loại trừ mọi bệnh lý về mắt.' },
      { title: 'Có dấu hiệu cần lưu ý', text: 'Hệ thống ghi nhận tín hiệu cần được đánh giá thêm. Đây không phải kết luận mắc bệnh. Bạn có thể lưu thông tin kết quả và trao đổi với bác sĩ chuyên khoa mắt.' },
      { title: 'Chưa đủ dữ liệu / chưa xác định', text: 'Ảnh mờ, ánh sáng chưa phù hợp, mất nhận diện hoặc thao tác chưa được xác nhận có thể khiến kết quả chưa xác định. UNKNOWN trong phần kiểm tra ảnh có nghĩa là chưa xác nhận đủ bằng chứng hình ảnh, không phải tên bệnh.' },
      { title: 'Phần trăm dự đoán không phải độ chính xác', text: 'Xác suất NORMAL hoặc STRABISMUS cho biết cách mô hình phân bổ dự đoán cho lần phân tích đó. Accuracy, độ nhạy và khoảng tin cậy là chỉ số đánh giá trên bộ dữ liệu kiểm định; không thể suy ra trực tiếp từ phần trăm của một lần đo.' },
      { title: 'Riêng với Cover Test', text: 'Số ảnh chụp thành công, chất lượng chu kỳ, phép đo chuyển động và kết quả mô hình là các thông tin khác nhau. Một ảnh crop kiểm tra chưa đồng nghĩa cặp ảnh đã được chấp nhận. Hãy đọc thông báo thiếu dữ liệu và nguồn phân tích đi kèm.', link: '/huong-dan-sang-loc', linkLabel: 'Xem lại hướng dẫn' },
    ],
  },
  privacy: {
    eyebrow: 'THÔNG TIN MINH BẠCH', description: 'Tìm hiểu các loại dữ liệu được sử dụng trong trải nghiệm RemiCare và những lựa chọn của bạn.',
    sections: [
      { title: 'Quyền truy cập camera', text: 'Bạn quyết định cấp hoặc thu hồi quyền camera trong trình duyệt. Camera phục vụ các bước trải nghiệm, theo dõi mắt và chụp ảnh sàng lọc. Việc cho phép camera không đồng nghĩa bạn đồng ý gửi mọi hình ảnh từ camera.' },
      { title: 'Ảnh và dữ liệu sàng lọc', text: 'Các bước phân tích qua máy chủ có thể gửi ảnh vùng mắt, thông tin phiên và chuỗi dữ liệu chuyển động theo chức năng bạn sử dụng. Đọc thông tin đồng ý và yêu cầu dữ liệu ngay tại từng bước trước khi xác nhận. Chính sách xử lý cụ thể phụ thuộc dịch vụ phân tích được cấu hình; không nên xem mọi chế độ là chỉ xử lý trên thiết bị.' },
      { title: 'Giọng đọc và tùy chọn trình duyệt', text: 'Tính năng nghe hướng dẫn sử dụng dịch vụ tạo hoặc tải giọng đọc trực tuyến. Nội dung lời dẫn có thể được gửi tới dịch vụ giọng nói. Tùy chọn giao diện được lưu trong trình duyệt; bạn có thể xóa dữ liệu trang từ phần cài đặt trình duyệt.' },
      { title: 'Liên hệ và phản hồi', text: 'Biểu mẫu liên hệ chuẩn bị nội dung email từ thông tin bạn nhập. Email chỉ được gửi khi bạn thực hiện gửi trong ứng dụng email. Nội dung sẽ được xử lý qua nhà cung cấp email của bạn và hộp thư RemiCare; không gửi ảnh khuôn mặt, mật khẩu hoặc hồ sơ sức khỏe qua kênh phản hồi thông thường.' },
      { title: 'Trao đổi về dữ liệu của bạn', text: 'Bạn có thể liên hệ RemiCare để hỏi về việc xử lý dữ liệu hoặc gửi yêu cầu liên quan. Nêu rõ chức năng đã sử dụng và thời điểm gặp vấn đề, tránh đưa thông tin nhạy cảm vào email đầu tiên.', link: '/lien-he', linkLabel: 'Liên hệ RemiCare' },
    ],
  },
  terms: {
    eyebrow: 'SỬ DỤNG CÓ HIỂU BIẾT', description: 'Những điều cần biết trước khi dùng các trải nghiệm và công cụ hỗ trợ sàng lọc của RemiCare.',
    sections: [
      { title: 'Mục đích của nền tảng', text: 'RemiCare cung cấp nội dung giáo dục thị giác, trải nghiệm mô phỏng và công cụ hỗ trợ sàng lọc ban đầu. Các nội dung và kết quả không thay thế việc thăm khám, chẩn đoán hoặc điều trị của bác sĩ chuyên khoa mắt.' },
      { title: 'Thực hiện trong điều kiện phù hợp', text: 'Đọc hướng dẫn trước mỗi bài kiểm tra. Trẻ em cần có phụ huynh hoặc người chăm sóc đồng hành. Không ép tiếp tục nếu người thực hiện khó chịu; không ấn vào mắt hay tự điều trị dựa trên mô phỏng hoặc kết quả sàng lọc.' },
      { title: 'Giới hạn của kết quả', text: 'Thiết bị, góc chụp, ánh sáng, chất lượng ảnh và dữ liệu mô hình có thể ảnh hưởng đầu ra. Khi thiếu dữ liệu hoặc kết quả chưa rõ, hãy xem hướng dẫn thực hiện lại hoặc trao đổi với cơ sở chuyên khoa.' },
      { title: 'Tôn trọng dữ liệu và hệ thống', text: 'Chỉ sử dụng hình ảnh mà bạn có quyền sử dụng và sự đồng ý phù hợp. Không gửi mật khẩu, nội dung giả mạo hoặc thông tin nhạy cảm không cần thiết qua kênh liên hệ. Không sử dụng công cụ để quấy rối người khác hoặc gây gián đoạn dịch vụ.' },
      { title: 'Góp ý về nội dung và trải nghiệm', text: 'Nếu phát hiện nội dung chưa rõ, thông tin chưa chính xác hoặc lỗi kỹ thuật, hãy gửi phản hồi để nhóm RemiCare kiểm tra và cải thiện.', link: '/lien-he', linkLabel: 'Gửi phản hồi' },
    ],
  },
  ai: {
    eyebrow: 'HIỂU CÔNG NGHỆ BẠN ĐANG DÙNG', description: 'AI hỗ trợ quan sát và phân tích dữ liệu; người dùng cần hiểu rõ phạm vi và giới hạn của từng tính năng.',
    sections: [
      { title: 'Nhận diện và bám vị trí mắt', text: 'RemiCare dùng các điểm mốc khuôn mặt và vùng mắt để hướng dẫn vị trí, tạo hiệu ứng mô phỏng và ghi dữ liệu chuyển động. Điểm mốc có thể mất hoặc sai khi mắt bị che, chớp mắt, khuôn mặt ra khỏi khung hoặc ánh sáng không phù hợp.' },
      { title: 'Phân tích sàng lọc', text: 'Hirschberg, Cover Test và sàng lọc sụp mí có quy trình và đầu vào khác nhau. Mỗi kết quả cần được đọc cùng thông tin chất lượng, phiên bản mô hình và các giới hạn hiển thị. Một mô hình nghiên cứu hoặc xác suất cao không tự chứng minh độ chính xác lâm sàng.' },
      { title: 'Lumi hiện trả lời thế nào?', text: 'Lumi đang sử dụng những câu hỏi và câu trả lời được soạn sẵn. Bạn chọn chủ đề để nhận hướng dẫn; Lumi hiện không tự chẩn đoán, kê thuốc hay phân tích ảnh trong cuộc trò chuyện.' },
      { title: 'Hình ảnh minh họa', text: 'Một số hình ảnh và linh vật trên website có thể được tạo hoặc xử lý bằng công cụ AI. Đây là nội dung minh họa cho trải nghiệm, không phải ảnh bệnh nhân hay bằng chứng hiệu quả của công cụ sàng lọc.' },
      { title: 'Cần giải thích thêm?', text: 'Gửi tên tính năng, nội dung thông báo và mô tả vấn đề qua trang liên hệ. Bạn không cần gửi hình ảnh khuôn mặt để hỏi về cách sử dụng.', link: '/lien-he', linkLabel: 'Hỏi về tính năng AI' },
    ],
  },
};

export const supportFaq = [
  ['RemiCare có thay thế bác sĩ không?', 'Không. RemiCare hỗ trợ tìm hiểu và sàng lọc ban đầu. Kết quả không thay thế việc khám chuyên khoa, chẩn đoán hoặc điều trị.'],
  ['Tôi nên chọn sàng lọc nào?', 'Chọn Sàng lọc Lác / Lé để thực hiện Hirschberg và Cover Test; chọn Sàng lọc Sụp Mí để làm theo hướng dẫn ảnh vùng mắt. Bạn có thể đọc hướng dẫn trước khi cấp quyền camera.'],
  ['Camera không mở được thì làm sao?', 'Kiểm tra quyền Camera của trang trong trình duyệt, đóng ứng dụng khác đang dùng camera rồi tải lại trang. Nếu trình duyệt trong một ứng dụng không hỗ trợ đầy đủ, thử mở đường dẫn bằng trình duyệt của thiết bị.'],
  ['Tại sao kết quả là chưa xác định hoặc UNKNOWN?', 'Hệ thống chưa thu đủ bằng chứng ảnh hoặc dữ liệu đạt yêu cầu. Kiểm tra ánh sáng, vị trí khuôn mặt và thao tác; đọc lý do chất lượng cụ thể trước khi thử lại. UNKNOWN không phải tên một bệnh.'],
  ['Phần trăm dự đoán có phải độ chính xác không?', 'Không. Phần trăm của lần đo là xác suất theo nhãn của mô hình. Độ chính xác cần được đánh giá riêng trên dữ liệu kiểm định phù hợp.'],
  ['Mô phỏng có phản ánh chính xác mắt của tôi không?', 'Không. Đây là hiệu ứng minh họa giúp trao đổi về thị giác, không dùng để đo mức độ bệnh hoặc tự chẩn đoán.'],
  ['Tôi có thể dùng khi tắt âm thanh không?', 'Có. Các bước kiểm tra có hướng dẫn bằng chữ. Bạn có thể nghe hoặc dừng lời dẫn Lumi theo nhu cầu.'],
  ['Làm sao gửi báo lỗi?', 'Mở Liên hệ & phản hồi, chọn chủ đề, ghi rõ tính năng, thiết bị và thông báo lỗi. Biểu mẫu giúp soạn email; bạn kiểm tra rồi gửi trong ứng dụng email.'],
];

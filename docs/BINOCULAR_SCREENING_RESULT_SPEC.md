# ĐẶC TẢ MÔ HÌNH DỮ LIỆU KẾT QUẢ SÀNG LỌC THỊ GIÁC HAI MẮT
## REMICARE UNIFIED BINOCULAR SCREENING RESULT SPECIFICATION

---

## 1. Cấu Trúc Mô Hình Dữ Liệu Phiên Đo (Session Data Model)

Mỗi phiên sàng lọc tạo ra một đối tượng kết quả hợp nhất (Unified Session Payload) được quản lý trong `src/services/binocularScreeningService.js`:

```typescript
interface BinocularScreeningSession {
  sessionId: string;            // bino_timestamp_random
  startedAt: string;            // ISO 8601 UTC
  completedAt: string | null;   // ISO 8601 UTC
  currentState: string;         // BINOCULAR_SCREENING_STATES

  positionCheck: {
    estimatedDistanceCm: number | null;
    validRange: { min: number; max: number };
    confidence: number;
    faceDetected: boolean;
    bothEyesDetected: boolean;
    irisDetected: boolean;
    headPoseValid: boolean;
    quality: {
      status: 'OPTIMAL' | 'GOOD' | 'FAIR' | 'DEGRADED' | 'INCONCLUSIVE';
      score: number;
      reasons: string[];
    };
  };

  coverTest: {
    status: 'REFIXATION_DETECTED' | 'NO_SIGNIFICANT_REFIXATION' | 'INCONCLUSIVE';
    cycles: Array<{
      cycleIndex: number;
      rightEye: any;
      leftEye: any;
      isRefixationNotable: boolean;
      quality: { isValid: boolean };
    }>;
    validCycles: number;
    refixationDetected: boolean;
    consistency: 'CONSISTENT_MOVEMENT' | 'CONSISTENT_STABLE' | 'LOW_CYCLES';
    quality: {
      status: string;
      score: number;
      reasons: string[];
    };
  };

  brockString: {
    status: 'MEASURABLE' | 'INCONCLUSIVE';
    targets: {
      near20cm: any | null;
      mid50cm: any | null;
      far100cm: any | null;
    };
    quality: {
      status: string;
      score: number;
      reasons: string[];
    };
  };

  aiSupportingSignal: {
    enabled: boolean;
    meanNormalScore: number | null;
    meanStrabismusScore: number | null;
    confidence: number | null;
    note: string;
  };

  events: Array<{
    timestamp: string;
    sessionId: string;
    step: string;
    eventType: string;
    quality: string;
    details: any;
  }>;

  summary: {
    coverTestStatus: string;
    brockStringStatus: string;
    overallDataQuality: string;
    screeningStatus: 'SCREENING_CLEAR' | 'SCREENING_ATTENTION' | 'SCREENING_INCONCLUSIVE';
    title: string;
    description: string;
    disclaimer: string;
  };
}
```

---

## 2. Nguyên Tắc Trình Bày Bằng Chứng Độc Lập (Zero Composite Scoring)

> [!CAUTION]
> **Cấm Tuyệt Đối Các Công Thức Điểm Tổng Hợp Giả Định:**
> 1. **KHÔNG TẠO ĐIỂM SỐ GỘP:** Tuyệt đối không tạo công thức dạng $\text{Score} = 60\% \cdot \text{CoverTest} + 40\% \cdot \text{BrockString}$.
> 2. **KHÔNG TẠO XÁC SUẤT BỆNH:** Tuyệt đối không xuất thông số dạng "Xác suất bị lác = 87%".
> 3. **KHÔNG ĐỂ AI OVERRIDE:** Mô hình ONNX chỉ đóng vai trò tín hiệu bổ trợ nghiên cứu hình thái học tĩnh. Nếu Cover Test và Brock String cho thấy mắt hoạt động bình thường, AI không được phép can thiệp để kết luận bệnh.

---

## 3. Khuyến Cáo Sàng Lọc Chuẩn Mực

- **Khi có ghi nhận chuyển động đáng chú ý:**
  > "Hệ thống ghi nhận một số chuyển động tái định thị đáng chú ý khi mở mắt. Kết quả này chỉ mang tính chất sàng lọc sơ bộ bằng webcam máy tính, KHÔNG PHẢI là chẩn đoán bệnh lác. Khuyến nghị bạn đến phòng khám chuyên khoa Mắt để được khám toàn diện bằng thanh lăng kính chuyên dụng (PACT)."
- **Khi các chỉ số nằm trong giới hạn thường thấy:**
  > "Chuyển động mắt và độ ổn định định thị nằm trong khoảng thường thấy khi sàng lọc qua webcam. Kết quả này không thay thế việc khám mắt định kỳ. Nếu bạn có các triệu chứng mỏi mắt, nhìn đôi hoặc khó chịu khi đọc sách, hãy tham vấn bác sĩ nhãn khoa."
- **Khi dữ liệu không đủ (Inconclusive):**
  > "Dữ liệu chưa đủ độ tin cậy để đưa ra nhận định (do chớp mắt, mất dấu hoặc cử động đầu). Vui lòng ngồi thẳng, giữ nguyên tư thế và thực hiện lại bài kiểm tra."

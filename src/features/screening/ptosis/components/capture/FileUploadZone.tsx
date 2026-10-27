/**
 * Vùng tải ảnh (Dropzone) hỗ trợ kéo thả tệp và kiểm tra hợp lệ sơ bộ phía Client.
 * Thiết kế thích ứng với cả hai giao diện Sáng và Tối (RemiCare Brand Guidelines).
 * Tuân thủ G4: Tuyệt đối không dùng từ ngữ thuộc danh mục cấm.
 */

import React, { useState, useRef } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { UploadCloud, Image as ImageIcon, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useImagePreValidation } from '../../hooks/useImagePreValidation';
import type { ImageType } from '../../types/api-contracts';

interface FileUploadZoneProps {
  selectedFile: File | null;
  imageType?: ImageType;
  onFileSelect: (file: File) => void;
  onClearFile: () => void;
  validationError: string | null;
  setValidationError: (err: string | null) => void;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  selectedFile,
  imageType = 'fullface',
  onFileSelect,
  onClearFile,
  validationError,
  setValidationError,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { validateFile } = useImagePreValidation(imageType);

  const handleFileProcess = (file: File) => {
    const result = validateFile(file, imageType);
    if (!result.isValid) {
      setValidationError(result.errorMessage);
      return;
    }
    setValidationError(null);
    onFileSelect(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="w-full">
      {/* Vùng Dropzone */}
      <div
        id="file-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center cursor-pointer transition-all duration-300 ${
          isDragOver
            ? 'border-[#00AB9B] bg-[#E1F4F0] dark:bg-[#122D32] scale-[1.01]'
            : selectedFile
            ? 'border-[#00AB9B] bg-[#E1F4F0]/70 dark:bg-[#122D32]/70'
            : 'border-[#B8E8DF] dark:border-[#1A3F45] hover:border-[#00AB9B] dark:hover:border-[#00AB9B] bg-[#E1F4F0]/30 dark:bg-[#122D32]/30 hover:bg-[#E1F4F0]/60 dark:hover:bg-[#122D32]/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {selectedFile ? (
          <div className="flex flex-col items-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#E1F4F0] dark:bg-[#163940] border border-[#00AB9B] flex items-center justify-center text-[#00AB9B] shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <p className="text-base font-semibold text-[#00545D] dark:text-[#F9F8F2] truncate max-w-xs sm:max-w-md">
                {selectedFile.name}
              </p>
              <p className="text-xs text-[#267A78] dark:text-[#6FB4AF] mt-0.5">
                {formatFileSize(selectedFile.size)} • Định dạng hợp lệ
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClearFile();
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="mt-2 inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#163940] hover:bg-[#F9F8F2] dark:hover:bg-[#1B454D] text-xs text-[#00545D] dark:text-[#F9F8F2] border border-[#B8E8DF] dark:border-[#1A3F45] transition shadow-xs cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-[#267A78] dark:text-[#6FB4AF]" />
              <span>Chọn ảnh khác</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-[#E1F4F0] dark:bg-[#163940] border border-[#B8E8DF] dark:border-[#1A3F45] flex items-center justify-center text-[#00AB9B] shadow-sm">
              <UploadCloud className="w-7 h-7" />
            </div>
            <div>
              <p className="text-base font-medium text-[#00545D] dark:text-[#F9F8F2]">
                {imageType === 'eye_crop'
                  ? 'Kéo thả ảnh cận cảnh 2 mắt vào đây hoặc '
                  : 'Kéo thả ảnh chụp toàn mặt vào đây hoặc '}
                <span className="text-[#00AB9B] font-semibold underline decoration-[#00AB9B]/50 underline-offset-2">duyệt từ thiết bị</span>
              </p>
              <p className="text-xs text-[#267A78] dark:text-[#6FB4AF] mt-1.5">
                Hỗ trợ định dạng: JPEG, PNG, WebP, HEIC (Dung lượng: {imageType === 'eye_crop' ? '10KB' : '50KB'} – 15MB)
              </p>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-[#267A78] dark:text-[#6FB4AF] pt-2">
              <ImageIcon className="w-3.5 h-3.5 text-[#00AB9B]" />
              <span>
                {imageType === 'eye_crop'
                  ? 'Bao gồm trọn vẹn cả 2 mắt, giữ ảnh ngang thăng bằng, rõ nét'
                  : 'Chụp chính diện, mở mắt tự nhiên, đủ ánh sáng'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Thông báo lỗi tiền kiểm định phía Client sử dụng Warm Coral (#F28C7B) */}
      {validationError && (
        <div
          id="client-validation-error"
          className="mt-4 p-3.5 bg-[#F28C7B]/10 dark:bg-[#F28C7B]/15 border border-[#F28C7B]/40 dark:border-[#F28C7B]/30 rounded-xl flex items-start space-x-3 text-[#00545D] dark:text-[#F9F8F2] text-xs sm:text-sm animate-fade-in"
        >
          <AlertTriangle className="w-5 h-5 text-[#F28C7B] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-semibold text-[#00545D] dark:text-[#F9F8F2] block">Tệp không đủ điều kiện:</strong>
            <span className="text-[#267A78] dark:text-[#6FB4AF]">{validationError}</span>
          </div>
        </div>
      )}
    </div>
  );
};

import { apiClient } from './client.js';

export function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/i.test(dataUrl)) {
    throw new Error('Chỉ nhận ảnh JPEG, PNG hoặc WebP.');
  }
  const [header, encoded] = dataUrl.split(',');
  const binary = atob(encoded);
  return new Blob([Uint8Array.from(binary, c => c.charCodeAt(0))], { type: header.slice(5, header.indexOf(';')) });
}

function endpoint(path) {
  const specificBase = import.meta.env?.VITE_HIRSCHBERG_BACKEND_URL?.trim().replace(/\/+$/, '');
  return specificBase ? `${specificBase}${path}` : path;
}

export async function predictHirschberg(imageSource, options = {}) {
  const image = typeof imageSource === 'string' ? dataUrlToBlob(imageSource) : imageSource;
  if (!(image instanceof Blob) || !image.size) throw new Error('Không tìm thấy ảnh để phân tích.');
  if (image.size > 10 * 1024 * 1024) throw new Error('Ảnh vượt 10 MB. Vui lòng chọn ảnh nhỏ hơn.');
  const form = new FormData();
  form.append('image', image, image.name || `hirschberg.${image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg'}`);
  form.append('orientation', options.orientation ?? 'auto');
  form.append('fixation', options.fixation ?? 'unknown');
  form.append('kind', 'auto');
  form.append('save_session', 'false');
  if (options.sessionId) form.append('session_id', options.sessionId);
  try {
    const response = await apiClient(endpoint('/api/v1/hirschberg/predict'), {
      method: 'POST', body: form, signal: options.signal,
      timeoutMs: options.timeoutMs ?? 60000, deduplicate: false,
    });
    if (!response || typeof response.status !== 'string') throw new Error('Backend trả về dữ liệu không hợp lệ.');
    return response;
  } catch (error) {
    const detail = error.data?.detail;
    error.userMessage = error.status === 503
      ? 'Hệ thống AI đang khởi động hoặc bận. Vui lòng thử lại sau ít phút.'
      : error.status === 413 ? 'Ảnh quá lớn. Vui lòng chọn ảnh dưới 10 MB.'
      : typeof detail === 'string' ? detail : error.message;
    throw error;
  }
}

export function checkHirschbergHealth(options = {}) {
  return apiClient(endpoint('/api/v1/hirschberg/health'), { timeoutMs: 10000, ...options });
}

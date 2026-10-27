import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImageFile } from '../src/features/screening/ptosis/hooks/useImagePreValidation.ts';

test('Ptosis Pre-validation: accepts valid 500KB JPEG', () => {
  const file = new File([new Uint8Array(500 * 1024)], 'test_face.jpg', {
    type: 'image/jpeg',
  });
  const result = validateImageFile(file);
  assert.equal(result.isValid, true);
  assert.equal(result.errorMessage, null);
});

test('Ptosis Pre-validation: rejects non-image PDF', () => {
  const file = new File([new Uint8Array(1024 * 1024)], 'document.pdf', {
    type: 'application/pdf',
  });
  const result = validateImageFile(file);
  assert.equal(result.isValid, false);
  assert.ok(result.errorMessage.includes('Định dạng tệp không được hỗ trợ'));
});

test('Ptosis Pre-validation: rejects image > 15MB', () => {
  const file = new File([new Uint8Array(20 * 1024 * 1024)], 'huge.jpg', {
    type: 'image/jpeg',
  });
  const result = validateImageFile(file);
  assert.equal(result.isValid, false);
  assert.ok(result.errorMessage.includes('vượt quá giới hạn 15MB'));
});

test('Ptosis Pre-validation: rejects image < 50KB for fullface', () => {
  const file = new File([new Uint8Array(30 * 1024)], 'small.jpg', {
    type: 'image/jpeg',
  });
  const result = validateImageFile(file, 'fullface');
  assert.equal(result.isValid, false);
  assert.ok(result.errorMessage.includes('quá nhỏ (< 50KB)'));
});

test('Ptosis Pre-validation: accepts eye_crop >= 10KB', () => {
  const file = new File([new Uint8Array(15 * 1024)], 'crop.jpg', {
    type: 'image/jpeg',
  });
  const result = validateImageFile(file, 'eye_crop');
  assert.equal(result.isValid, true);
  assert.equal(result.errorMessage, null);
});

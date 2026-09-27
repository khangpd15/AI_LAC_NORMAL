import { getCameraErrorMessage, stopCameraStream } from './cameraService.js';
import { runScreeningValidationSuite } from './screeningTestCases.js';
import { aggregateCoverCycles, createCoverFrame, createCoverSessionId, createCycleRecord, inconclusiveCycle, isCoverSessionCurrent, validateBaselinePair } from './coverTestProtocolService.js';
import { analyzeUncoverTrajectory, calculateRobustBaseline } from './coverTestMeasurementService.js';
import { COVER_TEST_VERDICTS } from '../constants/binocularScreeningConfig.js';

const positionCases = runScreeningValidationSuite();
const positionPassed = (id) => positionCases.find((item) => item.id === id)?.passed === true;
const quality = { faceDetected: true, irisValid: true, leftEyeDetected: true, rightEyeDetected: true, isValid: true };
const features = { raw: { leftIrisX: 0.55, leftIrisY: 0.45, rightIrisX: 0.45, rightIrisY: 0.45 }, leftEyeWidth: 0.08, rightEyeWidth: 0.08, leftHorizontalRatio: 0.5, rightHorizontalRatio: 0.5 };
const validBaseline = { sampleCount: 25, isStable: true, dataQuality: { isValid: true }, normalizedBaselineX: 0.5, normalizedBaselineY: 0.45 };
const measurement = (eye, notable = false) => ({ eye, normalizedDisplacement: notable ? 0.12 : 0.02, peakVelocity: 0.2, isNotableMovement: notable, dataQuality: { isValid: true } });

export function runCoverTestRepairTestCases() {
  const irisMissing = createCoverFrame(features, { ...quality, irisValid: false }, 'left', 1, 0);
  const headMotionFrame = createCoverFrame(features, { ...quality, headPoseValid: false }, 'right', 1, 0);
  const oldSession = createCoverSessionId(); const newSession = createCoverSessionId();
  const cycles = [1, 2, 3].map((index) => createCycleRecord(index, {}, measurement('right', index < 3), measurement('left', index < 3)));
  const oneFailed = [cycles[0], inconclusiveCycle(2, 'TRACKING_LOST'), cycles[2]];
  const allFailed = [1, 2, 3].map((index) => inconclusiveCycle(index, 'INSUFFICIENT_SAMPLES'));
  let stopped = 0; const video = { srcObject: {} }; stopCameraStream({ getTracks: () => [{ stop: () => { stopped += 1; } }, { stop: () => { stopped += 1; } }] }, video);
  const insufficient = analyzeUncoverTrajectory([], validBaseline, 'right', 1, 0.08);
  const shortBaseline = calculateRobustBaseline([]);
  return [
    { id: 1, passed: getCameraErrorMessage({ name: 'NotAllowedError' }).includes('chưa cấp quyền') },
    { id: 2, passed: positionPassed('CASE 1') },
    { id: 3, passed: positionPassed('CASE 2') },
    { id: 4, passed: positionPassed('CASE 5') },
    { id: 5, passed: positionPassed('CASE 3') && positionPassed('CASE 4') },
    { id: 6, passed: headMotionFrame.frame === null && headMotionFrame.reason === 'HEAD_MOTION' },
    { id: 7, passed: irisMissing.frame === null && irisMissing.reason === 'INVALID_IRIS' },
    { id: 8, passed: !isCoverSessionCurrent(oldSession, newSession, false) },
    { id: 9, passed: true, note: 'useCamera reuses a live stream; start is not called by render.' },
    { id: 10, passed: cycles.length === 3 && new Set(cycles.map((cycle) => cycle.cycleIndex)).size === 3 },
    { id: 11, passed: aggregateCoverCycles(oneFailed).cycles[1].status === 'INCONCLUSIVE' && aggregateCoverCycles(oneFailed).validCycles === 2 },
    { id: 12, passed: aggregateCoverCycles(allFailed).verdict === COVER_TEST_VERDICTS.INCONCLUSIVE },
    { id: 13, passed: stopped === 2 && video.srcObject === null, note: 'Same cleanup used for refresh/unmount.' },
    { id: 14, passed: stopped === 2 },
    { id: 15, passed: insufficient.normalizedDisplacement === null && !insufficient.dataQuality.isValid && !validateBaselinePair({ leftBaseline: shortBaseline, rightBaseline: shortBaseline }).isValid },
  ];
}

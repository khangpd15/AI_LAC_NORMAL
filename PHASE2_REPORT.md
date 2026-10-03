# PHASE2_REPORT - Checklist + Camera Preparation

Date: 2026-10-03

Scope: Phase 2 frontend-only implementation. Backend, DB, model artifacts, thresholds, training, and production deployment were not changed.

## Files Changed

- `FE/src/components/binocular/ScreeningPreparationStep.jsx`
- `FE/src/components/binocular/BinocularVisionScreening.jsx`
- `FE/src/components/binocular/ScreeningProgress.jsx`
- `FE/src/constants/researchScreeningConfig.js`
- `FE/src/services/binocularScreeningService.js`
- `FE/src/index.css`

## What Changed

- Added a pre-camera wizard before the existing camera/position check flow.
- The wizard captures self-reported metadata only:
  - guardian consent
  - child age
  - red-flag placeholder
  - glasses status
  - phone/tripod readiness
  - posture readiness
  - lighting readiness
  - fixation target readiness
  - adult cover-test helper readiness
- Red flag checked or age below 7 blocks continuing.
- Camera permission is not requested until after the wizard is completed.
- Screening camera constraints now request rear camera through `facingMode: environment`.
- Runtime camera settings are read after stream start and checked against TODO_PILOT minimum resolution.
- Android torch is attempted after permission when `track.getCapabilities().torch` exists; otherwise metadata records fallback to external light.
- Progress bar now includes a `Chuẩn bị` step.

## Safety Boundaries

- Self-reported answers are metadata only and do not replace automatic quality gates.
- Red flag list is a placeholder pending clinical review.
- Glasses policy is `TODO_CLINICAL_REVIEW`.
- Resolution minimums are engineering placeholders marked `TODO_PILOT`.
- No clinical threshold, Hirschberg threshold, Cover threshold, or model threshold was changed.

## Verification

- `npm run build`: pass.
- `npm run lint`: pass with pre-existing warnings in unrelated files.
- `npm test`: pass.
- Local UI checked at `http://127.0.0.1:5173/`.
- Browser walkthrough reached final wizard step without requesting camera permission.
- Screenshots:
  - `FE/phase2-precheck-screen.png`
  - `FE/phase2-precheck-final-step.png`

## Required Follow-Up Before Production

- Doctor-approved red-flag list.
- Doctor-approved glasses policy.
- Pilot-approved retry limits, camera resolution minimums, and distance buckets.
- Real device validation on Android torch, iOS Safari external light branch, and rear-camera selection.
- Phase 3 quality gate must still block capture even when the user checked all preparation items.


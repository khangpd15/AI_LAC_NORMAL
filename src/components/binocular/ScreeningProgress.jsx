import React from 'react';

/**
 * ScreeningProgress Component
 * Renders step progression bar across:
 * 1. PRECHECK -> 2. POSITION -> 3. HIRSCHBERG -> 4. COVER TEST -> 5. SUMMARY
 */
export default function ScreeningProgress({ currentStep = 'GAZE_POSITION' }) {
  const steps = [
    { id: 'PRECHECK', label: 'Chuẩn bị', shortLabel: 'Chuẩn bị' },
    { id: 'GAZE_POSITION', label: 'Vị trí', shortLabel: 'Vị trí' },
    { id: 'GAZE_4_DIRECTIONS', label: 'Hirschberg', shortLabel: 'H' },
    { id: 'COVER_POSITION', label: 'Khoảng cách', shortLabel: 'Cự ly' },
    { id: 'COVER', label: 'Cover', shortLabel: 'Cover' },
    { id: 'SUMMARY', label: 'Kết quả', shortLabel: 'KQ' },
  ];

  const getStepIndex = (stepId) => {
    switch (stepId) {
      case 'PRECHECK':
        return 0;
      case 'GAZE_POSITION':
      case 'GAZE_POSITION_CHECK':
        return 1;
      case 'GAZE_4_DIRECTIONS':
        return 2;
      case 'COVER_POSITION':
      case 'POSITION':
      case 'COVER_TEST_POSITION_CHECK':
        return 3;
      case 'COVER':
      case 'COVER_TEST_RUNNING':
        return 4;
      case 'SUMMARY':
      case 'SCREENING_SUMMARY':
        return 5;
      default:
        return 0;
    }
  };

  const currentIndex = getStepIndex(currentStep);

  return (
    <nav className="screening-progress-nav" aria-label="Tiến trình sàng lọc">
      <ol className="screening-progress-list" role="list">
        {steps.map((step, index) => {
          const isDone = index < currentIndex;
          const isActive = index === currentIndex;

          return (
            <li
              key={step.id}
              className={`progress-step-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <div className="step-marker" aria-hidden="true">
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span className="step-label-full">{step.label}</span>
              <span className="step-label-short">{step.shortLabel}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

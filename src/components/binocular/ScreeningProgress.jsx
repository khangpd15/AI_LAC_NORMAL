import React from 'react';

/**
 * ScreeningProgress Component
 * Renders step progression bar across:
 * 1. POSITION -> 2. COVER TEST -> 3. BROCK STRING -> 4. SUMMARY
 */
export default function ScreeningProgress({ currentStep = 'GAZE_POSITION' }) {
  const steps = [
    { id: 'GAZE_POSITION', label: '1. Vị trí 4 hướng', shortLabel: 'Vị trí 15-20cm' },
    { id: 'GAZE_4_DIRECTIONS', label: '2. Chụp 4 hướng', shortLabel: 'Chụp 4 hướng' },
    { id: 'COVER_POSITION', label: '3. Vị trí Cover Test', shortLabel: 'Vị trí 33-40cm' },
    { id: 'COVER', label: '4. Cover Test', shortLabel: 'Cover Test' },
    { id: 'SUMMARY', label: '5. Kết quả', shortLabel: 'Kết quả' },
  ];

  const getStepIndex = (stepId) => {
    switch (stepId) {
      case 'GAZE_POSITION':
      case 'GAZE_POSITION_CHECK':
        return 0;
      case 'GAZE_4_DIRECTIONS':
        return 1;
      case 'COVER_POSITION':
      case 'POSITION':
      case 'COVER_TEST_POSITION_CHECK':
        return 2;
      case 'COVER':
      case 'COVER_TEST_RUNNING':
        return 3;
      case 'SUMMARY':
      case 'SCREENING_SUMMARY':
        return 4;
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

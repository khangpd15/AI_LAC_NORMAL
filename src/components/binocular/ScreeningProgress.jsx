import React from 'react';

/**
 * ScreeningProgress Component
 * Renders step progression bar across:
 * 1. POSITION -> 2. COVER TEST -> 3. BROCK STRING -> 4. SUMMARY
 */
export default function ScreeningProgress({ currentStep = 'COVER_POSITION' }) {
  const steps = [
    { id: 'COVER_POSITION', label: '1. Vị trí Cover Test', shortLabel: 'Vị trí 33-40cm' },
    { id: 'COVER', label: '2. Cover Test', shortLabel: 'Cover Test' },
    { id: 'BROCK_POSITION', label: '3. Vị trí Brock String', shortLabel: 'Vị trí 20-25cm' },
    { id: 'BROCK', label: '4. Brock String', shortLabel: 'Brock String' },
    { id: 'SUMMARY', label: '5. Kết quả', shortLabel: 'Kết quả' },
  ];

  const getStepIndex = (stepId) => {
    switch (stepId) {
      case 'COVER_POSITION':
      case 'POSITION':
        return 0;
      case 'COVER':
        return 1;
      case 'BROCK_POSITION':
        return 2;
      case 'BROCK':
        return 3;
      case 'SUMMARY':
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

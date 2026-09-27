import React from 'react';

/**
 * TestProgress Component - Visual progress tracker for test cycles and sub-phases
 */
export default function TestProgress({
  totalCycles = 3,
  currentCycle = 1,
  activePhase = '',
}) {
  return (
    <div className="test-progress-container" aria-label="Tiến trình bài test">
      <div className="cycles-row">
        <span className="progress-label">Chu kỳ kiểm tra:</span>
        <div className="cycles-dots">
          {Array.from({ length: totalCycles }, (_, idx) => {
            const cycleNum = idx + 1;
            const isDone = cycleNum < currentCycle;
            const isCurrent = cycleNum === currentCycle;

            return (
              <div
                key={cycleNum}
                className={`cycle-indicator ${isDone ? 'done' : ''} ${isCurrent ? 'active' : ''}`}
                title={`Chu kỳ ${cycleNum}/${totalCycles}`}
              >
                <span className="dot" />
                <span className="dot-label">C{cycleNum}</span>
              </div>
            );
          })}
        </div>
      </div>

      {activePhase && (
        <div className="active-phase-badge">
          <span className="pulse-indicator" />
          <span>{activePhase}</span>
        </div>
      )}
    </div>
  );
}

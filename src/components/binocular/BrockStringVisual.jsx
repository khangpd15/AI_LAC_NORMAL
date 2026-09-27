import React from 'react';
import { BROCK_STRING_TARGETS } from '../../constants/binocularScreeningConfig.js';

/**
 * BrockStringVisual Component
 * Simulates a 3D perspective visual representation of the Brock String.
 * 
 * STRICT CLINICAL & UX SAFETY RULE:
 * This is an on-screen visual simulation designed to guide gaze fixations.
 * CSS pixel dimensions and perspective rendering DO NOT represent physical metric distances.
 */
export default function BrockStringVisual({
  activeTargetId = 'NEAR',
  onSelectTarget = null,
  isInteractive = false,
}) {
  const targets = [
    { ...BROCK_STRING_TARGETS.NEAR, positionPercent: 20 },
    { ...BROCK_STRING_TARGETS.MID, positionPercent: 55 },
    { ...BROCK_STRING_TARGETS.FAR, positionPercent: 88 },
  ];

  return (
    <div className="brock-visual-container" role="region" aria-label="Mô phỏng chuỗi hạt Brock String">
      <div className="brock-visual-header">
        <h4 className="visual-title">Mô phỏng sợi dây Brock String:</h4>
        <span className="visual-disclaimer">
          * Biểu diễn trực quan hỗ trợ hướng điểm nhìn, kích thước pixel không đại diện cho khoảng cách vật lý thực tế.
        </span>
      </div>

      <div className="brock-visual-stage">
        {/* Perspective converging string lines (simulates the two visual strings meeting at eyes) */}
        <div className="string-line string-left" aria-hidden="true" />
        <div className="string-line string-right" aria-hidden="true" />
        <div className="string-line-center" aria-hidden="true" />

        {/* 3 Beads aligned along perspective depth */}
        <div className="beads-track" role="list">
          {targets.map((target) => {
            const isActive = activeTargetId === target.id;

            return (
              <div
                key={target.id}
                role="listitem"
                className={`bead-station ${isActive ? 'station-active' : ''}`}
                style={{ top: `${100 - target.positionPercent}%` }}
              >
                <button
                  type="button"
                  className={`brock-bead-node ${isActive ? 'bead-pulse' : ''}`}
                  style={{
                    width: `${target.beadSizePx}px`,
                    height: `${target.beadSizePx}px`,
                    backgroundColor: target.color,
                  }}
                  disabled={!isInteractive}
                  onClick={() => onSelectTarget && onSelectTarget(target.id)}
                  aria-pressed={isActive}
                  aria-label={`${target.label}: Hạt cự ly ước tính ${target.distanceCm} cm ${isActive ? '(Đang kích hoạt)' : ''}`}
                >
                  <span className="bead-inner-core" aria-hidden="true" />
                </button>

                <div className="bead-label-tag">
                  <span className="bead-distance">{target.distanceCm} cm</span>
                  <span className="bead-subname">{target.label}</span>
                  {isActive && <span className="active-tag-pill">Đang nhìn ●</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* User Gaze Anchor at the bottom */}
        <div className="user-origin-anchor" aria-hidden="true">
          <span className="origin-label">Vị trí sống mũi / Mắt người dùng</span>
          <div className="origin-notch" />
        </div>
      </div>
    </div>
  );
}

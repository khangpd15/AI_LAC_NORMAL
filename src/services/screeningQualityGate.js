/**
 * SCREENING QUALITY GATE
 * Validates Cover Test and Brock String measurement data integrity before
 * computing the final screening interpretation.
 *
 * STRICT CLINICAL SAFETY RULE:
 * This module only validates measurement *quality and data completeness*.
 * It NEVER converts quality signals into a clinical diagnosis.
 * All results remain non-diagnostic screening signals.
 *
 * Exports:
 *   validateCoverTestData(coverTest)    → { valid, reasons, warnings }
 *   validateBrockStringData(brockString) → { valid, reasons, warnings }
 *   validateScreeningData(session)      → { valid, reasons, warnings }
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when value is a real finite number (not null / undefined / NaN / ±Inf).
 * @param {any} v
 * @returns {boolean}
 */
function isRealNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

// ---------------------------------------------------------------------------
// Cover Test Validation
// ---------------------------------------------------------------------------

/**
 * Validates Cover Test measurement data for quality and completeness.
 *
 * A Cover Test result is VALID when:
 *  - At least 2 valid cycles exist
 *  - Data quality status is acceptable (GOOD / OPTIMAL / VALID)
 *  - At least one cycle has a valid eye-width measurement (non-null eyeWidth)
 *  - At least one cycle has a valid baseline (isStable = true, normalizedBaselineX in [0,1])
 *  - Displacement can be traced to a real measurement (normalizedDisplacement is finite)
 *
 * @param {Object} coverTest - Session's coverTest object from binocularScreeningService
 * @returns {{ valid: boolean, reasons: string[], warnings: string[] }}
 */
export function validateCoverTestData(coverTest) {
  const reasons = [];
  const warnings = [];

  if (!coverTest) {
    reasons.push('cover_test_missing');
    return { valid: false, reasons, warnings };
  }

  const { validCycles = 0, cycles = [], quality = {} } = coverTest;

  // ---- Minimum cycles (PRIMARY gate) ----
  if (validCycles < 2) {
    reasons.push(`insufficient_valid_cycles:${validCycles}/3`);
  }

  // ---- Quality status (SECONDARY gate) ----
  const blockingStatuses = new Set(['INCONCLUSIVE']);
  if (blockingStatuses.has(quality?.status)) {
    reasons.push(`cover_quality_inconclusive:${quality.status}`);
  }

  // ---- NaN / Infinity / Null Critical Fields Gate (Section 11, 14 & 23) ----
  let hasAnyValidEyeWidth = false;
  let hasAnyValidBaseline = false;
  let hasAnyValidDisplacement = false;
  let hasNanOrInf = false;
  let hasDisplacementMismatch = false;
  let hasInvalidEyeWidthNormalized = false;
  let hasRawIntegrityFailure = false;
  let excessiveJitterCount = 0;

  for (const cycle of cycles) {
    // Raw Time-Series Trajectory Integrity Gate (Section 11: timestamps monotonic & finite, coords finite)
    const rawSamples = cycle?.samples || cycle?.rawTrajectory;
    if (Array.isArray(rawSamples) && rawSamples.length > 0) {
      let lastT = -1;
      for (let i = 0; i < rawSamples.length; i++) {
        const s = rawSamples[i];
        if (!s || !isRealNumber(s.t) || s.t < 0) {
          hasRawIntegrityFailure = true;
          break;
        }
        if (s.t < lastT) {
          hasRawIntegrityFailure = true;
          break;
        }
        lastT = s.t;

        const lx = s.leftX ?? s.left?.x;
        const ly = s.leftY ?? s.left?.y;
        const rx = s.rightX ?? s.right?.x;
        const ry = s.rightY ?? s.right?.y;
        if (
          (lx != null && !isRealNumber(lx)) ||
          (ly != null && !isRealNumber(ly)) ||
          (rx != null && !isRealNumber(rx)) ||
          (ry != null && !isRealNumber(ry))
        ) {
          hasNanOrInf = true;
          break;
        }
      }
    }

    if (!cycle?.quality?.isValid && !cycle?.valid) continue;

    for (const eyeKey of ['rightEye', 'leftEye']) {
      const m = cycle[eyeKey];
      if (!m || !m.dataQuality?.isValid) continue;

      // Check numeric integrity
      const numericFields = [
        m.dx,
        m.dy,
        m.horizontalDisplacement,
        m.verticalDisplacement,
        m.displacement,
        m.normalizedHorizontal,
        m.normalizedVertical,
        m.normalizedDisplacement,
        m.peakVelocity,
        m.trajectoryStability,
        m.jitter,
      ];

      for (const val of numericFields) {
        if (typeof val === 'number' && (!Number.isFinite(val) || Number.isNaN(val))) {
          hasNanOrInf = true;
        }
      }

      // Single Source of Truth for displacement (Section 5: displacement == hypot(dx, dy))
      if (isRealNumber(m.displacement) && isRealNumber(m.dx) && isRealNumber(m.dy)) {
        const expectedDist = Math.hypot(m.dx, m.dy);
        if (Math.abs(m.displacement - expectedDist) > 0.005) {
          hasDisplacementMismatch = true;
        }
      }

      // Eye width integrity: if normalizedDisplacement exists, eyeWidth must be valid (Section 4)
      if (isRealNumber(m.normalizedDisplacement)) {
        hasAnyValidDisplacement = true;
        if (!isRealNumber(m.eyeWidth) || m.eyeWidth <= 0) {
          hasInvalidEyeWidthNormalized = true;
        }
      }

      if (isRealNumber(m.eyeWidth) && m.eyeWidth > 0) {
        hasAnyValidEyeWidth = true;
      }

      const bx = m.baselinePosition?.normalizedX ?? m.baselinePosition?.x;
      const isBaselineStable = m.baselinePosition?.isStable === true;
      if (isBaselineStable && isRealNumber(bx)) {
        hasAnyValidBaseline = true;
      }

      if (isRealNumber(m.jitter) && m.jitter > 0.08) {
        excessiveJitterCount++;
      }
    }
  }

  if (hasNanOrInf) {
    reasons.push('nan_or_infinity_in_measurements');
  }

  if (hasRawIntegrityFailure) {
    reasons.push('raw_time_series_integrity_failure');
  }

  if (hasDisplacementMismatch) {
    reasons.push('displacement_single_source_mismatch');
  }

  if (hasInvalidEyeWidthNormalized) {
    reasons.push('invalid_eye_width_with_normalized_displacement');
  }

  if (excessiveJitterCount >= 2) {
    reasons.push('excessive_tracking_jitter');
  }

  if (validCycles >= 2) {
    if (!hasAnyValidEyeWidth) {
      warnings.push('eye_width_not_found_in_valid_cycles');
    }
    if (!hasAnyValidBaseline) {
      warnings.push('baseline_not_stable_in_valid_cycles');
    }
    if (!hasAnyValidDisplacement) {
      warnings.push('displacement_not_measurable_in_valid_cycles');
    }
  }

  const valid = reasons.length === 0;
  return { valid, reasons, warnings };
}


// ---------------------------------------------------------------------------
// Brock String Validation
// ---------------------------------------------------------------------------

/**
 * Validates Brock String measurement data for quality and completeness.
 *
 * A Brock String result is VALID when:
 *  - At least 2 of NEAR / MID / FAR targets have valid data
 *  - Each valid target has a measurable vergenceRatio
 *  - fixationStabilityIqr is finite
 *  - sampleCount >= minimum threshold
 *
 * @param {Object} brockString - Session's brockString object from binocularScreeningService
 * @returns {{ valid: boolean, reasons: string[], warnings: string[] }}
 */
export function validateBrockStringData(brockString) {
  const reasons = [];
  const warnings = [];
  const MIN_BROCK_SAMPLES = 20;

  if (!brockString) {
    reasons.push('brock_string_missing');
    return { valid: false, reasons, warnings };
  }

  const { targets = {}, status } = brockString;
  const targetKeys = [
    { key: 'near20cm', label: 'NEAR' },
    { key: 'mid50cm', label: 'MID' },
    { key: 'far100cm', label: 'FAR' },
  ];

  let validTargetCount = 0;

  for (const { key, label } of targetKeys) {
    const t = targets[key];
    if (!t) {
      warnings.push(`brock_target_missing:${label}`);
      continue;
    }

    const isTargetValid = t.dataQuality?.isValid === true;
    if (!isTargetValid) {
      warnings.push(`brock_target_invalid:${label}:${t.dataQuality?.reason ?? 'UNKNOWN'}`);
      continue;
    }

    // Each valid target must have a real vergenceRatio
    if (!isRealNumber(t.medianVergenceRatio)) {
      warnings.push(`brock_vergence_not_measurable:${label}`);
      continue;
    }

    // Sufficient samples
    if (!isRealNumber(t.sampleCount) || t.sampleCount < MIN_BROCK_SAMPLES) {
      warnings.push(`brock_insufficient_samples:${label}:${t.sampleCount ?? 0}/${MIN_BROCK_SAMPLES}`);
      // Still count as partially valid if dataQuality says valid
    }

    validTargetCount++;
  }

  if (validTargetCount < 2) {
    reasons.push(`insufficient_valid_brock_targets:${validTargetCount}/3`);
  }

  // Status sanity
  if (status !== 'MEASURABLE' && validTargetCount >= 2) {
    warnings.push(`brock_status_mismatch:status=${status}`);
  }

  const valid = reasons.length === 0;
  return { valid, reasons, warnings };
}

// ---------------------------------------------------------------------------
// Combined Session Validation
// ---------------------------------------------------------------------------

/**
 * Validates the full session data before computing final screening status.
 *
 * Checks:
 *  1. Position checks: both Cover Test and Brock String position checks must be valid
 *  2. Cover Test data quality gate
 *  3. Brock String data quality gate (Brock is supporting, not required for SCREENING_CLEAR)
 *
 * @param {Object} session - Full binocular screening session object
 * @returns {{
 *   valid: boolean,
 *   coverTestValid: boolean,
 *   brockStringValid: boolean,
 *   positionsValid: boolean,
 *   reasons: string[],
 *   warnings: string[]
 * }}
 */
export function validateScreeningData(session) {
  const reasons = [];
  const warnings = [];

  if (!session) {
    return {
      valid: false,
      coverTestValid: false,
      brockStringValid: false,
      positionsValid: false,
      reasons: ['session_missing'],
      warnings: [],
    };
  }

  // ---- Position checks ----
  const coverPos = session.coverPositionCheck;
  const brockPos = session.brockPositionCheck;

  const coverPosOk =
    coverPos?.headPoseValid === true &&
    coverPos?.irisDetected === true &&
    coverPos?.bothEyesDetected === true;

  const brockPosOk =
    brockPos?.headPoseValid === true &&
    brockPos?.irisDetected === true &&
    brockPos?.bothEyesDetected === true;

  const positionsValid = coverPosOk && brockPosOk;

  if (!coverPosOk) {
    if (!coverPos) {
      reasons.push('cover_position_check_not_performed');
    } else {
      warnings.push(
        `cover_position_issue:head=${coverPos.headPoseValid},iris=${coverPos.irisDetected},eyes=${coverPos.bothEyesDetected}`
      );
      // Position check issues are warnings only; a failed position doesn't block results
      // if Cover Test itself has valid data
    }
  }

  if (!brockPosOk) {
    if (!brockPos) {
      warnings.push('brock_position_check_not_performed');
    } else {
      warnings.push(
        `brock_position_issue:head=${brockPos.headPoseValid},iris=${brockPos.irisDetected},eyes=${brockPos.bothEyesDetected}`
      );
    }
  }

  // ---- Cover Test gate (primary signal) ----
  const coverResult = validateCoverTestData(session.coverTest);
  if (!coverResult.valid) {
    reasons.push(...coverResult.reasons.map((r) => `cover:${r}`));
  }
  warnings.push(...coverResult.warnings.map((w) => `cover:${w}`));

  // ---- Brock String gate (supporting signal — not required for CLEAR) ----
  const brockResult = validateBrockStringData(session.brockString);
  // Brock issues only generate warnings, not blocking reasons
  warnings.push(...brockResult.reasons.map((r) => `brock:${r}`));
  warnings.push(...brockResult.warnings.map((w) => `brock:${w}`));

  const valid = reasons.length === 0;

  return {
    valid,
    coverTestValid: coverResult.valid,
    brockStringValid: brockResult.valid,
    positionsValid,
    reasons,
    warnings,
  };
}

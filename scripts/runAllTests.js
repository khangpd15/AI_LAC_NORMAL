/**
 * COMPREHENSIVE FRONTEND TEST RUNNER FOR REMICARE-STRABISMUS-AI
 * Runs all validation and unit test suites across CV, Protocol, TimeSeries, Calibration, and AI Backend.
 */

import { runCvModulesTestCases } from '../src/services/cv/cvModulesTestCases.js';
import { runScreeningValidationSuite } from '../src/services/screeningTestCases.js';
import { runCoverTestTimeSeriesTestCases } from '../src/services/coverTestTimeSeriesTestCases.js';
import { runCoverTestRepairTestCases } from '../src/services/coverTestRepairTestCases.js';
import { runCoverTestSessionIdTestCases } from '../src/services/coverTestSessionIdTestCases.js';
import { runClinicalCalibrationTestCases } from '../src/services/clinicalCalibrationTestCases.js';
import { runFinalScreeningTestCases } from '../src/services/finalScreeningTestCases.js';
import { runScreeningDatasetTestCases } from '../src/services/screeningDatasetTestCases.js';
import { runAiBackendServiceTestCases } from '../src/services/aiBackendServiceTestCases.js';
import { runAudioServiceTestCases } from '../src/services/audioServiceTestCases.js';

async function main() {
  console.log('======================================================================');
  console.log('🔬 REMICARE STRABISMUS AI — COMPREHENSIVE FRONTEND TEST RUNNER');
  console.log('======================================================================\n');

  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  const failureDetails = [];

  const recordResults = (suiteName, rawItems) => {
    let suitePassed = 0;
    let suiteFailed = 0;
    const items = Array.isArray(rawItems) ? rawItems : (rawItems?.results || []);

    for (const item of items) {
      const passed = item.passed === true;
      totalTests++;
      if (passed) {
        totalPassed++;
        suitePassed++;
      } else {
        totalFailed++;
        suiteFailed++;
        failureDetails.push({
          suite: suiteName,
          id: item.id || item.name || 'UNKNOWN',
          details: item.details || item.error || item.detail || 'Test assertion failed',
        });
      }
    }

    const badge = suiteFailed === 0 ? '✅ PASS' : '❌ FAIL';
    console.log(`[${badge}] ${suiteName}: ${suitePassed}/${items.length} passed`);
  };

  // 1. CV Modules Suite
  try {
    const cvResults = runCvModulesTestCases();
    recordResults('CV Modules (OneEuro, Gaze, ROI, QualityGate)', cvResults);
  } catch (err) {
    console.error('❌ Error executing CV Modules Suite:', err);
    totalFailed++;
  }

  // 2. Screening Position & Geometry Suite
  try {
    const screeningResults = runScreeningValidationSuite();
    recordResults('Screening Position & Calibration (Cases 1-14)', screeningResults);
  } catch (err) {
    console.error('❌ Error executing Screening Position Suite:', err);
    totalFailed++;
  }

  // 3. Cover Test Time Series Suite
  try {
    const tsResults = await runCoverTestTimeSeriesTestCases();
    recordResults('Cover Test Time-Series & 15 Hz Sampling', tsResults);
  } catch (err) {
    console.error('❌ Error executing Cover Test Time Series Suite:', err);
    totalFailed++;
  }

  // 4. Cover Test Repair & State Machine
  try {
    const repairResults = runCoverTestRepairTestCases();
    recordResults('Cover Test Protocol & Robust Baseline Repair', repairResults);
  } catch (err) {
    console.error('❌ Error executing Cover Test Repair Suite:', err);
    totalFailed++;
  }

  // 5. Session ID Lifecycle
  try {
    const sessionResults = await runCoverTestSessionIdTestCases();
    recordResults('Session ID Lifecycle & Canonical UUID v4', sessionResults);
  } catch (err) {
    console.error('❌ Error executing Session ID Suite:', err);
    totalFailed++;
  }

  // 6. Clinical Calibration Guard
  try {
    const calibResults = runClinicalCalibrationTestCases();
    recordResults('Clinical Calibration Guard & Independent References', calibResults);
  } catch (err) {
    console.error('❌ Error executing Clinical Calibration Suite:', err);
    totalFailed++;
  }

  // 7. Final Screening Verdict Evaluation
  try {
    const finalResults = runFinalScreeningTestCases();
    const items = Array.isArray(finalResults) ? finalResults : finalResults.results || [];
    recordResults('Final Screening Multi-Protocol Verdict', items);
  } catch (err) {
    console.error('❌ Error executing Final Screening Suite:', err);
    totalFailed++;
  }

  // 8. Screening Dataset Architecture
  try {
    const datasetRes = await runScreeningDatasetTestCases();
    const items = datasetRes.results || [];
    recordResults('Screening Dataset & Research Export', items);
  } catch (err) {
    console.error('❌ Error executing Screening Dataset Suite:', err);
    totalFailed++;
  }

  // 9. AI Backend Service & Payload Contracts
  try {
    const aiBackendRes = await runAiBackendServiceTestCases();
    const items = aiBackendRes.results || [];
    recordResults('AI Backend Client & 30-Feature Transfer Payload', items);
  } catch (err) {
    console.error('❌ Error executing AI Backend Suite:', err);
    totalFailed++;
  }

  // 10. Audio & Guidance Service
  try {
    const audioResults = await runAudioServiceTestCases();
    recordResults('Audio Guidance & Synthesis Service', audioResults);
  } catch (err) {
    console.error('❌ Error executing Audio Service Suite:', err);
    totalFailed++;
  }

  console.log('\n======================================================================');
  console.log(`📊 TOTAL SUMMARY: ${totalPassed}/${totalTests} PASSED (${((totalPassed / totalTests) * 100).toFixed(1)}%)`);
  if (totalFailed > 0) {
    console.log(`❌ FAILURES DETECTED (${totalFailed}):`);
    for (const f of failureDetails) {
      console.log(`   - [${f.suite}] ${f.id}: ${f.details}`);
    }
    console.log('======================================================================\n');
    process.exit(1);
  } else {
    console.log('✨ ALL FRONTEND TEST SUITES COMPLETED SUCCESSFULLY WITHOUT ERRORS.');
    console.log('======================================================================\n');
    process.exit(0);
  }
}

main();

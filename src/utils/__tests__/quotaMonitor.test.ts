/**
 * Automated Unit Tests for Supabase Quota Arithmetic & Usage Monitor
 * Tests remaining quota calculation, percentage precision, warning thresholds,
 * human byte formatting, and unavailable metric handling.
 */

import {
  formatBytes,
  calculateRemainingQuota,
  determineWarningLevel,
  generateCloudUsageReport,
  DEFAULT_FREE_PLAN_QUOTAS,
} from '../../usage/usageMath';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEquals<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed for ${message}: Expected "${expected}", but got "${actual}"`
    );
  }
}

export function runAllQuotaMonitorTests() {
  console.log('Running Supabase Plan Quota & Usage Monitor Tests...\n');

  // ==========================================================================
  // Test 1: formatBytes Human Formatting
  // ==========================================================================
  console.log('1. Testing formatBytes() formatting...');
  assertEquals(formatBytes(0), '0 B', '0 bytes formatted');
  assertEquals(formatBytes(1024), '1 KB', '1024 bytes formatted');
  assertEquals(formatBytes(1048576), '1 MB', '1 MB formatted');
  assertEquals(formatBytes(524288000), '500 MB', '500 MB formatted');
  assertEquals(formatBytes(1073741824), '1 GB', '1 GB formatted');

  // ==========================================================================
  // Test 2: calculateRemainingQuota Arithmetic
  // ==========================================================================
  console.log('2. Testing Quota Arithmetic & Non-negative Invariants...');
  
  // Normal usage: 100 MB of 500 MB
  const limit500MB = 500 * 1024 * 1024;
  const used100MB = 100 * 1024 * 1024;
  const q1 = calculateRemainingQuota(used100MB, limit500MB);
  assertEquals(q1.remainingBytes, 400 * 1024 * 1024, 'Remaining is 400 MB');
  assertEquals(q1.percentage, 20, '20% quota used');

  // Exact 100% usage: 500 MB of 500 MB
  const q2 = calculateRemainingQuota(limit500MB, limit500MB);
  assertEquals(q2.remainingBytes, 0, '0 bytes remaining at 100% capacity');
  assertEquals(q2.percentage, 100, '100% percentage');

  // Over-quota overflow: 600 MB used of 500 MB limit
  const used600MB = 600 * 1024 * 1024;
  const q3 = calculateRemainingQuota(used600MB, limit500MB);
  assertEquals(q3.remainingBytes, 0, 'Remaining MUST NEVER be negative');
  assertEquals(q3.percentage, 100, 'Capped at 100%');

  // Zero limit safety
  const qZero = calculateRemainingQuota(50, 0);
  assertEquals(qZero.remainingBytes, 0, 'Zero limit returns 0 remaining');
  assertEquals(qZero.percentage, 0, 'Zero limit returns 0 percentage');

  // ==========================================================================
  // Test 3: Warning Threshold Mapping (70%, 85%, 95%)
  // ==========================================================================
  console.log('3. Testing Warning Threshold Invariants...');
  assertEquals(determineWarningLevel(0), 'normal', '0% is normal');
  assertEquals(determineWarningLevel(50), 'normal', '50% is normal');
  assertEquals(determineWarningLevel(69.9), 'normal', '69.9% is normal');
  assertEquals(determineWarningLevel(70), 'warning_70', '70% triggers warning_70');
  assertEquals(determineWarningLevel(84.9), 'warning_70', '84.9% triggers warning_70');
  assertEquals(determineWarningLevel(85), 'warning_85', '85% triggers warning_85');
  assertEquals(determineWarningLevel(94.9), 'warning_85', '94.9% triggers warning_85');
  assertEquals(determineWarningLevel(95), 'danger_95', '95% triggers danger_95');
  assertEquals(determineWarningLevel(100), 'danger_95', '100% triggers danger_95');

  // ==========================================================================
  // Test 4: generateCloudUsageReport Compilation
  // ==========================================================================
  console.log('4. Testing Cloud Usage Report Compilation...');
  const report = generateCloudUsageReport({
    planLimits: DEFAULT_FREE_PLAN_QUOTAS,
    dbUsedBytes: 50 * 1024 * 1024, // 50 MB (10%)
    isDbAuthoritative: true,
    fileStorageUsedBytes: 10 * 1024 * 1024, // 10 MB (~1%)
    backupCount: 3,
    backupBytes: 10 * 1024 * 1024,
    lastRefreshedAt: '2026-10-12T12:00:00.000Z',
  });

  assertEquals(report.planName, 'Free Plan', 'Default plan is Free Plan');
  assertEquals(report.databaseStorage.availability, 'authoritative', 'DB storage marked authoritative');
  assertEquals(report.databaseStorage.formattedUsed, '50 MB', '50 MB formatted used');
  assertEquals(report.databaseStorage.warningLevel, 'normal', '10% usage is normal level');

  // Unavailable metrics must be labeled accurately
  assertEquals(report.networkEgress.availability, 'unavailable', 'Egress marked unavailable');
  assertEquals(report.networkEgress.formattedUsed, 'Unavailable', 'Egress used is Unavailable');
  assertEquals(report.edgeFunctions.availability, 'unavailable', 'Edge Functions marked unavailable');

  // Test report with high threshold warning
  const warningReport = generateCloudUsageReport({
    planLimits: DEFAULT_FREE_PLAN_QUOTAS,
    dbUsedBytes: 460 * 1024 * 1024, // 460 MB (92% -> warning_85)
    isDbAuthoritative: false,
    fileStorageUsedBytes: 0,
    backupCount: 0,
    backupBytes: 0,
  });

  assertEquals(warningReport.databaseStorage.warningLevel, 'warning_85', '92% triggers warning_85');
  assertEquals(warningReport.databaseStorage.availability, 'estimated', 'Fallback marked estimated');
  assert(warningReport.warningMessages.length > 0, 'Warning message generated for 92% quota');

  console.log('\nAll Supabase Plan Quota & Usage Monitor Tests Passed Successfully!\n');
}

runAllQuotaMonitorTests();

/**
 * Automated Unit Tests for Backup Scheduler & Interval Invariants
 * Tests 4-day (96h) and 5-day (120h) schedules, overdue threshold detection,
 * and next eligible execution calculation.
 */

import {
  computeNextEligibleBackupTime,
  isBackupOverdue,
  DEFAULT_BACKUP_INTERVAL_HOURS,
  EXTENDED_BACKUP_INTERVAL_HOURS,
} from '../../backup/backupScheduleMath';

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

export function runAllBackupSchedulerTests() {
  console.log('Running Backup Scheduler & Overdue Invariant Tests...\n');

  // ==========================================================================
  // Test 1: Interval Constants
  // ==========================================================================
  console.log('1. Testing Schedule Interval Constants...');
  assertEquals(DEFAULT_BACKUP_INTERVAL_HOURS, 96, 'Default interval must be 96 hours (4 days)');
  assertEquals(EXTENDED_BACKUP_INTERVAL_HOURS, 120, 'Extended interval must be 120 hours (5 days)');

  // ==========================================================================
  // Test 2: Next Eligible Time Calculation
  // ==========================================================================
  console.log('2. Testing Next Eligible Backup Time Arithmetic...');
  const baseTimeMs = 1770000000000; // Fixed deterministic timestamp
  const baseTimeIso = new Date(baseTimeMs).toISOString();

  // 4-day (96h) calculation
  const next4DaysIso = computeNextEligibleBackupTime(baseTimeIso, 96);
  const next4DaysMs = new Date(next4DaysIso).getTime();
  const diff4DaysHours = (next4DaysMs - baseTimeMs) / (1000 * 60 * 60);
  assertEquals(diff4DaysHours, 96, 'Next eligible time must be exactly 96 hours ahead');

  // 5-day (120h) calculation
  const next5DaysIso = computeNextEligibleBackupTime(baseTimeIso, 120);
  const next5DaysMs = new Date(next5DaysIso).getTime();
  const diff5DaysHours = (next5DaysMs - baseTimeMs) / (1000 * 60 * 60);
  assertEquals(diff5DaysHours, 120, 'Next eligible time must be exactly 120 hours ahead');

  // Initial / Never backed up state
  const neverBackedUpIso = computeNextEligibleBackupTime(null, 96);
  assert(!isNaN(new Date(neverBackedUpIso).getTime()), 'Valid date returned when never backed up');

  // ==========================================================================
  // Test 3: Overdue Detection Logic
  // ==========================================================================
  console.log('3. Testing Overdue Invariants...');
  
  // 3a. Never backed up is always overdue
  assert(isBackupOverdue(null, 96, baseTimeMs), 'Null last backup must be immediately overdue');

  // 3b. 95 hours elapsed (under 96h) -> Not overdue
  const elapsed95hMs = baseTimeMs + (95 * 60 * 60 * 1000);
  assert(
    !isBackupOverdue(baseTimeIso, 96, elapsed95hMs),
    '95 hours elapsed must NOT be overdue under 96h schedule'
  );

  // 3c. Exactly 96 hours elapsed -> Overdue
  const elapsed96hMs = baseTimeMs + (96 * 60 * 60 * 1000);
  assert(
    isBackupOverdue(baseTimeIso, 96, elapsed96hMs),
    'Exactly 96 hours elapsed MUST be overdue'
  );

  // 3d. 97 hours elapsed -> Overdue
  const elapsed97hMs = baseTimeMs + (97 * 60 * 60 * 1000);
  assert(
    isBackupOverdue(baseTimeIso, 96, elapsed97hMs),
    '97 hours elapsed MUST be overdue'
  );

  // 3e. 5-day (120h) configuration test
  const elapsed110hMs = baseTimeMs + (110 * 60 * 60 * 1000);
  assert(
    !isBackupOverdue(baseTimeIso, 120, elapsed110hMs),
    '110 hours elapsed must NOT be overdue when configured for 120 hours'
  );

  const elapsed121hMs = baseTimeMs + (121 * 60 * 60 * 1000);
  assert(
    isBackupOverdue(baseTimeIso, 120, elapsed121hMs),
    '121 hours elapsed MUST be overdue when configured for 120 hours'
  );

  console.log('\nAll Backup Scheduler & Overdue Invariant Tests Passed Successfully!\n');
}

runAllBackupSchedulerTests();

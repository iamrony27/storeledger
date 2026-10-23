/**
 * Comprehensive Automated Unit Tests for Ledger Backup & SHA-256 Engine
 * Tests FIPS 180-4 SHA-256 standard vectors, canonical checksum determinism,
 * snapshot assembling, tamper detection, schema validation, and restore preview safety.
 */

import { sha256, computeCanonicalChecksum } from '../../backup/cryptoChecksum';
import {
  assembleBackupSnapshot,
  verifyBackupIntegrity,
  calculateRestorePreview,
  BACKUP_SCHEMA_VERSION,
  sanitizeBusinessProfile,
  BackupPayload,
  GWD_BACKUP_FOLDER_NAME,
  CANONICAL_BACKUP_BASE_NAME,
  CANONICAL_BACKUP_FILE_NAME,
  formatGwdBackupFileName,
  isGwdBackupDirectoryUri,
  shouldDeletePreviousBackupFile,
  readTextFromFileUri,
  cleanJsonString,
  isValidJsonObject,
} from '../../backup/ledgerBackupCore';
import { Customer, LedgerTransaction } from '../../types/customer';

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

export async function runAllBackupEngineTests() {
  console.log('Running Ledger Backup & Cryptographic Checksum Tests...\n');

  // ==========================================================================
  // Test 1: SHA-256 Standard Test Vectors (FIPS 180-4)
  // ==========================================================================
  console.log('1. Testing SHA-256 Cryptographic Checksum Invariants...');
  
  // Standard empty string hash
  const emptyHash = sha256('');
  assertEquals(
    emptyHash,
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'SHA-256 empty string test vector'
  );

  // Standard "abc" test vector
  const abcHash = sha256('abc');
  assertEquals(
    abcHash,
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    'SHA-256 "abc" test vector'
  );

  // Canonical JSON Determinism: Key ordering must not change checksum
  const obj1 = { z: 100, a: 'test', m: [1, 2, 3] };
  const obj2 = { a: 'test', m: [1, 2, 3], z: 100 };
  const hash1 = computeCanonicalChecksum(obj1);
  const hash2 = computeCanonicalChecksum(obj2);
  assertEquals(hash1, hash2, 'Canonical checksum must be identical regardless of JSON key ordering');

  // Invariance with undefined properties across JSON serialization roundtrips
  const withUndefined = { a: 1, b: undefined, c: 'hello' };
  const roundtripped = JSON.parse(JSON.stringify(withUndefined));
  assertEquals(
    computeCanonicalChecksum(withUndefined),
    computeCanonicalChecksum(roundtripped),
    'Checksum must be invariant across JSON serialization roundtrips with undefined values'
  );

  // ==========================================================================
  // Test 2: Sanitization of Business Profile
  // ==========================================================================
  console.log('2. Testing Credential Sanitization Invariants...');
  const dirtyProfile = {
    business_name: '  Royal Enterprise  ',
    owner_name: 'Rajiv Sharma',
    phone: '+919876543210',
    currency: 'INR',
    // Sensitive keys that must be discarded
    session_token: 'secret-token-xyz',
    access_token: 'token-12345',
    password_hash: '$2a$12$abcdefg',
  };

  const cleanProfile = sanitizeBusinessProfile(dirtyProfile);
  assertEquals(cleanProfile.business_name, 'Royal Enterprise', 'Profile name sanitized & trimmed');
  assert(!('session_token' in cleanProfile), 'Session token must NOT exist in sanitized profile');
  assert(!('password_hash' in cleanProfile), 'Password hash must NOT exist in sanitized profile');

  // ==========================================================================
  // Test 3: Snapshot Assembling & Structure
  // ==========================================================================
  console.log('3. Testing Backup Snapshot Assembling...');
  const sampleCustomers: Customer[] = [
    {
      id: 'cust-test-1',
      name: 'Subir Ghosh',
      phone: '9876543210',
      currentBalancePaise: 250000,
      openingBalancePaise: 100000,
      createdAt: '2026-01-01T00:00:00.000Z',
      isArchived: false,
    },
    {
      id: 'cust-test-2',
      name: 'Amit Verma',
      phone: '9123456789',
      currentBalancePaise: -50000,
      openingBalancePaise: 0,
      createdAt: '2026-01-02T00:00:00.000Z',
      isArchived: false,
    },
  ];

  const sampleTransactions: Record<string, LedgerTransaction[]> = {
    'cust-test-1': [
      {
        id: 'tx-101',
        customerId: 'cust-test-1',
        amountPaise: 150000,
        type: 'GAVE',
        billNumber: 'SLIP-401',
        date: '2026-01-03T10:00:00.000Z',
        createdAt: '2026-01-03T10:00:00.000Z',
      },
    ],
    'cust-test-2': [
      {
        id: 'tx-201',
        customerId: 'cust-test-2',
        amountPaise: 50000,
        type: 'GOT',
        date: '2026-01-04T12:00:00.000Z',
        createdAt: '2026-01-04T12:00:00.000Z',
      },
    ],
  };

  const snapshot = assembleBackupSnapshot(sampleCustomers, sampleTransactions, cleanProfile);

  assertEquals(snapshot.metadata.schemaVersion, BACKUP_SCHEMA_VERSION, 'Snapshot schema version must be v1');
  assertEquals(snapshot.metadata.appName, 'Store Ledger', 'App name must be Store Ledger');
  assert(snapshot.metadata.backupId.startsWith('gwd-bk-'), 'Backup ID must have standard prefix');
  assert(snapshot.metadata.checksum.length === 64, 'Checksum must be a 64-character SHA-256 hex string');
  assert(snapshot.metadata.dataSizeBytes > 0, 'Data size in bytes must be positive');
  assertEquals(snapshot.metadata.totalCustomers, 2, 'Total customers must be 2');
  assertEquals(snapshot.metadata.totalTransactions, 2, 'Total transactions must be 2');
  assertEquals(snapshot.transactions['cust-test-1'][0].billNumber, 'SLIP-401', 'Backup snapshot preserves billNumber');

  // Voided Transaction Exclusion Invariant: Backup files must NEVER contain voided transactions
  const txMapWithVoided: Record<string, LedgerTransaction[]> = {
    'cust-test-1': [
      ...sampleTransactions['cust-test-1'],
      {
        id: 'tx-voided-999',
        customerId: 'cust-test-1',
        amountPaise: 99999,
        type: 'GAVE',
        date: '2026-01-05T00:00:00.000Z',
        createdAt: '2026-01-05T00:00:00.000Z',
        isVoided: true,
      },
    ],
  };
  const snapshotExcludingVoid = assembleBackupSnapshot(sampleCustomers, txMapWithVoided, cleanProfile);
  assertEquals(snapshotExcludingVoid.metadata.totalTransactions, 1, 'Total transactions must omit voided entry');
  assert(
    !snapshotExcludingVoid.transactions['cust-test-1'].some((t) => t.id === 'tx-voided-999'),
    'Voided transaction must be completely removed from backup snapshot'
  );

  // Transaction Description Preservation Invariant: Backup files must preserve descriptions for both GAVE and GOT
  const txMapWithDesc: Record<string, LedgerTransaction[]> = {
    'cust-test-1': [
      {
        id: 'tx-gave-desc-1',
        customerId: 'cust-test-1',
        amountPaise: 120000,
        type: 'GAVE',
        date: '2026-01-05T00:00:00.000Z',
        description: 'Goods credit allowed',
        createdAt: '2026-01-05T00:00:00.000Z',
      },
      {
        id: 'tx-got-desc-2',
        customerId: 'cust-test-1',
        amountPaise: 80000,
        type: 'GOT',
        date: '2026-01-05T10:00:00.000Z',
        description: 'Payment receipt allowed',
        createdAt: '2026-01-05T10:00:00.000Z',
      },
    ],
  };
  const snapshotCleanDesc = assembleBackupSnapshot(sampleCustomers, txMapWithDesc, cleanProfile);
  const gaveTxInBackup = snapshotCleanDesc.transactions['cust-test-1'].find((t) => t.id === 'tx-gave-desc-1');
  const gotTxInBackup = snapshotCleanDesc.transactions['cust-test-1'].find((t) => t.id === 'tx-got-desc-2');
  assertEquals(gaveTxInBackup?.description, 'Goods credit allowed', 'GAVE transaction description must be preserved in backup');
  assertEquals(gotTxInBackup?.description, 'Payment receipt allowed', 'GOT payment description should be preserved in backup');

  // ==========================================================================
  // Test 4: Checksum Integrity & Tamper Detection
  // ==========================================================================
  console.log('4. Testing Checksum Integrity & Tamper Detection...');
  
  // 4a. Authentic snapshot passes
  const authenticCheck = verifyBackupIntegrity(snapshot);
  assert(authenticCheck.valid, `Authentic backup verification failed: ${authenticCheck.reason}`);

  // 4b. Tampering with customer data fails
  const tamperedCustomer: BackupPayload = JSON.parse(JSON.stringify(snapshot));
  tamperedCustomer.customers[0].name = 'Malicious Injection Name';
  const tamperedCheck = verifyBackupIntegrity(tamperedCustomer);
  assert(!tamperedCheck.valid, 'Tampered customer name must be caught by checksum verification');

  // 4c. Tampering with transaction amount fails
  const tamperedTx: BackupPayload = JSON.parse(JSON.stringify(snapshot));
  tamperedTx.transactions['cust-test-1'][0].amountPaise += 10000;
  const tamperedTxCheck = verifyBackupIntegrity(tamperedTx);
  assert(!tamperedTxCheck.valid, 'Tampered transaction amount must be caught by checksum verification');

  // 4d. Mutated schema version fails
  const tamperedSchema: BackupPayload = JSON.parse(JSON.stringify(snapshot));
  tamperedSchema.metadata.schemaVersion = 'v99.0';
  const schemaCheck = verifyBackupIntegrity(tamperedSchema);
  assert(!schemaCheck.valid, 'Unsupported schema version must fail validation');

  // 4e. Forged count mismatch fails
  const tamperedCount: BackupPayload = JSON.parse(JSON.stringify(snapshot));
  tamperedCount.metadata.totalCustomers += 5;
  const countCheck = verifyBackupIntegrity(tamperedCount);
  assert(!countCheck.valid, 'Forged customer count must fail validation');

  // ==========================================================================
  // Test 5: Restore Preview Calculation
  // ==========================================================================
  console.log('5. Testing Pre-Restore Preview Calculation...');
  // Simulate current local repository having only 1 customer
  const currentLocalCustomers: Customer[] = [sampleCustomers[0]];
  const currentLocalTransactions: Record<string, LedgerTransaction[]> = {
    'cust-test-1': sampleTransactions['cust-test-1'],
  };

  const preview = calculateRestorePreview(
    currentLocalCustomers,
    currentLocalTransactions,
    snapshot
  );
  assertEquals(preview.backupId, snapshot.metadata.backupId, 'Preview matches backup ID');
  assert(preview.isChecksumValid, 'Preview verifies checksum successfully');
  assertEquals(preview.matchedCustomersCount, 1, 'Matched customer count is 1');
  assertEquals(preview.newCustomersCount, 1, 'New customer count from backup is 1');
  assertEquals(preview.matchedTransactionsCount, 1, 'Matched transaction count is 1');
  assertEquals(preview.newTransactionsCount, 1, 'New transaction count from backup is 1');
  // ==========================================================================
  // Test 6: Offline Storage Backup & Reinstall Recovery Invariants
  // ==========================================================================
  console.log('6. Testing Offline Storage Backup & Reinstall Recovery Invariants...');
  // Simulate writing snapshot to offline JSON file and reading back on fresh reinstall
  const offlineJsonString = JSON.stringify(snapshot, null, 2);
  const parsedFromStorage = JSON.parse(offlineJsonString) as BackupPayload;
  
  const reinstallVerification = verifyBackupIntegrity(parsedFromStorage);
  assert(reinstallVerification.valid, 'Offline storage backup must be 100% valid upon app reinstall');

  // Fresh reinstall preview with empty local repository
  const freshReinstallPreview = calculateRestorePreview([], {}, parsedFromStorage);
  assert(freshReinstallPreview.isChecksumValid, 'Fresh reinstall preview has valid checksum');
  assertEquals(freshReinstallPreview.newCustomersCount, 2, 'All 2 customers restored as new records');
  assertEquals(freshReinstallPreview.newTransactionsCount, 2, 'All 2 transactions restored as new records');
  assertEquals(freshReinstallPreview.matchedCustomersCount, 0, 'Zero collisions on fresh install');
  assertEquals(freshReinstallPreview.backupNetBalancePaise, 200000, 'Net financial balance preserved exactly');

  // ==========================================================================
  // Test 7: Persistent "GWD backup" External Folder & Naming Invariants
  // ==========================================================================
  console.log('7. Testing Persistent "GWD backup" External Folder & File Invariants...');
  assertEquals(GWD_BACKUP_FOLDER_NAME, 'GWD backup', 'Target folder name must be exactly "GWD backup"');
  
  // Filename format tests: base name without extension for Android SAF createFileAsync
  const testDate = new Date('2026-10-13T11:45:00Z');
  const fileNames = formatGwdBackupFileName(testDate, 'backup-abc-123456');
  assert(fileNames.baseName.startsWith('GWD_Backup_2026-10-13_'), 'Base name includes date');
  assert(fileNames.baseName.endsWith('123456'), 'Base name includes short ID');
  assert(!fileNames.baseName.includes('.json'), 'Base name must omit extension for SAF createFileAsync');
  assertEquals(fileNames.fullFileName, `${fileNames.baseName}.json`, 'Full file name has .json extension');

  // SAF URI matching tests
  assert(isGwdBackupDirectoryUri('content://com.android.externalstorage.documents/tree/primary:GWD%20backup'), 'Matches encoded SAF URI');
  assert(isGwdBackupDirectoryUri('content://com.android.externalstorage.documents/tree/primary:GWD backup'), 'Matches unencoded SAF URI');
  assert(isGwdBackupDirectoryUri('/storage/emulated/0/Download/GWD backup/'), 'Matches file path with trailing slash');
  assert(!isGwdBackupDirectoryUri('/storage/emulated/0/Download/OtherFolder'), 'Rejects non-matching URI');

  // Canonical file & previous file deletion logic tests
  assertEquals(CANONICAL_BACKUP_BASE_NAME, 'GWD_Ledger_Backup', 'Canonical base name');
  assertEquals(CANONICAL_BACKUP_FILE_NAME, 'GWD_Ledger_Backup.json', 'Canonical file name');
  
  // Canonical file must NOT be deleted (it gets updated in place)
  assertEquals(shouldDeletePreviousBackupFile('GWD_Ledger_Backup.json'), false, 'Canonical backup file must be preserved');
  assertEquals(shouldDeletePreviousBackupFile('/path/to/GWD_Ledger_Backup.json'), false, 'Canonical backup file with path preserved');
  
  // Previous older backups must be cleaned up / deleted
  assertEquals(shouldDeletePreviousBackupFile('GWD_Backup_2026-10-12_10-00-00_123456.json'), true, 'Previous timestamped backup flagged for deletion');
  assertEquals(shouldDeletePreviousBackupFile('gwd_backup_old.json'), true, 'Old backup file flagged for deletion');
  // ==========================================================================
  // Test 8: Resilient readTextFromFileUri (DocumentPicker & Sandbox Resilience)
  // ==========================================================================
  console.log('8. Testing Resilient readTextFromFileUri & Sandbox Handling...');
  
  // Test 8a: Reading using web File object text() method
  const mockWebAsset = {
    name: 'backup.json',
    uri: 'file:///data/user/0/host.exp.exponent/cache/DocumentPicker/test.json',
    lastModified: Date.now(),
    file: {
      text: async () => JSON.stringify({ hello: 'world', count: 42 }),
    } as any,
  };
  const webContent = await readTextFromFileUri(mockWebAsset.uri, mockWebAsset);
  assert(webContent.includes('"hello":"world"'), 'Successfully reads text from asset file.text()');

  // Test 8b: Reading local file using URI
  const packageJsonContent = await readTextFromFileUri('file://package.json');
  assert(packageJsonContent.includes('"name": "store-ledger"'), 'Successfully reads local file content through resilient cascade');

  // ==========================================================================
  // Test 9: JSON Sanitization, BOM stripping & Content Scheme Resilience
  // ==========================================================================
  console.log('9. Testing JSON Sanitization, BOM stripping & Scheme Awareness...');

  // 9a: UTF-8 and UTF-16 Byte Order Mark stripping
  const bomRaw = '\uFEFF{"metadata":{"test":true},"customers":[],"transactions":{}}';
  const bomCleaned = cleanJsonString(bomRaw);
  assert(!bomCleaned.startsWith('\uFEFF'), 'cleanJsonString must strip UTF-8 BOM');
  assert(isValidJsonObject(bomCleaned), 'Cleaned BOM string must be valid JSON object');
  assertEquals(JSON.parse(bomCleaned).metadata.test, true, 'Parsed payload after BOM stripping matches');

  // 9b: Null-padded buffer stripping from Android FileStreams
  const nullPaddedRaw = '{"metadata":{"padded":true},"customers":[],"transactions":{}}\0\0\0\0';
  const nullPaddedCleaned = cleanJsonString(nullPaddedRaw);
  assert(!nullPaddedCleaned.includes('\0'), 'cleanJsonString must strip null bytes');
  assert(isValidJsonObject(nullPaddedCleaned), 'Cleaned null-padded string must be valid JSON object');
  assertEquals(JSON.parse(nullPaddedCleaned).metadata.padded, true, 'Parsed payload after null byte stripping matches');

  // 9c: Non-truncating filesystem write trailing garbage recovery
  const untruncatedRaw = '{"metadata":{"fresh":true},"customers":[],"transactions":{}}\n  "oldPreviousData": 9999\n}';
  const untruncatedCleaned = cleanJsonString(untruncatedRaw);
  assert(isValidJsonObject(untruncatedCleaned), 'cleanJsonString must recover balanced root object from untruncated file');
  assertEquals(JSON.parse(untruncatedCleaned).metadata.fresh, true, 'Recovered root payload preserves fresh data');

  // 9d: Rejection of HTTP error strings and invalid candidates
  assert(!isValidJsonObject(''), 'Empty string is not valid JSON');
  assert(!isValidJsonObject('Not Found'), 'HTTP error text "Not Found" is not valid JSON');
  assert(!isValidJsonObject('<html>Error 404</html>'), 'HTML error response is not valid JSON');
  assert(!isValidJsonObject('[]'), 'Array is not a valid ledger payload root object');

  // 9e: Content URI scheme prioritizes nativeFsReader
  let nativeFsReaderCalled = false;
  const mockContentUri = 'content://com.android.externalstorage.documents/tree/primary:GWD%20backup/document/test.json';
  const contentResult = await readTextFromFileUri(
    mockContentUri,
    undefined,
    async (uri: string) => {
      nativeFsReaderCalled = true;
      assertEquals(uri, mockContentUri, 'nativeFsReader called with exact content URI');
      return '\uFEFF{"metadata":{"saf":true},"customers":[],"transactions":{}}\0';
    }
  );
  assert(nativeFsReaderCalled, 'content:// URI must invoke nativeFsReader directly');
  assertEquals(JSON.parse(contentResult).metadata.saf, true, 'SAF reader output cleanly sanitized and parsed');

  console.log('\nAll Ledger Backup & Cryptographic Checksum Tests Passed Successfully!\n');
}

runAllBackupEngineTests();




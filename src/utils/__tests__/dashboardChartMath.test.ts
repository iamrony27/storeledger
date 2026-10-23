import {
  generateSmoothSplinePath,
  generateClosedAreaPath,
  calculateChartScale,
  aggregateLastNDays,
  formatChartAxisTick,
} from '../chartCurveMath';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('Running Dashboard Chart Curve Math & Aggregation Tests...\n');

// 1. Spline Curve Generation
console.log('1. Testing Smooth Bézier Spline Path Generation...');
const singlePoint = [{ x: 10, y: 50 }];
assert(generateSmoothSplinePath(singlePoint) === 'M 10,50', 'Single point path should be M 10,50');

const twoPoints = [{ x: 10, y: 50 }, { x: 50, y: 80 }];
assert(generateSmoothSplinePath(twoPoints) === 'M 10,50 L 50,80', 'Two points path should be linear M... L...');

const multiPoints = [
  { x: 10, y: 50 },
  { x: 30, y: 20 },
  { x: 60, y: 70 },
  { x: 90, y: 15 },
];
const curvePath = generateSmoothSplinePath(multiPoints);
assert(curvePath.startsWith('M 10.0,50.0 C'), 'Curve path must start with M and use cubic bezier C commands');
assert(curvePath.includes('90.0,15.0'), 'Curve path must end on the final point coordinates');

// 2. Closed Area Path
console.log('2. Testing Closed Area Path for Gradients...');
const areaPath = generateClosedAreaPath(multiPoints, 120);
assert(areaPath.includes('L 90.0,120.0 L 10.0,120.0 Z'), 'Closed area path must close down to baseline Y and Z');

// 3. Chart Scale Calculation
console.log('3. Testing Chart Scale & Value Normalization...');
const { maxVal, scaleY } = calculateChartScale([500000, 250000], 180, 20, 30);
assert(maxVal === 500000, 'maxVal should match highest value');
const topY = scaleY(500000);
const bottomY = scaleY(0);
assert(topY === 20, `Top value should land on paddingTop (got ${topY})`);
assert(bottomY === 150, `Zero value should land on innerHeight bottom (got ${bottomY})`);

// 4. Aggregation Invariants
console.log('4. Testing Last N Days Aggregation...');
const refDate = new Date('2026-10-23T12:00:00Z');
const mockTx = [
  { amountPaise: 240000, type: 'GAVE' as const, date: '2026-10-23T08:00:00Z' },
  { amountPaise: 510000, type: 'GOT' as const, date: '2026-10-23T10:00:00Z' },
  { amountPaise: 150000, type: 'GAVE' as const, date: '2026-10-22T08:00:00Z' },
  { amountPaise: 990000, type: 'GAVE' as const, date: '2026-10-23T09:00:00Z', isVoided: true }, // should ignore voided
];

const days7 = aggregateLastNDays(mockTx, 7, refDate);
assert(days7.length === 7, 'Should produce exactly 7 daily points');
const todayPoint = days7[6];
assert(todayPoint.shortLabel === 'Today', 'Last item in 7-day should have shortLabel Today');
assert(todayPoint.gavePaise === 240000, `Today gavePaise should exclude voided (expected 240000, got ${todayPoint.gavePaise})`);
assert(todayPoint.gotPaise === 510000, `Today gotPaise should be 510000 (got ${todayPoint.gotPaise})`);
assert(todayPoint.netPaise === 270000, `Today netPaise should be 270000 (got ${todayPoint.netPaise})`);

// 5. Chart Y-Axis Tick Formatting & Non-Duplication (Prevents '1k above 1k' bug)
console.log('5. Testing Chart Y-Axis Tick Formatting & Non-Duplication...');
assert(formatChartAxisTick(0, '₹') === '0', '0 paise should format as "0"');
assert(formatChartAxisTick(50000, '₹') === '₹500', '50,000 paise (₹500) must format as ₹500, never as ₹1k');
assert(formatChartAxisTick(100000, '₹') === '₹1k', '100,000 paise (₹1,000) formats as ₹1k');
assert(formatChartAxisTick(25000, '₹') === '₹250', '25,000 paise formats as ₹250');
assert(formatChartAxisTick(150000, '₹') === '₹1.5k', '150,000 paise formats as ₹1.5k');
assert(formatChartAxisTick(200000, '₹') === '₹2k', '200,000 paise formats as ₹2k');
assert(formatChartAxisTick(250000, '₹') === '₹2.5k', '250,000 paise formats as ₹2.5k');
assert(formatChartAxisTick(1000000, '₹') === '₹10k', '1,000,000 paise formats as ₹10k');
assert(formatChartAxisTick(10000000, '₹') === '₹100k', '10,000,000 paise formats as ₹100k');
assert(formatChartAxisTick(150000000, '₹') === '₹1.5M', '150,000,000 paise formats as ₹1.5M');
assert(formatChartAxisTick(50000, '$') === '$500', 'USD 50,000 cents ($500) formats as $500');
assert(formatChartAxisTick(100000, '$') === '$1k', 'USD 100,000 cents ($1,000) formats as $1k');

// Verify that for any standard scale (e.g. maxVal = 100000), tick(0.5) is strictly distinct from tick(1.0)
const testCeilings = [100000, 150000, 200000, 300000, 500000, 1000000, 5000000];
for (const ceil of testCeilings) {
  const midLabel = formatChartAxisTick(ceil * 0.5, '₹');
  const topLabel = formatChartAxisTick(ceil, '₹');
  assert(
    midLabel !== topLabel,
    `Middle tick (${midLabel}) and top tick (${topLabel}) must never be identical for ceiling ${ceil}`
  );
}

console.log('\nAll Dashboard Chart Curve Math & Aggregation Tests Passed Successfully! ✨\n');

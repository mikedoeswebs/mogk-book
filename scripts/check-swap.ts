// Run: node --experimental-strip-types scripts/check-swap.ts
import assert from 'node:assert/strict';
import { sessionsClash, swapAmounts } from '../lib/booking/swap.ts';

const s = (id: string, start: string, end: string, date = '2026-12-05') =>
  ({ id, date, start_time: start, end_time: end });

assert.ok(sessionsClash(s('a', '10:00:00', '11:00:00'), s('b', '10:30:00', '11:30:00')));
assert.ok(!sessionsClash(s('a', '10:00:00', '11:00:00'), s('b', '11:00:00', '12:00:00')), 'back to back');
assert.ok(!sessionsClash(s('a', '10:00:00', '11:00:00'), s('a', '10:00:00', '11:00:00')), 'same session');
assert.ok(!sessionsClash(s('a', '10:00:00', '11:00:00'), s('b', '10:00:00', '11:00:00', '2026-12-06')), 'other day');

// £12.39 paid by card (39p fee) into another £12 session: fully covered.
assert.deepEqual(swapAmounts({ amount_pence: 1239, booking_fee_pence: 39, credit_applied_pence: 0 }, 1200, 500),
  { swapCredit: 1200, balanceCredit: 0, card: 0, surplus: 0 });
// Dearer session: balance tops up first, then card.
assert.deepEqual(swapAmounts({ amount_pence: 1239, booking_fee_pence: 39, credit_applied_pence: 0 }, 1500, 100),
  { swapCredit: 1200, balanceCredit: 100, card: 200, surplus: 0 });
// Cheaper session: the difference stays as credit.
assert.deepEqual(swapAmounts({ amount_pence: 0, booking_fee_pence: 0, credit_applied_pence: 1500 }, 1200, 0),
  { swapCredit: 1200, balanceCredit: 0, card: 0, surplus: 300 });

console.log('swap checks passed');

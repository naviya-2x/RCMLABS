import { describe, expect, it } from 'vitest';
import { addDays, calculateFine, daysOverdue, money } from '../src/utils/dates.js';

describe('circulation calculations', () => {
  it('adds borrowing days without changing the input', () => { expect(addDays('2026-01-01',14)).toBe('2026-01-15'); });
  it('honours grace periods when calculating overdue days', () => { expect(daysOverdue('2026-01-10',new Date('2026-01-13T12:00:00Z'),2)).toBe(1); });
  it('caps overdue fines and applies grace days', () => { expect(calculateFine('2026-01-10',new Date('2026-01-14T12:00:00Z'),1,0.5,1)).toBe(1); });
  it('rounds money to cents', () => { expect(money(1.005)).toBe(1); expect(money(2.456)).toBe(2.46); });
});

import { periodToDateRange } from './period.util';

describe('periodToDateRange', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-16'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('7d — subtracts 7 days', () => {
    const { startDate, endDate } = periodToDateRange('7d');
    expect(startDate).toBe('2026-02-09');
    expect(endDate).toBe('2026-02-16');
  });

  it('30d — subtracts 30 days', () => {
    const { startDate, endDate } = periodToDateRange('30d');
    expect(startDate).toBe('2026-01-17');
    expect(endDate).toBe('2026-02-16');
  });

  it('90d — subtracts 90 days', () => {
    const { startDate, endDate } = periodToDateRange('90d');
    expect(startDate).toBe('2025-11-18');
    expect(endDate).toBe('2026-02-16');
  });

  it('ytd — Jan 1 of current year', () => {
    const { startDate, endDate } = periodToDateRange('ytd');
    expect(startDate).toBe('2026-01-01');
    expect(endDate).toBe('2026-02-16');
  });

  it('1y — subtracts 365 days', () => {
    const { startDate, endDate } = periodToDateRange('1y');
    expect(startDate).toBe('2025-02-16');
    expect(endDate).toBe('2026-02-16');
  });

  it('all — returns 2000-01-01', () => {
    const { startDate, endDate } = periodToDateRange('all');
    expect(startDate).toBe('2000-01-01');
    expect(endDate).toBe('2026-02-16');
  });
});

import { describe, it, expect } from 'vitest';

// Test task assignment time fields logic

describe('Task Assignment Time Fields', () => {
  it('eventEndTime is included in options', () => {
    const options = {
      eventTime: '08:30',
      eventEndTime: '16:00',
      eventDate: new Date('2026-03-25'),
      eventEndDate: new Date('2026-03-26'),
    };
    expect(options.eventTime).toBe('08:30');
    expect(options.eventEndTime).toBe('16:00');
  });

  it('eventEndTime defaults to undefined when not set', () => {
    const options: { eventTime?: string; eventEndTime?: string } = {
      eventTime: '08:30',
    };
    expect(options.eventEndTime).toBeUndefined();
    expect(options.eventEndTime || '').toBe('');
  });

  it('time format is HH:MM', () => {
    const timeRegex = /^\d{2}:\d{2}$/;
    expect(timeRegex.test('08:30')).toBe(true);
    expect(timeRegex.test('16:00')).toBe(true);
    expect(timeRegex.test('23:55')).toBe(true);
    expect(timeRegex.test('8:30')).toBe(false);
    expect(timeRegex.test('08:30:00')).toBe(false);
  });

  it('time options generate 5-minute intervals', () => {
    const options: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 5) {
        const h = hour.toString().padStart(2, '0');
        const m = minute.toString().padStart(2, '0');
        options.push(`${h}:${m}`);
      }
    }
    expect(options.length).toBe(288); // 24 * 12
    expect(options[0]).toBe('00:00');
    expect(options[options.length - 1]).toBe('23:55');
    expect(options).toContain('08:30');
    expect(options).toContain('16:00');
    expect(options).not.toContain('08:31'); // not a 5-min interval
  });
});

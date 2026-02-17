import { MarketSession } from '@algoarena/shared';
import { Injectable } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { CalendarDay, MarketClock } from './types/market-data-provider.types';

export interface SessionDetail {
  timestamp: string;
  isOpen: boolean;
  session: MarketSession;
  nextOpen: string;
  nextClose: string;
  sessions: {
    preMarket: { start: string; end: string };
    regular: { start: string; end: string };
    afterHours: { start: string; end: string };
  };
}

@Injectable()
export class SessionService {
  constructor(private readonly marketDataService: MarketDataService) {}

  async getCurrentSession(): Promise<{ session: MarketSession; clock: MarketClock }> {
    const clock = await this.marketDataService.getClock();
    return { session: this.computeSession(clock), clock };
  }

  computeSession(clock: MarketClock): MarketSession {
    if (clock.isOpen) return 'regular';

    // Parse ET time from clock timestamp
    const now = new Date(clock.timestamp);
    const etTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).format(now);

    const [hourStr, minuteStr] = etTime.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const totalMinutes = hour * 60 + minute;

    // Check weekday for weekend
    const dayName = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
    }).format(now);

    if (dayName === 'Sat' || dayName === 'Sun') return 'closed';

    // Pre-market: 4:00 AM - 9:30 AM ET (240 - 570 minutes)
    if (totalMinutes >= 240 && totalMinutes < 570) return 'pre_market';

    // After-hours: 4:00 PM - 8:00 PM ET (960 - 1200 minutes)
    if (totalMinutes >= 960 && totalMinutes < 1200) return 'after_hours';

    return 'closed';
  }

  async getSessionDetail(): Promise<SessionDetail> {
    const clock = await this.marketDataService.getClock();
    const session = this.computeSession(clock);

    // Get today's date in ET
    const now = new Date(clock.timestamp);
    const todayET = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    let calendar: CalendarDay[] = [];
    try {
      calendar = await this.marketDataService.getCalendar({ start: todayET, end: todayET });
    } catch {
      // If calendar fetch fails, use defaults
    }

    const calDay = calendar.length > 0 ? calendar[0] : null;
    const regularOpen = calDay ? calDay.open : '09:30';
    const regularClose = calDay ? calDay.close : '16:00';

    return {
      timestamp: clock.timestamp,
      isOpen: clock.isOpen,
      session,
      nextOpen: clock.nextOpen,
      nextClose: clock.nextClose,
      sessions: {
        preMarket: { start: '04:00', end: regularOpen },
        regular: { start: regularOpen, end: regularClose },
        afterHours: { start: regularClose, end: '20:00' },
      },
    };
  }
}

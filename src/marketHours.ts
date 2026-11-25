export interface MarketSchedule {
  openHour: number;
  openMinute: number;
  closeHour: number;
  closeMinute: number;
}

// London Stock Exchange (LSE) standard hours: 08:00 - 16:30 UTC
export const DEFAULT_LSE_SCHEDULE: MarketSchedule = {
  openHour: 8,
  openMinute: 0,
  closeHour: 16,
  closeMinute: 30,
};

export function isMarketOpen(date: Date, schedule: MarketSchedule = DEFAULT_LSE_SCHEDULE): boolean {
  // Sunday = 0, Saturday = 6
  const day = date.getUTCDay();
  if (day === 0 || day === 6) {
    return false;
  }

  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const currentTotalMinutes = hours * 60 + minutes;

  const openTotalMinutes = schedule.openHour * 60 + schedule.openMinute;
  const closeTotalMinutes = schedule.closeHour * 60 + schedule.closeMinute;

  return currentTotalMinutes >= openTotalMinutes && currentTotalMinutes < closeTotalMinutes;
}

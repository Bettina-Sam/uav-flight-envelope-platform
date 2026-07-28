/** Convert decimal hours to an unambiguous aviation-style HH:MM duration. */
export function formatDurationHHMM(decimalHours: number): string {
  if (!Number.isFinite(decimalHours) || decimalHours < 0) return '--:--';
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function formatDurationLong(decimalHours: number): string {
  if (!Number.isFinite(decimalHours) || decimalHours < 0) return 'unavailable';
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} minutes`;
  if (!minutes) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${minutes} minutes`;
}

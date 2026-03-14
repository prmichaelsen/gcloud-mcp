export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(m|h|d)$/);
  if (!match) throw new Error(`Invalid duration format: ${duration}. Use e.g. "30m", "1h", "2d".`);
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * multipliers[unit];
}

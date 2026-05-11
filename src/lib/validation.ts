import { AppError } from "@/lib/errors";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function parseDate(value?: string) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return startOfDay(parsed);
}

export function normalizeDateRange(startInput?: string, endInput?: string) {
  const today = startOfDay(new Date());
  const maxDate = addDays(today, 4);

  const start = parseDate(startInput) ?? today;
  const end = parseDate(endInput) ?? start;

  if (start < today) {
    throw new AppError("Start date must be today or later.", 400);
  }

  if (end > maxDate) {
    throw new AppError("Date range must be within the next 5 days.", 400);
  }

  if (end < start) {
    throw new AppError("End date must be the same or after start date.", 400);
  }

  return { startDate: start, endDate: end };
}

export function parseCoordinate(value: unknown) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

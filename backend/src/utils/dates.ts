export const addDays = (date: Date | string, days: number) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
};

export const daysOverdue = (dueDate: Date | string, asOf = new Date(), gracePeriod = 0) => {
  const due = new Date(`${String(dueDate).slice(0, 10)}T00:00:00Z`);
  const today = new Date(asOf);
  const effective = new Date(due);
  effective.setUTCDate(effective.getUTCDate() + gracePeriod);
  return Math.max(0, Math.floor((Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - effective.getTime()) / 86_400_000));
};

export const money = (value: unknown) => Number(Number(value || 0).toFixed(2));
export const calculateFine = (dueDate: Date | string, asOf: Date, gracePeriod: number, finePerDay: number, maxFine: number) => money(Math.min(daysOverdue(dueDate, asOf, gracePeriod) * finePerDay, maxFine));

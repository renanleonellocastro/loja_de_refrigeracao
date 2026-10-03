const dateTime = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const time = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
});

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** "terça-feira, 07/10, 09:00" in São Paulo time, for emails and messages. */
export function formatDateTime(date: Date): string {
  return dateTime.format(date);
}

/** "09:00 às 11:00" in São Paulo time. */
export function formatTimeRange(start: Date, end: Date): string {
  return `${time.format(start)} às ${time.format(end)}`;
}

/** 123456 cents -> "R$ 1.234,56" (with a regular space). */
export function formatMoney(cents: number): string {
  return money.format(cents / 100).replace(/\s/g, ' ');
}

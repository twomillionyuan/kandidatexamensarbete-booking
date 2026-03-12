const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function ordinal(day) {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;

  const mod10 = day % 10;
  if (mod10 === 1) return `${day}st`;
  if (mod10 === 2) return `${day}nd`;
  if (mod10 === 3) return `${day}rd`;
  return `${day}th`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatClock(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();

  if (minutes === 0) {
    return String(hours);
  }

  return `${hours}:${pad(minutes)}`;
}

function formatDatePart(date) {
  return `${ordinal(date.getDate())} ${MONTH_NAMES[date.getMonth()]}`;
}

export function formatSlotLabel(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Invalid date';
  }

  const sameDay = start.toDateString() === end.toDateString();

  if (sameDay) {
    return `${formatDatePart(start)} ${formatClock(start)}-${formatClock(end)}`;
  }

  return `${formatDatePart(start)} ${formatClock(start)} - ${formatDatePart(end)} ${formatClock(end)}`;
}

export function formatDateTimeLabel(isoValue) {
  const date = new Date(isoValue);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return `${formatDatePart(date)} ${formatClock(date)}`;
}

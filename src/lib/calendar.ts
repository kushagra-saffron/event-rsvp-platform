function formatIcsDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildGoogleCalendarUrl(params: {
  title: string;
  details?: string;
  start: Date;
  end: Date;
  timezone?: string;
}): string {
  const formatLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      "T" +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      pad(d.getSeconds())
    );
  };
  const dates = `${formatLocal(params.start)}/${formatLocal(params.end)}`;
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: params.title,
    dates,
    details: params.details ?? "",
    ctz: params.timezone ?? "Asia/Kolkata",
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function buildIcsDataUrl(params: {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  url?: string;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MoneyStage//EN",
    "BEGIN:VEVENT",
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(params.start)}`,
    `DTEND:${formatIcsDate(params.end)}`,
    `SUMMARY:${escapeIcsText(params.title)}`,
  ];
  if (params.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(params.description)}`);
  }
  if (params.url) {
    lines.push(`URL:${params.url}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  const ics = lines.join("\r\n");
  return `data:text/calendar;charset=utf8,${encodeURIComponent(ics)}`;
}

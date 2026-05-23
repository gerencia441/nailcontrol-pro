const BOGOTA_UTC_OFFSET_HOURS = 5;

function parseDateParts(value) {
  const match = String(value || '').match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] || 0),
    minute: Number(match[5] || 0),
    second: Number(match[6] || 0),
  };
}

function bogotaDateTimeToUtc(value) {
  const parts = parseDateParts(value);

  if (!parts) {
    return new Date(value);
  }

  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour + BOGOTA_UTC_OFFSET_HOURS,
      parts.minute,
      parts.second,
      0
    )
  );
}

function bogotaDayRangeToUtc(value) {
  const parts = parseDateParts(value);

  if (!parts) {
    const start = new Date(value);
    start.setUTCHours(5, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  const start = bogotaDateTimeToUtc(
    `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T00:00`
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

module.exports = {
  bogotaDateTimeToUtc,
  bogotaDayRangeToUtc,
};

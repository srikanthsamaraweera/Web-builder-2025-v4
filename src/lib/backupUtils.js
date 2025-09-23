const sanitizeHeader = (header) => header.replace(/[^A-Za-z0-9_-]/g, "_");

const padNumber = (value) => value.toString().padStart(2, "0");

const formatTimestamp = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${padNumber(date.getUTCMonth() + 1)}-${padNumber(date.getUTCDate())} ${padNumber(date.getUTCHours())}:${padNumber(date.getUTCMinutes())}:${padNumber(date.getUTCSeconds())}`;
};

const isLikelyDateTime = (value) =>
  typeof value === "string" &&
  /\d{4}-\d{2}-\d{2}/.test(value) &&
  /\d{2}:\d{2}:\d{2}/.test(value) &&
  !Number.isNaN(Date.parse(value));

const normalizeValueForCsv = (value) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return formatTimestamp(value);
  if (typeof value === "string") {
    if (isLikelyDateTime(value)) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return formatTimestamp(parsed);
    }
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const escapeCsvValue = (value) => {
  const normalized = normalizeValueForCsv(value);
  if (normalized === "") return "";
  if (/[",\n\r]/.test(normalized)) {
    return '"' + normalized.replace(/"/g, '""') + '"';
  }
  return normalized;
};

const buildHeaderMapping = (headers) => {
  const seen = new Map();
  return headers.map((header) => {
    let base = sanitizeHeader(header);
    if (!base) base = "column";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const sanitized = count === 0 ? base : `${base}_${count + 1}`;
    return { original: header, sanitized };
  });
};

const gatherHeadersFromRows = (rows) => {
  const headerSet = new Set();
  rows.forEach((row) => {
    if (!row || typeof row !== "object") return;
    Object.keys(row).forEach((key) => headerSet.add(key));
  });
  return Array.from(headerSet);
};

const buildCsvFromRows = (rows, headers) => {
  const headerMapping = buildHeaderMapping(headers);
  const csvLines = [headerMapping.map((item) => item.sanitized).join(",")];
  rows.forEach((row) => {
    const line = headerMapping
      .map(({ original }) => escapeCsvValue(row?.[original]))
      .join(",");
    csvLines.push(line);
  });
  return csvLines.join("\n");
};

const getTimestampSuffix = (date) =>
  `${date.getUTCFullYear()}${padNumber(date.getUTCMonth() + 1)}${padNumber(date.getUTCDate())}-${padNumber(date.getUTCHours())}${padNumber(date.getUTCMinutes())}${padNumber(date.getUTCSeconds())}`;

export {
  buildCsvFromRows,
  buildHeaderMapping,
  escapeCsvValue,
  formatTimestamp,
  gatherHeadersFromRows,
  getTimestampSuffix,
  isLikelyDateTime,
  normalizeValueForCsv,
  sanitizeHeader,
};

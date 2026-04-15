const POSITION_KEYS = ["RunnerPosition", "FinishPosition", "Position", "Pos"];
const NAME_KEYS = ["Name"];
const FIRST_NAME_KEYS = ["Firstname", "FirstName"];
const SURNAME_KEYS = ["Surname", "LastName"];
const CLUB_KEYS = ["Club"];
const CATEGORY_KEYS = ["RunnerCategory", "Category", "Cat"];
const TIME_KEYS = ["FinishTime", "Time"];
const ALLOWED_RUNNER_CATEGORIES = new Set(
  "F,F40,F50,F60,F65,F70,F75,F80,M,M40,M50,M60,M65,M70,M75,M80,NB,NB40,NB50,NB60,NB65,NB70,NB75,NB80"
    .split(",")
    .map((category) => category.trim())
);

export type CsvIssue = {
  row: number | null;
  level: "error" | "warning";
  message: string;
};

export function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [] as string[], rows: [] as Record<string, string>[] };
  }

  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {});
  });

  return { headers, rows };
}

function findValue(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function validateTime(time: string) {
  return /(\d?\d)[:.h](\d\d)(?:[:.m](\d\d))?/i.test(time);
}

export function validateRaceResultsCsv(csvText: string): CsvIssue[] {
  const issues: CsvIssue[] = [];
  const { headers, rows } = parseCsv(csvText);

  if (headers.length === 0) {
    return [
      {
        row: null,
        level: "error",
        message: "CSV content is empty.",
      },
    ];
  }

  const headerSet = new Set(headers);
  const hasPosition = POSITION_KEYS.some((key) => headerSet.has(key));
  const hasName =
    NAME_KEYS.some((key) => headerSet.has(key)) ||
    (FIRST_NAME_KEYS.some((key) => headerSet.has(key)) &&
      SURNAME_KEYS.some((key) => headerSet.has(key)));
  const hasTime = TIME_KEYS.some((key) => headerSet.has(key));

  if (!hasPosition) {
    issues.push({
      row: null,
      level: "error",
      message: `Missing position column (expected one of: ${POSITION_KEYS.join(", ")})`,
    });
  }

  if (!hasName) {
    issues.push({
      row: null,
      level: "error",
      message: "Missing name columns (expected Name or Firstname+Surname variants)",
    });
  }

  if (!hasTime) {
    issues.push({
      row: null,
      level: "error",
      message: `Missing time column (expected one of: ${TIME_KEYS.join(", ")})`,
    });
  }

  if (!CLUB_KEYS.some((key) => headerSet.has(key))) {
    issues.push({
      row: null,
      level: "warning",
      message: `Missing club column (expected: ${CLUB_KEYS.join(", ")})`,
    });
  }

  if (!CATEGORY_KEYS.some((key) => headerSet.has(key))) {
    issues.push({
      row: null,
      level: "warning",
      message: `Missing category column (expected one of: ${CATEGORY_KEYS.join(", ")})`,
    });
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const position = findValue(row, POSITION_KEYS);
    const name =
      findValue(row, NAME_KEYS) ||
      `${findValue(row, FIRST_NAME_KEYS)} ${findValue(row, SURNAME_KEYS)}`.trim();
    const time = findValue(row, TIME_KEYS);
    const category = findValue(row, CATEGORY_KEYS);

    if (!position || Number.isNaN(Number.parseInt(position, 10))) {
      issues.push({
        row: rowNumber,
        level: "error",
        message: `Invalid position '${position || "<empty>"}'`,
      });
    }

    if (!name) {
      issues.push({
        row: rowNumber,
        level: "error",
        message: "Missing runner name",
      });
    }

    if (!time) {
      issues.push({
        row: rowNumber,
        level: "error",
        message: "Missing time",
      });
    } else if (!validateTime(time)) {
      issues.push({
        row: rowNumber,
        level: "warning",
        message: `Unrecognized time format '${time}'`,
      });
    }

    if (!category) {
      issues.push({
        row: rowNumber,
        level: "warning",
        message: "Missing runner category",
      });
    } else if (!ALLOWED_RUNNER_CATEGORIES.has(category)) {
      issues.push({
        row: rowNumber,
        level: "warning",
        message: `Unexpected runner category '${category}'`,
      });
    }
  });

  return issues;
}

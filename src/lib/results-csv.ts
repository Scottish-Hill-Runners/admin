const POSITION_KEYS = ["RunnerPosition", "FinishPosition", "Position", "Pos"];
const NAME_KEYS = ["Name"];
const FIRST_NAME_KEYS = ["Firstname", "FirstName"];
const SURNAME_KEYS = ["Surname", "LastName"];
const CLUB_KEYS = ["Club"];
const CATEGORY_KEYS = ["RunnerCategory", "Category", "Cat"];
const TIME_KEYS = ["FinishTime", "Time"];
const RUNNER_CATEGORY_PATTERN = /^(M|F|A|NB?)\d{0,2}$/;

export type CsvIssue = {
  row: number | null;
  level: "error" | "warning" | "note";
  message: string;
};

export type RaceWinnerSummary = {
  name: string;
  club: string;
  time: string;
};

export type RaceResultsWinnerSummary = {
  male: RaceWinnerSummary | null;
  female: RaceWinnerSummary | null;
  nonBinary: RaceWinnerSummary | null;
  nEntrants: number;
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

function parseTimeToSeconds(time: string): number | null {
  const match = /^(\d{1,2})[:.h](\d{2})(?:[:.m](\d{2}))?$/i.exec(time.trim());
  if (!match) {
    return null;
  }
  const a = Number.parseInt(match[1], 10);
  const b = Number.parseInt(match[2], 10);
  const c = match[3] !== undefined ? Number.parseInt(match[3], 10) : null;
  return c !== null ? a * 3600 + b * 60 + c : a * 60 + b;
}

function parseCategoryGroup(category: string): "male" | "female" | "nonBinary" | null {
  const normalized = category.trim().toUpperCase();

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("NB") || normalized === "N" || normalized === "A") {
    return "nonBinary";
  }

  if (normalized.startsWith("M")) {
    return "male";
  }

  if (normalized.startsWith("F")) {
    return "female";
  }

  return null;
}

type WinnerCandidate = RaceWinnerSummary & {
  position: number;
};

function toWinnerSummary(candidate: WinnerCandidate | null): RaceWinnerSummary | null {
  if (!candidate) {
    return null;
  }

  return {
    name: candidate.name,
    club: candidate.club,
    time: candidate.time,
  };
}

export function extractRaceResultsWinnerSummary(csvText: string): RaceResultsWinnerSummary {
  const { rows } = parseCsv(csvText);

  let maleWinner: WinnerCandidate | null = null;
  let femaleWinner: WinnerCandidate | null = null;
  let nonBinaryWinner: WinnerCandidate | null = null;

  for (const row of rows) {
    const positionRaw = findValue(row, POSITION_KEYS);
    const position = Number.parseInt(positionRaw, 10);
    if (!Number.isFinite(position)) {
      continue;
    }

    const name =
      findValue(row, NAME_KEYS) ||
      `${findValue(row, FIRST_NAME_KEYS)} ${findValue(row, SURNAME_KEYS)}`.trim();
    const time = findValue(row, TIME_KEYS);
    if (!name || !time) {
      continue;
    }

    const candidate: WinnerCandidate = {
      position,
      name,
      club: findValue(row, CLUB_KEYS),
      time,
    };

    const categoryGroup = parseCategoryGroup(findValue(row, CATEGORY_KEYS));
    if (!categoryGroup) {
      continue;
    }

    if (categoryGroup === "male" && (!maleWinner || candidate.position < maleWinner.position)) {
      maleWinner = candidate;
      continue;
    }

    if (categoryGroup === "female" && (!femaleWinner || candidate.position < femaleWinner.position)) {
      femaleWinner = candidate;
      continue;
    }

    if (
      categoryGroup === "nonBinary" &&
      (!nonBinaryWinner || candidate.position < nonBinaryWinner.position)
    ) {
      nonBinaryWinner = candidate;
    }
  }

  return {
    male: toWinnerSummary(maleWinner),
    female: toWinnerSummary(femaleWinner),
    nonBinary: toWinnerSummary(nonBinaryWinner),
    nEntrants: rows.length,
  };
}

export function validateRaceResultsCsv(
  csvText: string,
  options?: { knownClubNames?: ReadonlySet<string> }
): CsvIssue[] {
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

  const knownClubNames = options?.knownClubNames;

  let prevPosition: number | null = null;
  let prevTimeSeconds: number | null = null;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const position = findValue(row, POSITION_KEYS);
    const name =
      findValue(row, NAME_KEYS) ||
      `${findValue(row, FIRST_NAME_KEYS)} ${findValue(row, SURNAME_KEYS)}`.trim();
    const time = findValue(row, TIME_KEYS);
    const category = findValue(row, CATEGORY_KEYS);
    const club = findValue(row, CLUB_KEYS);

    const parsedPosition = position ? Number.parseInt(position, 10) : NaN;

    if (!position || Number.isNaN(parsedPosition)) {
      issues.push({
        row: rowNumber,
        level: "error",
        message: `Invalid position '${position || "<empty>"}'`,
      });
    } else {
      if (prevPosition !== null && parsedPosition < prevPosition) {
        issues.push({
          row: rowNumber,
          level: "warning",
          message: `Position ${parsedPosition} is less than previous position ${prevPosition} — rows may be out of order`,
        });
      }
      prevPosition = parsedPosition;
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
    } else {
      const timeSeconds = parseTimeToSeconds(time);
      if (timeSeconds !== null) {
        if (prevTimeSeconds !== null && timeSeconds < prevTimeSeconds) {
          issues.push({
            row: rowNumber,
            level: "warning",
            message: `Time '${time}' is earlier than the previous row's time — rows may be out of order`,
          });
        }
        prevTimeSeconds = timeSeconds;
      }
    }

    if (!category) {
      issues.push({
        row: rowNumber,
        level: "warning",
        message: "Missing runner category",
      });
    } else if (!RUNNER_CATEGORY_PATTERN.test(category)) {
      issues.push({
        row: rowNumber,
        level: "warning",
        message: `Unexpected runner category '${category}' (expected pattern: M, F, A or NB followed by optional digits, e.g. M40, F, NB50)`,
      });
    }

    if (knownClubNames && club && club.toLowerCase() !== "unattached" && !knownClubNames.has(club.toLowerCase())) {
      issues.push({
        row: rowNumber,
        level: "note",
        message: `Club '${club}' not found in club list`,
      });
    }
  });

  return issues;
}

const POSITION_KEYS = ["RunnerPosition", "FinishPosition", "Position", "Pos"];
const NAME_KEYS = ["Name"];
const FIRST_NAME_KEYS = ["Firstname", "FirstName"];
const SURNAME_KEYS = ["Surname", "LastName"];
const CLUB_KEYS = ["Club"];
const CATEGORY_KEYS = ["RunnerCategory", "Category", "Cat"];
const TIME_KEYS = ["FinishTime", "Time"];
const RUNNER_CATEGORY_PATTERN = /^(M|F|A|NB?)\d{0,2}$/;

const HEADER_ALIAS_GROUPS = [
  {
    canonical: "RunnerPosition",
    aliases: [
      "RunnerPosition",
      "FinishPosition",
      "Position",
      "Pos",
      "Place",
      "Rank",
    ],
  },
  {
    canonical: "Name",
    aliases: ["Name", "Runner", "RunnerName", "Athlete"],
  },
  {
    canonical: "Firstname",
    aliases: ["Firstname", "FirstName", "First Name", "GivenName", "Given Name"],
  },
  {
    canonical: "Surname",
    aliases: ["Surname", "LastName", "Last Name", "FamilyName", "Family Name"],
  },
  {
    canonical: "Club",
    aliases: ["Club", "Team"],
  },
  {
    canonical: "RunnerCategory",
    aliases: ["RunnerCategory", "Category", "Cat", "Class"],
  },
  {
    canonical: "FinishTime",
    aliases: ["FinishTime", "Time", "NetTime", "GunTime"],
  },
] as const;

const HEADER_ALIAS_LOOKUP = new Map<string, string>(
  HEADER_ALIAS_GROUPS.flatMap((group) =>
    group.aliases.map((alias) => [normalizeHeaderToken(alias), group.canonical] as const)
  )
);

export type CsvIssue = {
  row: number | null;
  level: "error" | "warning" | "note";
  message: string;
};

export type GenderGroup = "male" | "female" | "nonBinary";

export type Category = {
  label: string,
  group: GenderGroup;
  age: number;
};

export type RaceWinner = {
  name: string;
  club: string;
  time: string;
  position: number;
  category: Category;
  alsoWon: Set<Category>;
};

export type RaceWinners = {
  winners: RaceWinner[];
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

function serializeCsvLine(values: string[]): string {
  return values
    .map((value) => {
      if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
      }

      return value;
    })
    .join(",");
}

function normalizeHeaderToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeRaceResultsHeader(header: string): string {
  const normalizedToken = normalizeHeaderToken(header);
  return HEADER_ALIAS_LOOKUP.get(normalizedToken) ?? header.trim();
}

export function normalizeRaceResultsHeaders(headers: string[]): string[] {
  return headers.map((header) => normalizeRaceResultsHeader(header));
}

export function countRecognizedRaceResultsHeaders(headers: string[]): number {
  return headers.reduce((count, header) => {
    const normalizedToken = normalizeHeaderToken(header);
    return HEADER_ALIAS_LOOKUP.has(normalizedToken) ? count + 1 : count;
  }, 0);
}

export function normalizeRaceResultsCsvHeaders(csvText: string): string {
  const normalizedLines = csvText.replace(/\r\n?/g, "\n").split("\n");
  const headerLineIndex = normalizedLines.findIndex((line) => line.trim().length > 0);

  if (headerLineIndex < 0) {
    return csvText;
  }

  const rawHeaders = splitCsvLine(normalizedLines[headerLineIndex]);
  const canonicalHeaders = normalizeRaceResultsHeaders(rawHeaders);
  normalizedLines[headerLineIndex] = serializeCsvLine(canonicalHeaders);

  return normalizedLines.join("\n");
}

function parseCsv(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [] as string[], rows: [] as Record<string, string>[] };
  }

  const headers = normalizeRaceResultsHeaders(splitCsvLine(lines[0]));
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

function parseCategoryAge(category: string): number {
  const match = /(\d+)$/.exec(category.trim());
  return match ? Number.parseInt(match[1], 10) : DEFAULT_CATEGORY_AGE;
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

function parseGenderGroup(category: string): GenderGroup {
  const normalized = category.trim().toUpperCase() ?? "M";
  if (normalized.startsWith("N") || normalized.startsWith("A"))
    return "nonBinary";
  return normalized.startsWith("F") ? "female" : "male";
}

const DEFAULT_CATEGORY_AGE = 30;

function absorbs(existing: Category, candidate: Category): boolean {
  const canAbsorb = existing.group == candidate.group || (existing.group == "nonBinary" && candidate.group === "male");
  if (!canAbsorb) return false;
  if (candidate.age >= DEFAULT_CATEGORY_AGE)
    return existing.age > candidate.age;
  return existing.age < candidate.age;
}

export function extractRaceResultsWinnerSummary(csvText: string): RaceWinners {
  const { headers, rows } = parseCsv(csvText);

  const findKey = (keys: string[]) => headers.find((h) => keys.includes(h)) ?? keys[0];
  const positionIndex = findKey(POSITION_KEYS);
  const nameIndex = findKey(NAME_KEYS);
  const firstNameIndex = findKey(FIRST_NAME_KEYS);
  const surnameIndex = findKey(SURNAME_KEYS);
  const timeIndex = findKey(TIME_KEYS);
  const categoryIndex = findKey(CATEGORY_KEYS);
  const clubIndex = findKey(CLUB_KEYS);

  const winners: RaceWinner[] = [];
  const seenCategories = new Set<string>();

  for (const row of rows) {
    const cat = row[categoryIndex] ?? "M";
    if (seenCategories.has(cat))
      continue;
    seenCategories.add(cat);

    const category: Category = {
      "label": cat,
      "group": parseGenderGroup(cat),
      "age": parseCategoryAge(cat)
    };
    const positionRaw = row[positionIndex];
    const position = Number.parseInt(positionRaw, 10);
    if (!Number.isFinite(position)) continue;

    const name = row[nameIndex] ??
      `${row[firstNameIndex] ?? ""} ${row[surnameIndex] ?? ""}`.trim();
    const time = row[timeIndex];
    if (!name || !time) continue;

    const existing = winners.find((winner) => absorbs(winner.category, category));
    if (existing)
      existing.alsoWon.add(category);
    else
      winners.push({ name, club: row[clubIndex], time, position, category, alsoWon: new Set() });
  }

  return {winners, nEntrants: rows.length};
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

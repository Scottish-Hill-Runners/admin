import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import matter from "gray-matter";

const POSITION_KEYS = ["RunnerPosition", "FinishPosition", "Position", "Pos"];
const NAME_KEYS = ["Name"];
const FIRST_NAME_KEYS = ["Firstname", "FirstName"];
const SURNAME_KEYS = ["Surname", "LastName"];
const CLUB_KEYS = ["Club"];
const CATEGORY_KEYS = ["RunnerCategory", "Category", "Cat"];
const TIME_KEYS = ["FinishTime", "Time"];
const DEFAULT_CATEGORY_AGE = 30;

function splitCsvLine(line) {
  const values = [];
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

function parseCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {});
  });

  return { headers, rows };
}

function parseCategoryAge(category) {
  const match = /(\d+)$/.exec(String(category).trim());
  return match ? Number.parseInt(match[1], 10) : DEFAULT_CATEGORY_AGE;
}

function parseGenderGroup(category) {
  const normalized = String(category || "M").trim().toUpperCase();
  if (normalized.startsWith("N") || normalized.startsWith("A")) {
    return "nonBinary";
  }

  return normalized.startsWith("F") ? "female" : "male";
}

function absorbs(existing, candidate) {
  const canAbsorb =
    existing.group === candidate.group ||
    (existing.group === "nonBinary" && candidate.group === "male");

  if (!canAbsorb) {
    return false;
  }

  if (candidate.age >= DEFAULT_CATEGORY_AGE) {
    return existing.age > candidate.age;
  }

  return existing.age < candidate.age;
}

function extractRaceResultsWinnerSummary(csvText) {
  const { headers, rows } = parseCsv(csvText);

  const findKey = (keys) => headers.find((header) => keys.includes(header)) ?? keys[0];
  const positionIndex = findKey(POSITION_KEYS);
  const nameIndex = findKey(NAME_KEYS);
  const firstNameIndex = findKey(FIRST_NAME_KEYS);
  const surnameIndex = findKey(SURNAME_KEYS);
  const timeIndex = findKey(TIME_KEYS);
  const categoryIndex = findKey(CATEGORY_KEYS);
  const clubIndex = findKey(CLUB_KEYS);

  const winners = [];
  const seenCategories = new Set();

  for (const row of rows) {
    const cat = row[categoryIndex] ?? "M";
    if (seenCategories.has(cat)) {
      continue;
    }
    seenCategories.add(cat);

    const category = {
      label: cat,
      group: parseGenderGroup(cat),
      age: parseCategoryAge(cat),
    };

    const positionRaw = row[positionIndex];
    const position = Number.parseInt(positionRaw, 10);
    if (!Number.isFinite(position)) {
      continue;
    }

    const name = row[nameIndex] ?? `${row[firstNameIndex] ?? ""} ${row[surnameIndex] ?? ""}`.trim();
    const time = row[timeIndex];
    if (!name || !time) {
      continue;
    }

    const existing = winners.find((winner) => absorbs(winner.category, category));
    if (existing) {
      existing.alsoWon.add(category);
    } else {
      winners.push({
        name,
        club: row[clubIndex],
        time,
        position,
        category,
        alsoWon: new Set(),
      });
    }
  }

  return { winners, nEntrants: rows.length };
}

function printUsage() {
  console.error("Usage:");
  console.error("  node scripts/results-csv-to-news.mjs <raceId> <year> <csvPath> [date]");
  console.error("  node scripts/results-csv-to-news.mjs <csvPath> [date]");
  console.error("");
  console.error("Examples:");
  console.error("  node scripts/results-csv-to-news.mjs ArrocharAlps 2026 ../shr-contents/races/ArrocharAlps/2026.csv");
  console.error("  node scripts/results-csv-to-news.mjs ../ArrocharAlps/2026.csv");
}

function isLikelyCsvPath(value) {
  return value.toLowerCase().endsWith(".csv");
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function toOrdinal(day) {
  const remainder100 = day % 100;
  if (remainder100 >= 11 && remainder100 <= 13) {
    return `${day}th`;
  }

  const remainder10 = day % 10;
  if (remainder10 === 1) return `${day}st`;
  if (remainder10 === 2) return `${day}nd`;
  if (remainder10 === 3) return `${day}rd`;
  return `${day}th`;
}

function formatLeadDate(dateIso) {
  const parsed = new Date(`${dateIso}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return dateIso;
  }

  const weekday = parsed.toLocaleDateString("en-GB", {
    weekday: "long",
    timeZone: "UTC",
  });
  const month = parsed.toLocaleDateString("en-GB", {
    month: "long",
    timeZone: "UTC",
  });

  return `${weekday} ${toOrdinal(parsed.getUTCDate())} ${month}`;
}

function formatTime(time) {
  return String(time).replace(/^00:/, "");
}

function formatWinnerInline(winner) {
  const clubPart = winner.club ? ` (${winner.club})` : "";
  return `${winner.name}${clubPart} in ${formatTime(winner.time)}`;
}

function formatWinnerLine(winner, link) {
  const clubPart = winner.club ? ` (${winner.club})` : "";
  const alsoWon = Array.from(winner.alsoWon)
    .map((category) => category.label)
    .sort();

  const alsoWonPart =
    winner.alsoWon.size === 0
      ? ""
      : winner.alsoWon.size === 1
        ? ` (also first ${alsoWon[0]})`
        : ` (also first ${alsoWon.slice(0, -1).join(", ")} and ${alsoWon[alsoWon.length - 1]})`;

  return `* First ${winner.category.label}${alsoWonPart}: [${winner.name}](${link}&category=${encodeURIComponent(winner.category.label)})${clubPart} - ${formatTime(winner.time)}`;
}

function buildLeadSentence(raceTitle, leadDate, winners) {
  const maleWinner = winners.find((winner) => winner.category.group === "male");
  const femaleWinner = winners.find((winner) => winner.category.group === "female");

  if (maleWinner && femaleWinner) {
    const ordered =
      maleWinner.position < femaleWinner.position
        ? { first: maleWinner, second: femaleWinner }
        : { first: femaleWinner, second: maleWinner };

    return `Wins for ${formatWinnerInline(ordered.first)} and ${formatWinnerInline(ordered.second)} at the ${raceTitle} race on ${leadDate}.`;
  }

  return `Results are now available for the ${raceTitle} race on ${leadDate}.`;
}

function inferFromCsvPath(csvPath) {
  const normalized = path.normalize(csvPath).replace(/\\/g, "/");
  const exactPattern = /^\.\.\/([^/]+)\/(\d{4})\.csv$/;
  const exactMatch = exactPattern.exec(normalized);
  if (exactMatch) {
    return {
      raceId: exactMatch[1],
      year: exactMatch[2],
    };
  }

  const parts = normalized.split("/").filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  const filename = parts[parts.length - 1];
  const filenameMatch = /^(\d{4})\.csv$/i.exec(filename);
  if (!filenameMatch) {
    return null;
  }

  return {
    raceId: parts[parts.length - 2],
    year: filenameMatch[1],
  };
}

function readRaceTitleFromIndex(csvPath, fallbackRaceId) {
  const absoluteCsvPath = path.resolve(csvPath);
  const raceDir = path.dirname(absoluteCsvPath);
  const indexPath = path.join(raceDir, "index.md");

  if (!fs.existsSync(indexPath)) {
    return fallbackRaceId;
  }

  try {
    const raw = fs.readFileSync(indexPath, "utf8");
    const parsed = matter(raw);
    const title = typeof parsed.data.title === "string" ? parsed.data.title.trim() : "";
    return title || fallbackRaceId;
  } catch {
    return fallbackRaceId;
  }
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
    return { help: true };
  }

  if (isLikelyCsvPath(argv[0])) {
    return {
      raceId: undefined,
      year: undefined,
      csvPath: argv[0],
      dateIso: argv[1],
    };
  }

  return {
    raceId: argv[0],
    year: argv[1],
    csvPath: argv[2],
    dateIso: argv[3],
  };
}

function validateDateIso(dateIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    throw new Error(`Invalid date '${dateIso}'. Expected format YYYY-MM-DD.`);
  }

  const parsed = new Date(`${dateIso}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date '${dateIso}'.`);
  }
}

function buildMarkdown({ raceId, raceTitle, year, dateIso, csvText }) {
  const { winners, nEntrants } = extractRaceResultsWinnerSummary(csvText);
  const leadDate = formatLeadDate(dateIso);
  const title = `${raceTitle} ${year} results`;
  const excerpt = buildLeadSentence(raceTitle, leadDate, winners);
  const nonBinaryWinner = winners.find((winner) => winner.category.group === "nonBinary");
  const baseRaceLink = `/races/${encodeURIComponent(raceId)}?year=${encodeURIComponent(year)}`;

  const content = [
    `## [${raceTitle} ${year} results](${baseRaceLink})`,
    "",
    excerpt,
    nonBinaryWinner ? `Top non-binary finisher: ${formatWinnerInline(nonBinaryWinner)}.` : "",
    "",
    "### Highlights",
    ...winners.map((winner) => formatWinnerLine(winner, baseRaceLink)),
    `* ${nEntrants} entrants in total.`,
    "",
    `Full results can be found [on the race results page](${baseRaceLink}).`,
    "",
    "Congratulations to all runners and thanks to organisers and volunteers.",
  ]
    .filter((line, index, all) => {
      if (line !== "") return true;
      const prev = all[index - 1];
      return prev !== "";
    })
    .join("\n");

  return matter.stringify(content, {
    title,
    date: dateIso,
    excerpt,
  });
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.help) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!parsed.csvPath) {
    throw new Error("Missing csvPath argument.");
  }

  const inferred = inferFromCsvPath(parsed.csvPath);
  const raceId = parsed.raceId ?? inferred?.raceId;
  const year = parsed.year ?? inferred?.year;
  const dateIso = parsed.dateIso ?? todayIsoDate();

  if (!raceId || !year) {
    throw new Error(
      "Could not determine raceId/year. Provide them explicitly, or use a CSV path like ../{raceId}/{year}.csv."
    );
  }

  validateDateIso(dateIso);

  const absoluteCsvPath = path.resolve(parsed.csvPath);
  if (!fs.existsSync(absoluteCsvPath)) {
    throw new Error(`CSV file not found: ${parsed.csvPath}`);
  }

  const csvText = fs.readFileSync(absoluteCsvPath, "utf8");
  const raceTitle = readRaceTitleFromIndex(parsed.csvPath, raceId);
  const markdown = buildMarkdown({ raceId, raceTitle, year, dateIso, csvText });

  process.stdout.write(markdown);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`results-csv-to-news failed: ${message}`);
  printUsage();
  process.exitCode = 1;
}

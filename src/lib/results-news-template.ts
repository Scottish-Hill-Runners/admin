import { extractRaceResultsWinnerSummary, type RaceWinner } from "@/lib/results-csv";
import { getRaceDraft } from "@/lib/github";

export type ResultsNewsPrefill = {
  date: string;
  title: string;
  excerpt: string;
  content: string;
};

type ResultsNewsTemplateInput = {
  raceId: string;
  year: string;
  csvText: string;
  dateIso?: string;
};

function formatTime(time: string): string {
  return time.replace(/^00:/, "");
}

function formatWinnerLine(winner: RaceWinner, link: string): string {
  const clubPart = winner.club ? ` (${winner.club})` : "";
  const alsoWon = Array.from(winner.alsoWon).map((category) => category.label).sort();
  const alsoWonPart =
    winner.alsoWon.size === 0
      ? ""
      : winner.alsoWon.size === 1
        ? ` (also first ${alsoWon[0]})`
        : ` (also first ${alsoWon.slice(0, -1).join(", ")} and ${alsoWon[alsoWon.length - 1]})`;

  return `- First ${winner.category.label}${alsoWonPart}: [${winner.name}](${link}&category=${encodeURIComponent(winner.category.label)})${clubPart} - ${formatTime(winner.time)}`;
}

function formatWinnerInline(winner: { name: string; club: string; time: string }) {
  const clubPart = winner.club ? ` (${winner.club})` : "";
  return `${winner.name}${clubPart} in ${formatTime(winner.time)}`;
}

function toOrdinal(day: number): string {
  const remainder100 = day % 100;
  if (remainder100 >= 11 && remainder100 <= 13) {
    return `${day}th`;
  }

  const remainder10 = day % 10;
  if (remainder10 === 1) {
    return `${day}st`;
  }

  if (remainder10 === 2) {
    return `${day}nd`;
  }

  if (remainder10 === 3) {
    return `${day}rd`;
  }

  return `${day}th`;
}

function formatLeadDate(dateIso: string): string {
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

function buildLeadSentence(raceTitle: string, leadDate: string, winners: RaceWinner[]): string {
  const maleWinner = winners.find((winner) => winner.category.group === "male");
  const femaleWinner = winners.find((winner) => winner.category.group === "female");

  if (maleWinner && femaleWinner) {
    const { first, second } =
      maleWinner.position < femaleWinner.position
      ? { first: maleWinner, second: femaleWinner }
      : { first: femaleWinner, second: maleWinner };
    return `Wins for ${formatWinnerInline(first)} and ${formatWinnerInline(second)} at the ${raceTitle} race on ${leadDate}.`;
  }

  return `Results are now available for the ${raceTitle} race on ${leadDate}.`;
}

export async function buildResultsNewsPrefill({
  raceId,
  year,
  csvText,
  dateIso = new Date().toISOString().slice(0, 10),
}: ResultsNewsTemplateInput): Promise<ResultsNewsPrefill> {
  const { winners, nEntrants } = extractRaceResultsWinnerSummary(csvText);
  const race = await getRaceDraft(raceId);
  const raceTitle = race?.title.trim() || raceId;
  const leadDate = formatLeadDate(dateIso);
  const title = `${raceTitle} ${year} results`;
  const excerpt = buildLeadSentence(raceTitle, leadDate, winners);
  const nonBinaryWinner = winners.find((winner) => winner.category.group === "nonBinary");
  const baseRaceLink = `/races/${encodeURIComponent(raceId)}?year=${encodeURIComponent(year)}`;

  const content = [
    `## [${raceTitle} ${year} results](${baseRaceLink})`,
    "",
    excerpt,
    nonBinaryWinner
      ? `Top non-binary finisher: ${formatWinnerInline(nonBinaryWinner)}.`
      : "",
    "",
    "### Highlights",
    ...winners.map(winner => formatWinnerLine(winner, baseRaceLink)),
    `- ${nEntrants} entrants in total.`,
    "",
    `Full results can be found [on the race results page](${baseRaceLink}).`,
    "",
    "Congratulations to all runners and thanks to organisers and volunteers.",
  ].join("\n");

  return {
    date: dateIso,
    title,
    excerpt,
    content,
  };
}

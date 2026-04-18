export type EditorialStatus = "planned" | "in-progress" | "ready" | "MVP";

export type EditorialFlow = {
  slug: string;
  title: string;
  description: string;
  status: EditorialStatus;
  path: string;
};

export type NewsFrontmatter = {
  title: string;
  date: string;
  excerpt: string;
};

export type NewsListItem = {
  slug: string;
};

export type RaceInfoFormData = {
  raceId: string;
  title: string;
  venue: string;
  distance: string;
  climb: string;
  maleRecord: string;
  femaleRecord: string;
  nonBinaryRecord: string;
  web: string;
  organiser: string;
  content: string;
};

export type RaceListItem = {
  raceId: string;
};

export type RaceResultListItem = {
  raceId: string;
  year: string;
  path: string;
};

export type CsvUploadStatus = {
  fileName: string;
  raceId: string;
  year: string;
  issues: string[];
};

export type ClubInfoFormData = {
  clubId: string;
  name: string;
  aka: string[];
  web: string;
  content: string;
};

export type ClubListItem = {
  clubId: string;
};

export type ChampionshipYearEntry = {
  year: string;
  races: string;
};

export type ChampionshipInfoFormData = {
  championshipId: string;
  title: string;
  yearEntries: ChampionshipYearEntry[];
  content: string;
};

export type ChampionshipListItem = {
  championshipId: string;
};

export type LongDistanceFormData = {
  slug: string;
  title: string;
  content: string;
};

export type LongDistanceListItem = {
  slug: string;
};

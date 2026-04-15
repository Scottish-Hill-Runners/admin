const ISO_NEWS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoNewsDate(value: string): boolean {
  return ISO_NEWS_DATE_PATTERN.test(value.trim());
}

export function buildNewsSlug(date: string, suffix: string, fallback = "new-item-slug"): string {
  const normalizedDate = date.trim();
  const normalizedSuffix = suffix.trim();

  if (!normalizedDate) {
    return fallback;
  }

  if (!normalizedSuffix) {
    return normalizedDate;
  }

  return `${normalizedDate}-${normalizedSuffix}`;
}

function parseSuffixFromNewsBasename(date: string, basename: string): string | null {
  const normalizedDate = date.trim();
  const normalizedBase = basename.trim();

  if (!normalizedDate || !normalizedBase) {
    return null;
  }

  if (normalizedBase === normalizedDate) {
    return "";
  }

  const prefix = `${normalizedDate}-`;
  if (!normalizedBase.startsWith(prefix)) {
    return null;
  }

  return normalizedBase.slice(prefix.length);
}

export function getNewsSlugSuffixFromSlug(date: string, slug: string): string {
  const filename = slug.trim().split("/").pop() ?? "";
  return parseSuffixFromNewsBasename(date, filename) ?? "";
}

export function getNewsSlugSuffixFromPath(date: string, path: string): string | null {
  const fileName = path.trim().split("/").pop() ?? "";
  if (!fileName.endsWith(".md")) {
    return null;
  }

  const basename = fileName.slice(0, -3);
  return parseSuffixFromNewsBasename(date, basename);
}

export function suggestNextNewsSlugSuffix(reservedSuffixes: Iterable<string>): string {
  const suffixes = Array.from(reservedSuffixes, (suffix) => suffix.trim());
  const usedNumericSuffixes = new Set<number>();

  for (const suffix of suffixes) {
    if (!/^\d+$/.test(suffix)) {
      continue;
    }

    const value = Number.parseInt(suffix, 10);
    if (value >= 1) {
      usedNumericSuffixes.add(value);
    }
  }

  let candidate = 1;
  while (usedNumericSuffixes.has(candidate)) {
    candidate += 1;
  }

  return String(candidate);
}
import { CalendarEditForm } from "@/components/calendar-edit-form";
import { EditorialShell } from "@/components/editorial-shell";
import { getCalendarDraft, listRaceDrafts, toSafeGitRef } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type CalendarPageProps = {
  searchParams?: Promise<{ ref?: string }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  await requireEditorAccess();
  const rawSearch = await searchParams;
  const ref = toSafeGitRef(rawSearch?.ref);

  const [calendarDraft, raceItems] = await Promise.all([
    getCalendarDraft({ ref }),
    listRaceDrafts(),
  ]);

  return (
    <EditorialShell
      eyebrow="Edit"
      title="Edit race calendar"
      description="Manage calendar.csv entries in yyyy-mm-dd,RaceID format and save a draft for review."
    >
      <CalendarEditForm
        initialCsvText={calendarDraft?.csvText ?? ""}
        knownRaceIds={raceItems.map((item) => item.raceId)}
      />
    </EditorialShell>
  );
}

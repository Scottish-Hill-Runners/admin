import { CalendarEditForm } from "@/components/calendar-edit-form";
import { EditorialShell } from "@/components/editorial-shell";
import { getCalendarDraft, listRaceDrafts } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

export default async function CalendarPage() {
  await requireEditorAccess();

  const [calendarDraft, raceItems] = await Promise.all([
    getCalendarDraft(),
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

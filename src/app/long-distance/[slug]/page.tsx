import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { LongDistanceEditorForm } from "@/components/long-distance-editor-form";
import { getLongDistanceDraft } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type LongDistanceEditPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function LongDistanceEditPage({ params }: LongDistanceEditPageProps) {
  const { slug } = await params;
  await requireEditorAccess({ callbackUrl: `/long-distance/${slug}` });

  const initialValues = await getLongDistanceDraft(slug);

  return (
    <EditorialShell
      eyebrow="Edit report"
      title={initialValues?.title ?? slug}
      description={`Edit long-distance report: ${slug}.`}
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href="/long-distance" className="hover:text-stone-900 hover:underline underline-offset-4">
          Long Distance
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">{slug}</span>
      </nav>
      <LongDistanceEditorForm
        key={initialValues?.slug ?? slug}
        initialValues={initialValues}
      />
    </EditorialShell>
  );
}

import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";
import { InfoEditorForm } from "@/components/info-editor-form";
import { getInfoDraft, toSafeGitRef } from "@/lib/github";
import { requireEditorAccess } from "@/lib/route-protection";

type InfoEditPageProps = {
  params: Promise<{ segments: string[] }>;
  searchParams?: Promise<{ ref?: string }>;
};

export default async function InfoEditPage({ params, searchParams }: InfoEditPageProps) {
  const { segments } = await params;
  const rawSearch = await searchParams;
  const ref = toSafeGitRef(rawSearch?.ref);
  const filePath = segments.join("/");
  await requireEditorAccess({ callbackUrl: `/info/${segments.map(encodeURIComponent).join("/")}` });

  const initialValues = await getInfoDraft(filePath, { ref });

  return (
    <EditorialShell
      eyebrow="Edit info"
      title={`info/${filePath}`}
      description={`Edit the page file at info/${filePath}.`}
    >
      <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <Link href="/info" className="hover:text-stone-900 hover:underline underline-offset-4">
          Info
        </Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-stone-900">{filePath}</span>
      </nav>
      <InfoEditorForm
        key={initialValues?.filePath ?? filePath}
        initialValues={initialValues}
      />
    </EditorialShell>
  );
}

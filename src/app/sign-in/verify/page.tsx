import { EditorialShell } from "@/components/editorial-shell";
import { MagicLinkVerifier } from "@/components/magic-link-verifier";
import { verifyMagicLink } from "./actions";

type VerifyPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const { token } = await searchParams;

  return (
    <EditorialShell
      eyebrow="Authentication"
      title="Signing you in"
      description="Please wait while we verify your sign-in link."
    >
      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
          <MagicLinkVerifier token={token ?? ""} action={verifyMagicLink} />
        </article>
      </section>
    </EditorialShell>
  );
}

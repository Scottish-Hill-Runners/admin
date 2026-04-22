import { EditorialShell } from "@/components/editorial-shell";
import { MagicLinkVerifier } from "@/components/magic-link-verifier";
import { verifyMagicLink } from "./actions";

type VerifyPageProps = {
  searchParams: Promise<{ token?: string; callbackUrl?: string }>;
};

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const { token, callbackUrl } = await searchParams;

  const safeCallbackUrl =
    typeof callbackUrl === "string" &&
    callbackUrl.startsWith("/") &&
    !callbackUrl.startsWith("//")
      ? callbackUrl
      : undefined;

  return (
    <EditorialShell
      eyebrow="Authentication"
      title="Signing you in"
      description="Please wait while we verify your sign-in link."
    >
      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
          <MagicLinkVerifier token={token ?? ""} callbackUrl={safeCallbackUrl} action={verifyMagicLink} />
        </article>
      </section>
    </EditorialShell>
  );
}

import { EditorialShell } from "@/components/editorial-shell";
import { SignInForm } from "@/components/sign-in-form";
import { enabledAuthProviders } from "@/auth";

type SignInPageProps = {
  searchParams?: Promise<{ error?: string; status?: string; callbackUrl?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const callbackUrl = params?.callbackUrl;

  return (
    <EditorialShell
      eyebrow="Authentication"
      title="Sign in"
      description="Sign in with your GitHub, Google, or Microsoft account to access the editorial tools."
    >
      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
          <SignInForm callbackUrl={callbackUrl} providers={enabledAuthProviders} />
        </article>

        <article className="rounded-[1.5rem] border border-stone-900/10 bg-[#172119] p-6 text-stone-50 shadow-[0_22px_55px_rgba(23,33,25,0.24)]">
          <h2 className="font-[family:var(--font-heading)] text-2xl">Access</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-stone-200">
            This admin site is open to all Scottish Hill Runners community
            members. Sign in with your GitHub, Google, or Microsoft account — no approval
            required. All edits are attributed and tracked via Git.
          </p>
          {params?.error === "AccessDenied" ? (
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">
              Sign-in was cancelled or denied by the provider.
            </p>
          ) : null}
        </article>
      </section>
    </EditorialShell>
  );
}

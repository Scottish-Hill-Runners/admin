import { EditorialShell } from "@/components/editorial-shell";
import { SignInForm } from "@/components/sign-in-form";

type SignInPageProps = {
  searchParams?: Promise<{ error?: string; status?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;

  return (
    <EditorialShell
      eyebrow="Authentication"
      title="Sign in"
      description="Sign in with your GitHub account to access the editorial tools."
    >
      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
          <SignInForm />
        </article>

        <article className="rounded-[1.5rem] border border-stone-900/10 bg-[#172119] p-6 text-stone-50 shadow-[0_22px_55px_rgba(23,33,25,0.24)]">
          <h2 className="font-[family:var(--font-heading)] text-2xl">Access rules</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-stone-200">
            Editor access is limited to GitHub usernames listed in{" "}
            <code className="rounded bg-white/10 px-1 py-0.5 text-sm">EDITOR_GITHUB_ALLOWLIST</code>.
            Sign in with your GitHub account; if your username is on the list
            you will be granted access immediately.
          </p>
          {params?.error === "AccessDenied" || params?.error === "not-allowed" ? (
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">
              Your GitHub account is not on the editor allowlist.
            </p>
          ) : null}
        </article>
      </section>
    </EditorialShell>
  );
}

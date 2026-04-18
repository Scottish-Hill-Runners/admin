import { ReactNode } from "react";
import Link from "next/link";
import { signOutEditor } from "@/app/sign-out/actions";
import { contentConfig } from "@/lib/content-config";
import { getEditorSession } from "@/lib/auth-session";

type EditorialShellProps = {
  title: string;
  eyebrow: string;
  description: string;
  children: ReactNode;
};

export async function EditorialShell({
  title,
  eyebrow,
  description,
  children,
}: EditorialShellProps) {
  const { session, email, login } = await getEditorSession();
  const identity = email ?? login;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f4efe6_0%,#ebe3d5_100%)] px-6 py-6 text-stone-900 sm:px-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-[1.75rem] border border-stone-900/10 bg-stone-50/85 px-6 py-5 shadow-[0_18px_50px_rgba(52,42,28,0.1)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.24em] text-amber-900/70">
                {eyebrow}
              </p>
              <div>
                <h1 className="font-[family:var(--font-heading)] text-4xl leading-tight">
                  {title}
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-stone-700">
                  {description}
                </p>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-stone-900/10 bg-white/80 px-4 py-3 text-sm text-stone-700">
              <p className="font-semibold text-stone-900">Content target</p>
              <p>{contentConfig.repo}</p>
              <p>Branch: {contentConfig.branch}</p>
            </div>
          </div>

          {session ? (
            <nav className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="rounded-full border border-stone-900/10 bg-white/75 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
              >
                Home
              </Link>
              <Link
                href="/news"
                className="rounded-full border border-stone-900/10 bg-white/75 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
              >
                News
              </Link>
              <Link
                href="/races"
                className="rounded-full border border-stone-900/10 bg-white/75 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
              >
                Races
              </Link>
              <Link
                href="/results"
                className="rounded-full border border-stone-900/10 bg-white/75 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
              >
                Results
              </Link>
              <Link
                href="/calendar"
                className="rounded-full border border-stone-900/10 bg-white/75 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
              >
                Calendar
              </Link>
              <Link
                href="/championships"
                className="rounded-full border border-stone-900/10 bg-white/75 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
              >
                Championships
              </Link>
              <Link
                href="/clubs"
                className="rounded-full border border-stone-900/10 bg-white/75 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
              >
                Clubs
              </Link>
              <Link
                href="/collections"
                className="rounded-full border border-stone-900/10 bg-white/75 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
              >
                Collections
              </Link>
              {identity ? (
                <p className="rounded-full border border-stone-900/10 bg-white/75 px-4 py-2 text-sm font-medium text-stone-900">
                  Signed in as {identity}
                </p>
              ) : null}
              <form action={signOutEditor}>
                <button
                  type="submit"
                  className="rounded-full border border-stone-900/10 bg-white/75 px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
                >
                  Sign out
                </button>
              </form>
            </nav>
          ) : null}
        </header>

        {children}
      </div>
    </main>
  );
}

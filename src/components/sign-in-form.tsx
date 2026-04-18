"use client";

import { useActionState } from "react";
import { signIn } from "next-auth/react";
import { requestMagicLink, type RequestMagicLinkState } from "@/app/sign-in/actions";

type SignInFormProps = {
  callbackUrl?: string;
  providers: {
    github: boolean;
    google: boolean;
    microsoftEntraId: boolean;
    emailMagicLink: boolean;
  };
};

function toSafeCallbackUrl(value: string | undefined): string {
  const normalized = String(value ?? "").trim();
  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return "/";
  }

  return normalized;
}

export function SignInForm({ callbackUrl, providers }: SignInFormProps) {
  const nextCallbackUrl = toSafeCallbackUrl(callbackUrl);
  const hasOAuthProvider =
    providers.github || providers.google || providers.microsoftEntraId;
  const hasVisibleProviders = hasOAuthProvider || providers.emailMagicLink;

  const initialMagicLinkState: RequestMagicLinkState = { status: "idle" };
  const [magicLinkState, magicLinkAction, isMagicLinkPending] = useActionState(
    requestMagicLink,
    initialMagicLinkState
  );

  return (
    <div className="grid gap-5">
      <p className="text-sm leading-6 text-stone-600">
        Sign in with your GitHub, Google, Microsoft, or email account to access the editorial
        tools. Any authenticated user may contribute.
      </p>
      <div className="flex flex-col gap-3">
        {providers.github ? (
          <button
            type="button"
            onClick={() => signIn("github", { callbackUrl: nextCallbackUrl })}
            className="flex w-fit items-center gap-2 rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-stone-50 transition hover:bg-stone-700"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="size-4"
            >
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
            </svg>
            Sign in with GitHub
          </button>
        ) : null}

        {providers.google ? (
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: nextCallbackUrl })}
            className="flex w-fit items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-900 transition hover:bg-stone-50"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>
        ) : null}

        {providers.microsoftEntraId ? (
          <button
            type="button"
            onClick={() => signIn("microsoft-entra-id", { callbackUrl: nextCallbackUrl })}
            className="flex w-fit items-center gap-2 rounded-full border border-[#0f6cbd] bg-[#0f6cbd] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0c5ba0]"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
              <rect x="2" y="2" width="9" height="9" fill="#f35325" />
              <rect x="13" y="2" width="9" height="9" fill="#81bc06" />
              <rect x="2" y="13" width="9" height="9" fill="#05a6f0" />
              <rect x="13" y="13" width="9" height="9" fill="#ffba08" />
            </svg>
            Sign in with Microsoft
          </button>
        ) : null}

        {!hasVisibleProviders ? (
          <p className="text-sm text-red-700">
            No authentication providers are configured. Add provider credentials in .env.local.
          </p>
        ) : null}
      </div>

      {providers.emailMagicLink ? (
        <>
          {hasOAuthProvider ? (
            <div className="flex items-center gap-3">
              <hr className="flex-1 border-stone-200" />
              <span className="text-xs text-stone-400">or</span>
              <hr className="flex-1 border-stone-200" />
            </div>
          ) : null}

          {magicLinkState.status === "sent" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-800">Check your email</p>
              <p className="mt-1 text-sm text-emerald-700">
                We sent a sign-in link. It expires in 15 minutes.
              </p>
            </div>
          ) : (
            <form action={magicLinkAction} className="grid gap-3">
              <label htmlFor="sign-in-email" className="text-sm font-medium text-stone-700">
                Sign in with email
              </label>
              <div className="flex gap-2">
                <input
                  id="sign-in-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  className="min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
                <button
                  type="submit"
                  disabled={isMagicLinkPending}
                  className="rounded-full bg-stone-700 px-5 py-2.5 text-sm font-semibold text-stone-50 transition hover:bg-stone-600 disabled:opacity-60"
                >
                  {isMagicLinkPending ? "Sending\u2026" : "Send link"}
                </button>
              </div>
              {magicLinkState.status === "error" ? (
                <p className="text-sm text-red-700">{magicLinkState.error}</p>
              ) : null}
            </form>
          )}
        </>
      ) : null}
    </div>
  );
}

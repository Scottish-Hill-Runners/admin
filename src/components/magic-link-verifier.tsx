"use client";

import { useActionState, useEffect, useRef } from "react";

type MagicLinkVerifierProps = {
  token: string;
  action: (prev: null, formData: FormData) => Promise<null>;
};

export function MagicLinkVerifier({ token, action }: MagicLinkVerifierProps) {
  const [, formAction, isPending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (token) {
      formRef.current?.requestSubmit();
    }
  }, [token]);

  if (!token) {
    return (
      <div className="grid gap-4">
        <p className="text-sm font-semibold text-red-700">Invalid sign-in link.</p>
        <p className="text-sm text-stone-600">
          This link is missing required parameters.{" "}
          <a href="/sign-in" className="underline hover:text-stone-900">
            Request a new sign-in link.
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-stone-600">
        {isPending
          ? "Verifying your sign-in link\u2026"
          : "Preparing verification\u2026"}
      </p>
      <form ref={formRef} action={formAction}>
        <input type="hidden" name="token" value={token} />
      </form>
    </div>
  );
}

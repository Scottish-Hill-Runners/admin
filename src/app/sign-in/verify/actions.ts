"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export async function verifyMagicLink(
  _prev: null,
  formData: FormData
): Promise<null> {
  const token = formData.get("token");
  if (typeof token !== "string" || !token) {
    redirect("/sign-in?error=InvalidToken");
  }

  try {
    await signIn("magic-link", { token, redirectTo: "/" });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect("/sign-in?error=InvalidToken");
    }
    // Re-throw NEXT_REDIRECT and other framework errors
    throw err;
  }

  return null;
}

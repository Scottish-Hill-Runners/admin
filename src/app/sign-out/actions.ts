"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export async function signOutEditor() {
  const cookieStore = await cookies();
  // next-auth JWT session cookies
  cookieStore.delete("next-auth.session-token");
  cookieStore.delete("__Secure-next-auth.session-token");
  redirect("/sign-in");
}

import { auth } from "@/auth";

export default auth((request) => {
  if (request.auth) {
    return;
  }

  const signInUrl = new URL("/sign-in", request.nextUrl.origin);
  return Response.redirect(signInUrl);
});

export const config = {
  matcher: ["/news/:path*", "/races/:path*"],
};

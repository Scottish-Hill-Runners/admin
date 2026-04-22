import { auth } from "@/auth";

export default auth((request) => {
  if (request.auth) {
    return;
  }

  const signInUrl = new URL("/sign-in", request.nextUrl.origin);
  const callbackPath = request.nextUrl.pathname + request.nextUrl.search;
  signInUrl.searchParams.set("callbackUrl", callbackPath);
  return Response.redirect(signInUrl);
});

export const config = {
  matcher: ["/news/:path*", "/races/:path*", "/results/:path*", "/clubs/:path*"],
};

import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { env } from "@/lib/env";

const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
  },
  providers: [
    GitHubProvider({
      clientId: env.GITHUB_CLIENT_ID ?? "",
      clientSecret: env.GITHUB_CLIENT_SECRET ?? "",
    }),
    Google({
      clientId: env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    async signIn() {
      return true;
    },
    async jwt({ token, profile }) {
      if (profile) {
        const login = (profile as { login?: string }).login;
        token.githubLogin = login;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as typeof session.user & { login?: string }).login =
          token.githubLogin as string | undefined;
      }
      return session;
    },
  },
};

const authHandler = NextAuth({
  ...authConfig,
  secret: env.AUTH_SECRET,
});

export const { auth, handlers, signIn, signOut } = authHandler;
export default authHandler;
export { authConfig };

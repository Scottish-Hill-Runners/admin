import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { verifyMagicToken } from "@/lib/magic-link";
import { env } from "@/lib/env";

export const enabledAuthProviders = {
  github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
  google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  microsoftEntraId: Boolean(
    env.MICROSOFT_ENTRA_ID_CLIENT_ID &&
      env.MICROSOFT_ENTRA_ID_CLIENT_SECRET &&
      env.MICROSOFT_ENTRA_ID_TENANT_ID
  ),
  emailMagicLink: Boolean(env.RESEND_API_KEY),
};

const providers: NonNullable<NextAuthConfig["providers"]> = [];

if (enabledAuthProviders.github) {
  providers.push(
    GitHubProvider({
      clientId: env.GITHUB_CLIENT_ID as string,
      clientSecret: env.GITHUB_CLIENT_SECRET as string,
    })
  );
}

if (enabledAuthProviders.google) {
  providers.push(
    Google({
      clientId: env.GOOGLE_CLIENT_ID as string,
      clientSecret: env.GOOGLE_CLIENT_SECRET as string,
    })
  );
}

if (enabledAuthProviders.microsoftEntraId) {
  providers.push(
    MicrosoftEntraID({
      clientId: env.MICROSOFT_ENTRA_ID_CLIENT_ID as string,
      clientSecret: env.MICROSOFT_ENTRA_ID_CLIENT_SECRET as string,
      issuer: `https://login.microsoftonline.com/${env.MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`,
    })
  );
}

if (enabledAuthProviders.emailMagicLink) {
  providers.push(
    Credentials({
      id: "magic-link",
      name: "Email Magic Link",
      credentials: {
        token: { type: "text" },
      },
      async authorize(credentials) {
        const token = credentials?.token;
        if (typeof token !== "string" || !token) return null;
        const result = await verifyMagicToken(token);
        if (!result.valid) return null;
        return {
          id: result.email,
          email: result.email,
          name: result.email.split("@")[0],
        };
      },
    })
  );
}

const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
  },
  providers,
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

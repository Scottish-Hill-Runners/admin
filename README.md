# SHR Admin

Admin application for Scottish Hill Runners community editors.

## Purpose

This app provides a non-technical editing surface for SHR content stored in the GitHub-backed `contents` repository. The `site-builder` repository remains a separate static publishing application.

Scope:

- News editing
- Race information editing
- Race results CSV upload and validation
- Calendar CSV editing (`calendar.csv`)

## Architecture

- Next.js App Router application with a server runtime
- GitHub, Google, Microsoft and Magic-link authentication for editors
- GitHub-backed writes to the content repository via pull requests
- Shared validation rules derived from the public site build scripts

## Current foundation

- Editorial dashboard shell
- Content repository environment configuration
- Routes for News, Race, Results, Calendar and Collections (race photos) workflows
- Core dependencies installed for Auth.js, GitHub API integration, schema validation, and markdown rendering
- News editor server action that can open a content pull request when GitHub credentials are configured
- Middleware and server-side guards that keep editor routes behind sign-in and allowlist checks
- GitHub, Google, Microsoft and Magic-link email authentication
- Race metadata editor flow with validation and PR creation for `races/<raceId>/index.md`
- Results CSV draft flow with server-side validation and PR creation for `races/<raceId>/<year>.csv`
- Calendar CSV draft flow with grid editing, validation, and PR creation for `calendar.csv`

## Development

Install dependencies and start the dev server:

```bash
npm run dev
```

For OAuth auth, configure one or more provider settings in `.env.local`:

- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `MICROSOFT_ENTRA_ID_CLIENT_ID`
- `MICROSOFT_ENTRA_ID_CLIENT_SECRET`
- `MICROSOFT_ENTRA_ID_TENANT_ID`

For email magic-link sign-in via [Resend](https://resend.com):

- `RESEND_API_KEY` — API key from your Resend account
- `EMAIL_FROM` — Sender address, e.g. `SHR Admin <no-reply@yourdomain.com>`
  (defaults to `SHR Admin <no-reply@resend.dev>` for testing)

For GitHub-backed writes to the content repository, configure one of these options:

- Personal access token:
  - `GITHUB_TOKEN`
- GitHub App installation auth:
  - `GITHUB_APP_ID`
  - `GITHUB_APP_PRIVATE_KEY`
  - `GITHUB_APP_INSTALLATION_ID`

# SHR Admin

Separate admin application for Scottish Hill Runners editors.

## Purpose

This app provides a non-technical editing workflow for content stored in the GitHub-backed content repository. The public `results` site remains a separate static publishing application.

Initial MVP scope:

- News editing
- Race information editing
- Race results CSV upload and validation

## Planned architecture

- Next.js App Router application with a server runtime
- Magic-link authentication for editors
- GitHub-backed writes to the content repository via pull requests
- Shared validation rules derived from the public site build scripts

## Current foundation

- Editorial dashboard shell
- Content repository environment configuration
- Starter routes for News and Race workflows
- Core dependencies installed for Auth.js, GitHub API integration, schema validation, and markdown rendering
- Auth route scaffold and editor allowlist helper
- News editor server action that can open a content pull request when GitHub credentials are configured
- Middleware and server-side guards that keep editor routes behind sign-in and allowlist checks
- Interim signed-cookie editor session flow for approved emails while real magic-link infrastructure is still pending
- Race metadata editor flow with validation and PR creation for `races/<raceId>/index.md`
- Results CSV draft flow with server-side validation and PR creation for `races/<raceId>/<year>.csv`

## Development

Install dependencies and start the dev server:

```bash
npm run dev
```

For GitHub OAuth auth, configure these settings in `.env.local`:

- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `EDITOR_GITHUB_ALLOWLIST`

## Next implementation steps

1. Associate PR creation with the authenticated editor identity.
2. Associate PR creation with the authenticated editor identity.
3. Replace the temporary token-based GitHub write path with GitHub App authentication.
4. Improve the CSV workflow with file upload, header mapping, and richer validation previews.

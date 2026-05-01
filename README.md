# SHR Admin

Admin application for Scottish Hill Runners community editors.

## Purpose

This app provides a non-technical editing surface for SHR content stored in the GitHub-backed `contents` repository. The `site-builder` repository remains a separate static publishing application.

Scope:

- News editing
- Race information editing
- Race results CSV upload and validation
- Calendar CSV editing (`calendar.csv`)
- Club information editing

## Architecture

- Next.js App Router application with a server runtime
- GitHub, Google, Microsoft and Magic-link authentication for editors
- GitHub-backed writes to the content repository via pull requests
- Shared validation rules derived from the public site build scripts

## Current foundation

- Editorial dashboard shell
- Content repository environment configuration
- Routes for News, Race, Results, Calendar, Club and Collections (race photos) workflows
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

The target repository and branch strategy are set with:

- `CONTENT_REPO` — defaults to `Scottish-Hill-Runners/contents`
- `CONTENT_BRANCH` — the live/main branch, defaults to `main`
- `CONTENT_STAGING_BRANCH` — the staging branch, defaults to `staging`

## Content workflows

All editor saves create a pull request against the **staging** branch, not `main` directly. This separates the day-to-day editing cadence from official approval and site rebuilds.

### Standard edit

1. Editor fills in a form (news post, race metadata, results CSV, etc.) and clicks **Create PR**.
2. The admin opens a PR from a short-lived `shr-admin/<type>-<id>` branch targeting `staging`.
3. Changes accumulate on `staging` until a publisher is ready to deploy.

### Minor correction — auto-merge

For low-risk edits (typo fixes, small metadata corrections) the editor can tick **Minor correction — auto-merge** before submitting. This adds the `auto-merge` label to the PR. A GitHub Actions workflow in the content repository detects the label and squash-merges the PR into `staging` automatically without requiring manual approval.

Prerequisites in `Scottish-Hill-Runners/contents`:

1. Copy `scripts/auto-merge.yml` to `.github/workflows/auto-merge.yml`.
2. Create a label named `auto-merge` (suggested colour `#0e8a16`).
3. Enable **Read and write permissions** for Actions tokens under _Settings → Actions → General_ (required for private repositories).

### Publishing to live

When staged content is ready to go live:

1. A publisher visits **/publish** in the admin app.
2. The page shows how many commits staging is ahead of `main`.
3. Clicking **Open publish PR** creates a single `staging → main` PR.
4. An SHR official reviews and merges it — one approval, one site rebuild.

If a publish PR is already open, the page links to the existing one rather than opening a duplicate.

### Summary of branches

| Branch | Purpose |
|---|---|
| `shr-admin/<type>-<id>` | Short-lived per-edit branch; merged into staging |
| `staging` | Accumulates approved and auto-merged edits |
| `main` | Live content; only updated via the staging → main publish PR |

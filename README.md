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

To validate private content repository configuration and run a cutover smoke check:

```bash
npm run health:content
npm run smoke:private-repo
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
- `EMAIL_FROM` — Sender address, e.g. `SHR Admin <no-reply@admin.scottishhillrunners.uk>`
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

For media uploads to Cloudinary, configure:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

## Content workflows

All editor saves create a pull request against the **staging** branch, not `main` directly. This separates the day-to-day editing cadence from official approval and site rebuilds.

### Standard edit

1. Editor fills in a form (news post, race metadata, results CSV, etc.) and clicks **Create PR**.
2. The admin opens a PR from a short-lived `shr-admin/<type>-<id>` branch targeting `staging`.
3. Changes accumulate on `staging` until a publisher is ready to deploy.

### Webhook submissions from other sites

Trusted integrations can submit content updates directly to `/api/content-webhook`. The endpoint accepts a JSON payload, checks a shared secret, and turns the submission into a draft PR for the relevant content file on the `staging` branch.

Authentication:

- Send `x-webhook-secret` in the request headers, or use `Authorization: Bearer <secret>`.
- Configure `RESULTS_INBOX_WEBHOOK_SECRET` in the admin app environment.

Supported payload fields:

- `contentType` — `club` or `race`
- `clubId` or `raceId` (or `id`) — the target content record
- `markdown`, `content`, or `body` — the body text to write into the content file
- `frontmatterUpdates` (or `frontmatter`) — optional saved-field updates to merge into the existing file

Example: club update

```json
{
  "contentType": "club",
  "clubId": "Carnethy",
  "markdown": "Updated club description for the website.",
  "frontmatterUpdates": {
    "web": "https://carnethy.org.uk"
  }
}
```

Example: race update

```json
{
  "contentType": "race",
  "raceId": "Strathpeffer",
  "markdown": "Updated race notes for this year's event.",
  "frontmatterUpdates": {
    "date": "2026-09-12",
    "distance": "10.6"
  }
}
```

Example: direct results upload

```json
{
  "contentType": "results",
  "raceId": "cairngorm",
  "year": "2026",
  "csvText": "name,position,club,time\nAlice Smith,1,SHR,00:42:10\n",
  "generateReport": true
}
```

Example: direct minor correction

```json
{
  "type": "minor-correction",
  "raceId": "cairngorm",
  "year": "2026",
  "runnerPosition": "1",
  "changes": [
    {
      "field": "club",
      "value": "SHR"
    }
  ]
}
```

Example request using `curl`:

```bash
curl -X POST https://admin.scottishillrunners.uk/api/content-webhook \
  -H 'Content-Type: application/json' \
  -H 'x-webhook-secret: your-shared-secret' \
  -d '{
    "contentType": "club",
    "clubId": "Carnethy",
    "markdown": "Updated club description for the website.",
    "frontmatterUpdates": {
      "web": "https://carnethy.org.uk"
    }
  }'
```

The endpoint reads the current file from the staging branch, merges the incoming body text and saved-field updates with the existing content, and creates a draft PR for the content repository.

### Public documents API

The admin app also exposes Cloudinary-backed document metadata for the static site. These routes are separate from `/api/content-webhook`:

| Endpoint | Purpose | Authentication |
| --- | --- | --- |
| `GET /api/public/documents` | Returns cached document metadata and public Cloudinary delivery URLs. | None; intended for browser requests from the public site. |
| `POST /api/public/documents/refresh` | Forces a fresh Cloudinary metadata scan and replaces the in-memory document snapshot. | `x-documents-refresh-secret` header. |

The public site only calls the `GET` endpoint. The refresh endpoint is currently an administrative/automation hook; it is not a Cloudinary notification webhook and is not called by the browser. A future scheduled job or admin control can call it with:

```bash
curl -X POST https://admin.scottishhillrunners.uk/api/public/documents/refresh \
  -H 'x-documents-refresh-secret: your-refresh-secret'
```

Configure these values only in the admin app environment:

- `CLOUDINARY_CLOUD_NAME` — Cloudinary cloud name.
- `CLOUDINARY_API_KEY` — server-side Cloudinary API key.
- `CLOUDINARY_API_SECRET` — server-side Cloudinary API secret; never expose it to the public site.
- `DOCUMENTS_REFRESH_SECRET` — secret for the protected refresh endpoint; do not send it from browser code.
- `DOCUMENTS_CACHE_TTL_SECONDS` — optional cache lifetime, defaulting to `86400` seconds.
- `DOCUMENTS_API_ORIGINS` — optional comma-separated browser origins allowed by CORS. If omitted, the read-only endpoint allows all origins.

The document scan currently finds assets under `documents/` and `blobs/documents/`, includes assets tagged `document`, and reads `title` and `description` from Cloudinary context metadata. Cloudinary notification webhooks are not configured; the document API refreshes on a cache miss or expiry, while the explicit refresh route is available for controlled automation.

### Secret summary

- `RESULTS_INBOX_WEBHOOK_SECRET` protects `/api/content-webhook`, which can create content drafts and process results submissions. Keep it server-side and share it only with trusted integrations.
- `DOCUMENTS_REFRESH_SECRET` protects `/api/public/documents/refresh`. It is unrelated to `RESULTS_INBOX_WEBHOOK_SECRET` and should be a different value.
- The public `GET /api/public/documents` endpoint requires no secret because it returns only public document metadata and delivery URLs.

### Skip review — auto-merge

For low-risk edits (typo fixes, small metadata corrections) the editor can tick **Skip review — auto-merge** before submitting. This adds the `auto-merge` label to the PR. A GitHub Actions workflow in the content repository detects the label and squash-merges the PR into `staging` automatically without requiring manual approval.

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
| --- | --- |
| `shr-admin/<type>-<id>` | Short-lived per-edit branch; merged into staging |
| `staging` | Accumulates approved and auto-merged edits |
| `main` | Live content; only updated via the staging → main publish PR |

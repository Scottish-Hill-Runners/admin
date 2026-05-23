# Private Repository Smoke Test

Run this after switching CONTENT_REPO to a private repository.

## Quick Commands

- `npm run health:content`
- `npm run smoke:private-repo`

## Automated Checks

`npm run health:content` verifies:

1. GitHub credentials are configured.
2. The configured repository is reachable.
3. The live branch ref is reachable.
4. The draft branch ref is reachable (or reported as not created yet).
5. Pull request listing for the draft branch is reachable.

## Manual Workflow Smoke Test

1. Sign in as an editor.
2. Open each major workflow route and verify pages load without empty-error regressions:
   - `/news`
   - `/races`
   - `/results`
   - `/calendar`
   - `/collections/homepage`
   - `/collections/documents`
   - `/collections/committee`
   - `/info`
   - `/clubs`
   - `/championships`
   - `/long-distance`
   - `/race-assets`
3. Save one small draft in at least two content types and confirm each returns a draft URL.
4. Repeat one draft save with the auto-merge option and verify the label is present.
5. Sign in as a publisher and verify:
   - `/publish` loads status
   - `/publish/manage` loads submissions
   - accepting a submission still works
   - opening a publication request still works

## Failure Triage

1. Re-run `npm run health:content` and capture output.
2. If status shows HTTP 401/403, check GitHub token or app installation permissions.
3. If status shows branch ref 404 for the draft branch, create first draft or confirm CONTENT_STAGING_BRANCH.
4. If pull request API checks fail, verify pull request read/write permission for the private repository.

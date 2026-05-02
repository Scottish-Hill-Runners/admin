- [x] Verify that the copilot-instructions.md file in the .github directory is created.

- [x] Clarify Project Requirements
- Project type: separate Next.js admin app
- Language: TypeScript
- Frameworks: Next.js App Router, Tailwind CSS, ESLint
- Scope: custom admin app for non-technical editors to manage GitHub-backed content for SHR

- [x] Scaffold the Project
- Scaffolded in the current workspace root using create-next-app with TypeScript, Tailwind, ESLint, App Router, and src/ layout.

- [x] Customize the Project
- Replaced the default starter with an admin-focused landing page, project metadata, environment template, README, core dependencies, initial editorial route skeletons, the first auth/news editing scaffolding, token-backed GitHub PR path for news drafts, an interim signed-session editor access flow, the race metadata editor draft flow, and a first CSV results validation/upload draft flow.

- [x] Install Required Extensions
- No extensions needed.

- [ ] Compile the Project
- [x] Compile the Project
- `npm run lint` and `npm run build` both succeed after the initial admin customization.

- [ ] Create and Run Task
- [x] Create and Run Task
- Added a background `Next: dev` task for local development.

- [ ] Launch the Project
- [x] Launch the Project
- Development server is running via the `Next: dev` task on port 3000.

- [ ] Ensure Documentation is Complete
- [x] Ensure Documentation is Complete
- README and `.github/copilot-instructions.md` now reflect the admin app scope and current setup state.

- Work through each checklist item systematically.
- Keep communication concise and focused.
- Follow development best practices.

## UI Copy Guidelines

This app is used by non-technical community editors. All user-facing text must use plain language — never expose internal implementation details.

**Avoid → Use instead:**
- "PR" / "pull request" → "draft", "submission", or "publication request"
- "branch" / "merge" / "commit" → omit or use "save", "update"
- "staging" → "draft updates"
- "auto-merge" → "publish automatically"
- "frontmatter" → "saved fields"
- "markdown" → "text formatting" or omit
- "YAML" / `.yaml` filenames → omit; use plain descriptions ("document list", "image list")
- "slug" → "URL ending"
- "content repository" → "content store"
- "Validation" (as a heading) → "Checks"
- "GitHub credentials not configured" → "Publishing is not set up yet. Please contact an administrator."

Button labels must describe the user's intent, not the underlying mechanism (e.g., "Save draft" not "Create draft PR").

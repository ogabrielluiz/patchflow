# Releasing

This repo has two automated workflows. Both live in `.github/workflows/`.

## Cutting a release

Releases are **tag-driven**. Everything else — npm publish, GitHub Release,
auto-generated notes — happens in CI.

```bash
# 1. Bump the version in package.json (e.g. 0.1.6 → 0.2.0) and commit.
vim package.json
git add package.json
git commit -m "chore: 0.2.0"
git push origin main

# 2. Tag and push the tag.
git tag v0.2.0
git push origin v0.2.0
```

The `Release` workflow (`.github/workflows/release.yml`) then:

1. Verifies the tag matches `package.json`'s `version` (fails fast if you
   forgot to bump).
2. Runs `bun run typecheck` and `bun test`.
3. Runs `bun run build` (tsup → `dist/`).
4. `npm publish --provenance --access public` using the repo's
   [npm Trusted Publisher](https://docs.npmjs.com/trusted-publishers) OIDC
   integration — no `NPM_TOKEN` secret required.
5. Creates a GitHub Release at the tag with notes auto-generated from the
   PRs merged since the previous tag, grouped by label per
   `.github/release.yml`.

### Label your PRs

Release notes are grouped by PR label. Apply one of:

| Label | Section |
|-------|---------|
| `feature`, `enhancement` | ✨ Features |
| `fix`, `bug` | 🐛 Bug fixes |
| `docs`, `documentation` | 📚 Documentation |
| `test`, `tests` | 🧪 Tests |
| `chore`, `refactor`, `internal` | 🏗 Internal |
| `dependencies`, `deps` | 📦 Dependencies |
| (none of the above) | Other changes |

PRs authored by `dependabot` or `github-actions` are excluded, as are any
PRs tagged `skip-changelog` or `ignore-for-release`.

### Re-running a release

If a release fails part-way (e.g. npm outage), you can re-trigger the
workflow without creating a new tag:

- Go to **Actions → Release → Run workflow**.
- Enter the existing tag (e.g. `v0.2.0`).

The workflow is idempotent up to the `npm publish` step; a second publish
of the same version will fail, which is the right behavior.

### Versioning

This package follows [SemVer](https://semver.org/):

- `0.x.y` — API may change in any release. Breaking changes bump the minor.
- `1.0.0` onward — breaking changes require a major bump.

Until `1.0.0`, prefer minor bumps for anything that changes the rendered
SVG in a way a user might notice, and patch bumps for behavior-preserving
fixes.

## Docs deploy

The documentation site (`docs/`) deploys to GitHub Pages automatically on
every push to `main` that touches `docs/`, `src/`, `package.json`,
`tsup.config.ts`, or the workflow itself. No tag required.

Workflow: `.github/workflows/docs.yml`
Live site: <https://ogabrielluiz.github.io/patchflow/>

The workflow:

1. Builds the library with Bun (`bun run build`) — needed because the docs
   import `@ogabrielluiz/patchflow` via a `file:..` dependency to render
   real SVGs at build time.
2. Installs docs dependencies with `npm ci` (locked to
   `docs/package-lock.json`).
3. Runs `astro build` inside `docs/`.
4. Uploads `docs/dist/` as a Pages artifact and deploys it.

### Why two package managers?

The library uses Bun (native test runner, fast install). The docs use npm
because Astro / Starlight's ecosystem is npm-first, and we need the
`overrides` field in `docs/package.json` to pin `@astrojs/sitemap` to a
release that hasn't yet adopted Zod v4 (see the comment in that file).
This dual-PM setup is contained to CI and local docs dev; you don't need
to think about it unless you're touching `docs/`.

## Local checks before tagging

None of these are enforced by CI beyond the tests, but running them
locally before you tag saves a round-trip:

```bash
bun run typecheck
bun test
bun run build

# Sanity-check the docs build still works
cd docs && npm ci && npm run build
```

If `docs` complains about a missing lockfile after upgrading deps,
regenerate it with `npm install` (not `npm ci`) and commit the resulting
`docs/package-lock.json`.

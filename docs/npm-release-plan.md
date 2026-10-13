# Uszyist: npm publication and open-source CLI standards implementation plan

## Goal and status

Prepare this single-package CLI for reliable npm installation, safe automated releases, and maintainable open-source contribution practices. This document is an implementation backlog, not a statement that publication is already configured.

Follow the existing [CLI design](development-plan.md) and [domain contract](../CONTEXT.md). Do not change Todoist query semantics as part of release preparation.

Documentation follows the repository's English-language convention. Research and local packaging checks were performed on 2026-10-13. Recheck npm requirements before implementing account-side setup: publisher permissions and authentication requirements can change.

## Verified baseline

- `package.json` declares `uszyist@0.1.0`, `private: true`, ESM, `bin.uszyist: bin/run.js`, Node >=24, and npm >=11.
- The executable has a Node shebang. Oclif discovers commands from `./dist/commands`.
- `npm run build`, repository-root help, and `tasks timeline --help` succeed locally.
- There is no package `files` allowlist. npm falls back to `.gitignore`, which excludes `dist/`.
- `npm pack --dry-run --json`, including after a build, lists 35 files: source, tests, design documentation, and the launcher, but no `dist/`.
- Installing that tarball in an isolated temporary consumer directory succeeds. Root help exits 0 but lists no command groups. `uszyist tasks timeline --help` exits 2 with `Command tasks:timeline not found`.
- No release workflows, license file, or changelog were found. Package metadata lacks `license`, `repository`, `homepage`, and `bugs`.
- The npm registry returned 404 for `uszyist`. This does not reserve the name or guarantee permission to publish it.
- Existing tests use deterministic fixtures without a Todoist token. This assessment did not rerun the test suite or publish a package.

The packaging failure is the first implementation priority. Successful compilation and successful root help are not sufficient release gates.

## Scope and defaults

- Keep a single npm package, compiled ESM, the current Oclif command model, and executable name `uszyist`.
- Use an explicit package payload, a clean build during packing, and consumer-path smoke checks.
- Use GitHub Actions and npm Trusted Publishing (OIDC) for automated publication, rather than a long-lived npm publishing token.
- Use Release Please with the Node release strategy and Conventional Commit squash-PR titles.
- Keep maintainer approval of a release PR as the release decision. Do not publish every ordinary merge.
- Treat Changesets as an alternative to Release Please, not a second release system.
- Preserve JSON contracts, stdout/stderr separation, exit codes, and help that works without credentials or API access.

## Owner decisions and external prerequisites

Resolve these before the steps that depend on them; packaging and CI work can proceed independently.

- [ ] Verify availability and personal-account publication rights for the agreed unscoped npm name `uszyist`.
- [x] Select an open-source license and identify the copyright holder: MIT, `croogie`.
- [x] Confirm the canonical public GitHub repository: `https://github.com/croogie/uszyist`.
- [ ] Confirm account access and 2FA needed for the first npm publication and recovery.
- [x] Agree on supported systems and Node CI matrix: Linux and macOS; Node 24.0.0, latest 24.x, and latest 26.x.
- [x] Agree on release conventions: Release Please, Conventional Commit squash-PR titles, and squash merges.
- [x] Select the private security-reporting channel: GitHub Private Vulnerability Reporting.
- [ ] Enable GitHub Private Vulnerability Reporting; it was verified disabled during preparation.
- [ ] Configure a dedicated GitHub App for release PR creation and required branch checks.
- [ ] Configure squash merge messages to preserve PR titles and bodies, including breaking-change footers.
- [ ] After the authorized bootstrap and Trusted Publisher setup, activate `NPM_AUTOMATED_PUBLISH_ENABLED=true`.

Do not create an npm package, make a repository public, or publish a release merely to complete repository configuration without owner authorization.

### Decisions agreed during implementation preparation

- Target the full end-to-end rollout, including an owner-authorized initial publication and a subsequent automated OIDC release. Interview answers are not publication authorization.
- Use the unscoped npm name `uszyist`, owned by the maintainer's personal account; verify name availability and publication permissions before bootstrap.
- Keep `https://github.com/croogie/uszyist` as the canonical public source repository, with `main` as the default branch.
- Use the MIT license with `croogie` as the copyright-holder name.
- Support Linux and macOS with Node >=24, testing Node 24.0.0, latest 24.x, and latest 26.x on both systems. Windows is outside the declared support matrix.
- Use Release Please with Conventional Commit squash-PR titles and squash merges, not Changesets.
- Publish the initial registry release as `1.0.0`; use full SemVer thereafter: incompatible changes require a major release, compatible features a minor release, and fixes a patch release.
- Use a dedicated GitHub App for release PR creation so normal PR CI can run. App configuration and least-privilege installation access remain external prerequisites.
- Use GitHub Private Vulnerability Reporting as the private security channel; enable it before documenting it as available.
- Support stable releases only, published to `latest`; reject prerelease versions in publication automation.
- Stabilize the existing nine commands, flags, documented JSON schemas, exit-code behavior, runtime requirements, and workflow semantics for 1.0. Exact help wording and table layout are not stable contracts.
- Treat owner merge of a passing release PR as authorization for subsequent automated publication, without an additional environment approval gate.
- Retain the verified release tarball and its integrity metadata for recovery. If the registry version already exists, compare its integrity with that artifact; a match skips publication and resumes registry-consumer checks, while a mismatch stops the workflow. Missing retained artifacts must not silently cause a rebuild and publication of the same version.
- Support security fixes for the latest stable version only, on a best-effort basis without an SLA or promised backports.
- The owner confirmed this preparation agreement as the implementation baseline. This closes the design interview; it does not start implementation or authorize publication.

### Repository implementation and observed verification

Repository implementation is on `feat/npm-release`, based on the fetched `main` commit `92eba66`. Checked Changes items below mean repository code/configuration is implemented; they do not assert that hosted workflows or account-side setup have run.

- The package ships 30 intentionally selected files, including the launcher, compiled JavaScript, README, license, and metadata. Type declarations are not generated because there is no supported library API. No Oclif manifest is needed for the nine-command package.
- `npm ci`, type checking, all 24 tests, and the real installed-consumer smoke passed locally on macOS with Node 24.0.0, 24.15.0, and 26.11.1. Node 26 emits a non-failing deprecation warning from the existing `tsx` loader.
- The smoke exercised root help, all three groups, all nine command helps, and `--version` through the npm-created launcher without Todoist credentials. `prepack` removed an intentionally planted obsolete compiled command.
- Negative artifact fixtures were rejected for a missing compiled command and a shipped `.env` file.
- An isolated Git/npm fixture exercised the actual release prepare/verify CLIs, including tag/SHA/lockfile/embedded-package matching and rejection of modified integrity metadata. A noncanonical repository was rejected by the publication CLI before any registry/publish operation.
- With simulated registry responses and the publication subprocess blocked, the real recovery function skipped matching integrity and rejected mismatched integrity and HTTP 503.
- `actionlint` 1.7.12 accepted the final workflows, and Prettier accepted the checked release code/configuration/documentation files.
- Account-side inspection found no configured repository Actions secrets or variables; `npm whoami` returned HTTP 401. The GitHub App credentials, one-time publication activation, and authenticated owner bootstrap are therefore not available in the current environment.
- Hosted Linux/macOS CI, real Release Please PR generation, npm bootstrap, OIDC/provenance, and registry-consumer verification remain unexecuted external acceptance gates. No npm publication or repository/account setting changes were performed.

## Phase 1 — Correct and reproducible package payload

### Changes

- [x] Remove `private: true` from the package intended for publication.
- [x] Add a `files` allowlist starting with `bin` and `dist`. Add only indispensable runtime assets. npm includes standard package metadata, README, and license files automatically.
- [x] Keep `bin.uszyist` pointing to the shipped launcher and Oclif command discovery pointing to compiled output.
- [x] Add a cross-platform clean build that removes obsolete generated files before compiling. Avoid shell-only deletion commands that fail on Windows.
- [x] Add `prepack` to run the clean build for both `npm pack` and `npm publish`. Avoid duplicate build hooks and the deprecated `prepublish` hook.
- [x] Do not compile TypeScript or fetch extra executable code in consumer `postinstall` scripts. Build tools remain development dependencies.
- [x] Add the selected license file and package metadata: `license`, `repository`, `homepage`, `bugs`, and relevant `keywords`; `author` is optional.
- [x] Configure public publication access explicitly; the selected package name is unscoped.
- [x] Review Node/npm engines: retain Node >=24 and npm >=11, also declared by the Todoist SDK; require npm >=11.5.1 specifically in publication CI.
- [x] Evaluate the Oclif manifest: do not adopt one for this nine-command package; ship compiled commands directly.

### Acceptance criteria

- A fresh checkout followed by `npm ci` and `npm pack` produces a runnable package without a separate remembered manual build step.
- The tarball contains the launcher, compiled commands/modules, package metadata, README, and license, plus only intentionally selected assets.
- The tarball does not contain source tests, private configuration, credentials, task data, or internal design documents.
- Removing or renaming a source command leaves no stale compiled command in the next tarball.
- The package runs without the repository checkout or its development dependencies.

## Phase 2 — Consumer-path verification and CI

### Changes

- [x] Add a cross-platform packaging smoke script using a temporary directory, with cleanup on success and failure.
- [x] Pack the project, inspect the tarball's actual contents, and install it into an empty consumer directory outside the checkout.
- [x] Exercise the installed executable through its npm-created launcher, not `src/`, `tsx`, `npm link`, or the checkout's `bin/run.js`.
- [x] Run the smoke scenario without `TODOIST_API_TOKEN` and private workflow configuration. Do not query a real Todoist account in public CI.
- [x] Check root help, all three groups (`tasks`, `planning`, `activity`), and help for every command:
  - `tasks list`
  - `tasks timeline`
  - `tasks day-tasks`
  - `tasks current`
  - `tasks next`
  - `tasks elapsed`
  - `tasks deadlines`
  - `planning status`
  - `activity list`
- [x] Assert that root/group help exposes the expected commands and that each command-specific help succeeds. Do not snapshot incidental wording or accept root exit code 0 alone.
- [x] Verify the installed version through the existing Oclif `--version` surface; do not add a new command solely for a wiring test.
- [x] Add CI for pull requests and the main branch: `npm ci`, `npm run check`, existing tests, and the packaging smoke path. The packing hook owns the clean build to avoid redundant builds.
- [ ] Test the agreed OS/Node matrix, including the minimum supported Node. Make these checks required for merging.
- [x] Set workflow timeouts and least-privilege permissions. PR jobs have no publication rights or production secrets.

### Acceptance criteria

- The current omitted-`dist` package fails the consumer gate even though root help exits 0.
- The corrected package exposes all nine commands in isolated installs across the supported matrix.
- CI is deterministic and requires no Todoist token, private task fixtures, or live API calls.
- Missing runtime assets and accidentally using development dependencies fail before publication.

## Phase 3 — Automated version and changelog preparation

### Changes

- [x] Configure Release Please with the Node strategy.
- [x] Adopt and document Conventional Commit squash-PR title rules, including breaking changes.
- [x] Configure the Node release strategy to maintain `package.json`, `package-lock.json`, `CHANGELOG.md`, and Git tag/release metadata.
- [x] Configure initial-version 1.0.0 and full SemVer thereafter: breaking changes to commands, flags, JSON schemas, exit-code behavior, workflow semantics, or runtime support require a major release; compatible features require a minor release and fixes a patch release. Document explicit breaking-change declarations and migration notes.
- [x] Document user-facing release notes: changes, fixes, compatibility impact, and migration instructions where needed.
- [x] Wire release PR creation to the dedicated GitHub App token so normal PR CI can run; installation, credentials, and required branch checks remain external prerequisites.
- [x] Put publication in the same workflow, conditional on a newly created release and one-time post-bootstrap activation, with checkout of the exact release commit. Do not depend on a separate tag/release-triggered workflow.
- [x] Check agreement between package version, lockfile, release tag, checked-out commit, and embedded tarball metadata before publication.

### Acceptance criteria

- A representative change produces the expected release PR, version bump, and readable changelog.
- Release PRs receive the required checks; automation cannot bypass branch rules.
- Merging an ordinary PR does not publish a package.
- Owner merge of a passing release PR prepares one identified release and invokes its publication path once.
- A failed or rerun release workflow does not silently republish an immutable npm version or create a different artifact for the same release.

## Phase 4 — Secure automated npm publication

### Changes

- [x] Configure a GitHub-hosted runner and checkout of the exact release commit from the canonical repository.
- [x] Explicitly install npm 11.5.1 for Trusted Publishing, using compatible Node 24.0.0 in publication CI.
- [x] Pin third-party Actions to reviewed full commit SHAs, with automated update PRs. Disable persisted checkout credentials.
- [x] Grant `id-token: write` only to the publication job; use the narrowly scoped App token only for release PR/metadata operations.
- [x] Build/package once in a clean preparation job, check/test and install-smoke the tarball, retain it, then publish that exact `.tgz` rather than repacking.
- [x] Serialize publication jobs without cancelling in-progress publication.
- [x] Publish stable versions to `latest`; reject prerelease versions and invalid/mismatched release metadata. No prerelease channel is supported.
- [ ] Configure a Trusted Publisher on npm with the exact GitHub owner, repository, workflow filename, and optional environment name. Explicitly allow direct `npm publish`; new configurations currently default to staged publication only.
- [ ] Complete the first successful publish within two days of creating the publisher configuration, or recreate an expired configuration.
- [x] Use OIDC's automatic provenance without disabling it; verifying actual provenance remains a live publication acceptance gate.
- [ ] After confirming OIDC publication, disallow traditional publishing tokens in npm and revoke any obsolete write tokens. Keep account 2FA and a documented recovery path.
- [x] Configure postpublish registry-consumer smoke against the exact released version, not unpinned `latest`, checking command discovery and version.
- [x] Retain the verified tarball and integrity metadata for 90 days and document explicit dispatch recovery: compare an existing registry version with that artifact, skip publication only on a match, and resume exact-version consumer checks. Stop on mismatch or missing retained artifact rather than silently rebuilding for publication. Correct defective releases with a new version, not routine unpublish.

### Bootstrap and authorization

For a package that does not exist, first establish package ownership through an authorized initial publication before configuring its package-level Trusted Publisher. The initial release is a separate owner-controlled operation, not something an unconfigured OIDC workflow can assume it can perform.

Staged publishing with manual 2FA approval is a valid higher-control alternative. It is not the default in this plan because the requested target is simple automated publication after release approval.

### Acceptance criteria

- A release publishes without a long-lived npm write token in GitHub secrets.
- The publisher identity matches the intended repository/workflow, and unrelated PRs or forks cannot publish through it.
- The npm artifact is exactly the tarball that passed prepublication checks.
- A prerelease never replaces `latest` unintentionally.
- Provenance is present when the public repository/package prerequisites are met.
- Installing the registry version exposes all expected CLI commands and the correct version.

## Phase 5 — Open-source documentation and maintenance

### Changes

- [x] Update README with post-publication npm global installation and one-shot `npx` usage, runtime requirements, token configuration, examples, and upgrades. Keep source installation as development documentation.
- [ ] Remove the "No npm registry package has been published" statement only after the first successful publication.
- [x] Add concise `CONTRIBUTING.md`: setup, quality commands, tests, release-note/commit conventions, and CLI compatibility expectations.
- [x] Add `SECURITY.md` with the selected but currently disabled private reporting channel, token/task-content warnings, and latest-stable best-effort support.
- [x] Configure Dependabot for dependency and Actions update PRs through CI, without broad automatic merging.
- [x] Document maintainer release procedures, first-publish prerequisites, OIDC setup/activation, required checks, channel mapping, and failure recovery.
- [x] Add sanitized issue/PR templates with reproduction, Node/OS/CLI version, and safe output; never request real tokens or private task data.

### Acceptance criteria

- A new user can install and use the published CLI without reading source-development instructions.
- A contributor can run required checks and understand compatibility/release conventions.
- A maintainer can release and recover from a failed publication without undocumented local steps.
- Security reports and automated dependency updates have usable, maintained paths.

## Final definition of done

- [ ] Phases 1–5 are implemented, with owner decisions recorded and external prerequisites completed.
- [ ] CI checks the actual installable artifact across the documented support matrix.
- [ ] One authorized initial release establishes ownership and the registry consumer path works.
- [ ] At least one subsequent release demonstrates the automated version/changelog and OIDC publication path end to end.
- [ ] README, contributor/security documentation, changelog, and release procedure describe the deployed behavior, not planned capabilities.
- [ ] No private tokens or task data are committed, logged, or shipped.

## Explicit non-goals

Do not add a monorepo, a second package manager, a bundler solely for npm publication, standalone installers, automatic self-updates, plugin infrastructure, telemetry, or a new library API. Do not add `main`, `exports`, or `types` merely to imitate a dual CLI/library package. Keep generated type declarations only if they have an intentional consumer/debugging purpose; do not imply a supported library contract.

Signed release tags, manual stage approvals, and extended downstream integration suites can be adopted if the project's risk profile later justifies them. They are not prerequisites for this small CLI's initial automated release setup.

## Primary-source references and transferable practices

### npm and release tooling

- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/): runner support, OIDC permission, npm/Node minimums, publisher identity, direct/staged permissions, configuration expiry, provenance, and token restrictions.
- [npm lifecycle scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts/): `prepack` covers packing and publishing; `prepublishOnly` covers publishing only; avoid deprecated `prepublish` and unnecessary consumer install hooks.
- [npm package metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/): `files`, `bin`, engines, license, repository, and publication metadata.
- [Release Please Action](https://github.com/googleapis/release-please-action): Node release strategy, version/changelog PRs, permissions, outputs, and the `GITHUB_TOKEN` event-trigger caveat.

### Established open-source CLIs

- [Vite package](https://github.com/vitejs/vite/blob/main/packages/vite/package.json): explicit `bin`/`dist` payload, metadata, ESM, and build before publication. [Vite CI](https://github.com/vitejs/vite/blob/main/.github/workflows/ci.yml) demonstrates OS/Node coverage; [publication](https://github.com/vitejs/vite/blob/main/.github/workflows/publish.yml) demonstrates OIDC, pinned Actions, and release-environment controls.
- [pnpm TypeScript CLI](https://github.com/pnpm/pnpm/blob/main/pnpm11/pnpm/package.json): bounded package payload and build preparation. [pnpm release workflow](https://github.com/pnpm/pnpm/blob/main/.github/workflows/release.yml) validates packed artifacts. Its bundling, platform packages, and monorepo version machinery are not requirements for uszyist.
- [Salesforce CLI](https://github.com/salesforcecli/cli/blob/main/package.json): Oclif runtime assets, compiled output, manifest generation, and packaging lifecycle. [Its PR workflow](https://github.com/salesforcecli/cli/blob/main/.github/workflows/test.yml) and [consumer installation workflow](https://github.com/salesforcecli/cli/blob/main/.github/workflows/just-nut.yml) illustrate artifact and installed-consumer verification; its plugin/installer infrastructure is outside this plan.

These are observed examples, not a claim that all popular CLIs use one release tool or identical lifecycle hooks. The plan selects proportional practices for this repository.

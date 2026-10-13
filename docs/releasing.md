# Releasing uszyist

This guide distinguishes repository automation from account-side setup. It does not authorize publication. The pre-bootstrap source version is `0.1.0`; the first authorized registry release must be `1.0.0`.

## Release model

- Release Please opens version/changelog pull requests from Conventional Commit squash titles. Its initially empty manifest uses the one-time `initial-version: 1.0.0` bootstrap setting; it does not use a persistent `release-as`.
- Use full Semantic Versioning from `1.0.0`: incompatible changes are major, compatible features minor, and fixes patch releases. Use `!` or a `BREAKING CHANGE:` footer for an incompatible change and include migration notes.
- An ordinary merge does not publish. The owner merging a passing Release Please PR authorizes the later stable-only publication path.
- Only stable versions are supported and published with npm dist-tag `latest`. Prereleases must be rejected.
- Publication must use the exact tarball that passed local/CI packaging smoke checks; it must not repack the checkout after approval.

## First publication: owner-controlled bootstrap

These are external prerequisites, not capabilities supplied by this repository:

1. Confirm that the maintainer's personal npm account can create and publish the unscoped `uszyist` package, and keep account recovery/2FA available. The npm account name has not yet been verified; it must not be inferred from the package name.
2. Confirm the canonical public source is `croogie/uszyist`; npm Trusted Publishing requires the public package and public source repository for this OIDC flow.
3. Complete one owner-authorized publication of the verified `uszyist@1.0.0` tarball. Confirm that its package version, `package-lock.json`, Release Please tag, and checked release commit agree.
4. Retain that exact `.tgz` and its npm integrity value in durable release storage.

Do not create an npm package, publish, or configure account/repository settings merely by following this document. The initial publication establishes ownership; a package-level Trusted Publisher cannot be assumed before that exists.

After explicit owner authorization, bootstrap the first publication from the exact retained `v1.0.0` release artifact. This is a manual, owner-controlled publication **before** Trusted Publishing is configured; it is not an OIDC publication and must not rebuild or repack source.

Automated publication is disabled until `vars.NPM_AUTOMATED_PUBLISH_ENABLED` is exactly `true`. The first release workflow prepares and retains the artifact without attempting to bootstrap package ownership through OIDC.

```sh
git checkout v1.0.0
export GITHUB_REPOSITORY=croogie/uszyist
gh run download <artifact_run_id> --name uszyist-release-v1.0.0 --dir release-artifact
node scripts/release-verify.mjs --artifact-dir release-artifact --tag v1.0.0 \
  --sha "$(git rev-parse v1.0.0^{commit})" --origin-run-id <artifact_run_id>
node scripts/package-smoke.mjs --tarball release-artifact/package.tgz
npm publish release-artifact/package.tgz --tag latest
node scripts/package-smoke.mjs --registry 1.0.0
```

Record the SHA-512/integrity from `release-artifact/release-metadata.json`. The verification step reads `package/package.json` from the retained gzip tarball and requires its name/version to match release metadata, tag, and checked lockfile.

After the registry-consumer check succeeds, remove the unpublished-package notice from README. Enable GitHub Private Vulnerability Reporting before changing SECURITY.md to advertise it as operational.

## Repository release gate

Before accepting a Release Please PR, required branch checks must cover Linux and macOS on Node 24.0.0, latest 24.x, and latest 26.x. Require all six `CI / verify` matrix checks from `.github/workflows/ci.yml`:

- `CI / verify (ubuntu-latest, 24.0.0)`, `CI / verify (ubuntu-latest, 24.x)`, and `CI / verify (ubuntu-latest, 26.x)`;
- `CI / verify (macos-latest, 24.0.0)`, `CI / verify (macos-latest, 24.x)`, and `CI / verify (macos-latest, 26.x)`;
- `PR title / conventional-title` from `.github/workflows/pr-title.yml`; its read-only `pull_request_target` job checks out the base SHA, never pull-request code. This check becomes available after the workflow and validator land on `main`; configure it as required after that bootstrap merge.

The CI commands are:

```sh
npm ci
npm run check
npm test
npm run smoke:package
```

`smoke:package` packs and inspects the artifact, installs it into an isolated consumer directory, and exercises the installed CLI without credentials or live Todoist data. Release CI validates the exact retained tarball with `npm run smoke:package -- --tarball PATH` before publication, then uses `npm run smoke:package -- --registry VERSION` after it is in the registry.

Protect `main` so these checks are required and a release-automation pull request cannot bypass branch rules. Configure the dedicated GitHub App to create Release Please PRs and trigger normal PR checks. Set its ID in `vars.RELEASE_APP_ID` and private key in `secrets.RELEASE_APP_PRIVATE_KEY`; restrict its token to the `croogie` installation's `uszyist` repository (`owner: croogie`, `repositories: uszyist`) and grant only `Contents`, `Pull requests`, and `Issues` write access there. Its use is necessary because work created with the default `GITHUB_TOKEN` does not trigger later workflow runs.

Enable squash merging with the PR title as the commit title and the PR body as the commit message, so `BREAKING CHANGE:` footers reach Release Please. Prefer a `!` in the title for breaking changes and retain migration notes in the body.

## Trusted Publishing (OIDC)

After bootstrap, configure npm Trusted Publishing for the exact identity **GitHub owner `croogie`, repository `uszyist`, workflow filename `release.yml`**. That filename is `.github/workflows/release.yml` in this repository. The publisher must permit **direct** `npm publish`, rather than npm's staged-publication default. Only the publication job receives `id-token: write`; jobs that do not publish must not receive it. Keep publication serialized and do not cancel a running publication in favor of a newer run.

Only after the initial registry publication and Trusted Publisher setup, set the repository variable `NPM_AUTOMATED_PUBLISH_ENABLED` to `true`. This is a one-time activation, not an extra approval for each later release. Leaving it unset also permits preparation and verification without npm publication rights.

npm documents that a new Trusted Publisher configuration expires unless a successful publish completes within two days; recreate an expired configuration rather than weakening identity checks. Use npm >=11.5.1 on the GitHub-hosted publication runner, keep provenance enabled, and do not put `NPM_TOKEN` or another long-lived npm publishing token in GitHub secrets. After OIDC publishing works, disable traditional npm publishing tokens and revoke obsolete write tokens while retaining account recovery and 2FA.

The exact npm identity fields, direct-publication setting, expiry rule, OIDC permission, runner/npm requirements, and provenance prerequisites are documented in [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/). Release Please behavior and its event caveat are documented by the [Release Please Action](https://github.com/googleapis/release-please-action).

## Pinned workflow dependencies

Workflows pin third-party actions to full commit SHAs. These pins were resolved from each action's official GitHub release/tag page: [actions/checkout v4.2.2](https://github.com/actions/checkout/releases/tag/v4.2.2) (`11bd71901bbe5b1630ceea73d27597364c9af683`), [actions/setup-node v4.4.0](https://github.com/actions/setup-node/releases/tag/v4.4.0) (`49933ea5288caeca8642d1e84afbd3f7d6820020`), [actions/upload-artifact v4.6.2](https://github.com/actions/upload-artifact/releases/tag/v4.6.2) (`ea165f8d65b6e75b540449e92b4886f43607fa02`), [actions/download-artifact v4.3.0](https://github.com/actions/download-artifact/releases/tag/v4.3.0) (`d3f86a106a0bac45b974a628896c90dbdf5c8093`), [actions/create-github-app-token v1.11.6](https://github.com/actions/create-github-app-token/releases/tag/v1.11.6) (`21cfef2b496dd8ef5b904c159339626a10ad380e`), and [googleapis/release-please-action v4.4.0](https://github.com/googleapis/release-please-action/releases/tag/v4.4.0) (`16a9c90856f42705d54a6fda1823352bdc62cf38`). Review update pull requests before changing a pin.

## Publication and recovery

1. Check out the exact release commit in a clean GitHub-hosted runner.
2. Run `node scripts/release-prepare.mjs --out-dir DIR --tag vX.Y.Z --sha SHA --run-id ID` to verify release metadata, package version, lockfile, and tag, build/package once, and retain `uszyist-release-vX.Y.Z` with integrity metadata.
3. Run `node scripts/release-verify.mjs --artifact-dir DIR --tag vX.Y.Z --sha SHA --origin-run-id ID` to verify identity, embedded package version, and integrity; then run `node scripts/package-smoke.mjs --tarball DIR/package.tgz` to exercise the installed artifact.
4. Run `node scripts/release-publish.mjs` with the same artifact, tag, SHA, and origin-run arguments to publish only a missing integrity-verified tarball to `latest` through OIDC.
5. Run the registry smoke command for the exact version, not unpinned `latest`, and confirm the installed version and command discovery.

For recovery, the owner manually dispatches the Release workflow with `release_tag`, `release_sha`, and `artifact_run_id`: the exact release tag, exact 40-character release SHA, and originating workflow run ID. It checks out that exact input SHA before running the same scripts, so it never runs newer automation. The workflow artifact is retained for 90 days, so recovery needs that original run ID within that window. The workflow downloads the retained `uszyist-release-vX.Y.Z` artifact, reads `package/package.json` from the retained gzip tarball, and verifies its name/version, canonical repository, tag, commit, package and lockfile version, release metadata, and SHA-512 before it compares registry integrity. It publishes only when the registry returns 404 for the target version. A matching integrity skips publication and runs `node scripts/package-smoke.mjs --registry VERSION`; an integrity mismatch, any other registry response, or a missing artifact stops the workflow. Never silently rebuild an immutable version. Correct a defective release with a new version; do not treat unpublish as routine rollback.

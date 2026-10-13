# Releasing uszyist

This is the first-time setup procedure for `croogie/uszyist`. Run commands yourself, one block at a time, and stop on an error. Preparing this guide did not configure accounts, merge pull requests, or publish npm. The pre-bootstrap source version is `0.1.0`; Release Please prepares the first registry release as `1.0.0`.

The procedure and UI labels were checked against official documentation on 2026-10-13. PR #2 was open and its six CI matrix checks were successful at that inspection. Browser labels can change; each stage links to its authoritative walkthrough.

## 1. Prepare one terminal session

Start in the repository root. Keep this terminal open: the variables below are not persistent across terminal sessions.

```sh
export REPO=croogie/uszyist
export REGISTRY=https://registry.npmjs.org/
export PROJECT_DIR="$PWD"

gh auth status
gh api user --jq '.login'
node --version
npm --version
```

GitHub must report `croogie`: the release workflow accepts owner-initiated main pushes and recovery dispatches. If GitHub CLI is not authenticated, use `gh auth login --hostname github.com --git-protocol https --web`, then recheck the account. Node must be >=24.

Local trusted-publisher configuration needs npm >=11.15.0, which is a higher threshold than the workflow's npm >=11.5.1 requirement for OIDC publication itself:

```sh
npm install --global 'npm@^11.15.0'
npm --version
npm trust github --help
```

If global installation returns a permission error, do not blindly use `sudo`: use `npx --yes npm@11.15.0 trust ...` for the trust commands instead. npm 11.15.0 supports the existing Node 24 runtime. No npm publishing token belongs in GitHub secrets.

Sources: [GitHub CLI login](https://cli.github.com/manual/gh_auth_login), [npm trust prerequisites and flags](https://docs.npmjs.com/cli/v12/commands/npm-trust/).

## 2. Create and install the GitHub App in the browser

A normal App registration is not available as a native `gh app create` command. Open <https://github.com/settings/apps/new>, signed in as `croogie`.

Fill in these fields:

| Form field                                                   | Value                                                                                  |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| GitHub App name                                              | A globally unique name, e.g. `croogie-uszyist-release`; add a suffix if already taken. |
| Homepage URL                                                 | `https://github.com/croogie/uszyist`                                                   |
| Callback URL / Setup URL                                     | Leave empty.                                                                           |
| Request user authorization during installation / Device Flow | Leave unselected.                                                                      |
| Webhook: Active                                              | Uncheck. No webhook URL or secret is needed.                                           |
| Repository permissions: Contents                             | Read and write                                                                         |
| Repository permissions: Pull requests                        | Read and write                                                                         |
| Repository permissions: Issues                               | Read and write                                                                         |
| Other permissions                                            | No access, apart from automatic metadata access.                                       |
| Where can this GitHub App be installed?                      | Only on this account                                                                   |

Click **Create GitHub App**. On the App settings page record the numeric **App ID**, not its Client ID: the pinned token action uses the `app-id` input.

In the App sidebar, select **Credentials → Key pairs → New key**. Preserve the downloaded PEM file outside the repository. GitHub keeps only its public portion.

Then select **Install App → Install** next to `croogie`, choose **Only select repositories**, select only **uszyist**, and click **Install**.

Sources: [Registering a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app), [Generating a private key](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps#generating-private-keys), [Installing your own App](https://docs.github.com/en/apps/using-github-apps/installing-your-own-github-app), [pinned action's App ID input](https://github.com/actions/create-github-app-token/blob/21cfef2b496dd8ef5b904c159339626a10ad380e/action.yml).

## 3. Store the App credentials and configure squash messages

Replace the two quoted placeholder values below with the numeric App ID and the actual path of the downloaded PEM. Do not paste the key text into a shell command, this document, or a conversation.

```sh
APP_ID='PASTE_NUMERIC_APP_ID'
KEY_FILE='/absolute/path/to/downloaded-private-key.pem'

chmod 600 "$KEY_FILE"
gh variable set RELEASE_APP_ID --repo "$REPO" --body "$APP_ID"
gh secret set RELEASE_APP_PRIVATE_KEY --repo "$REPO" < "$KEY_FILE"
gh variable set NPM_AUTOMATED_PUBLISH_ENABLED --repo "$REPO" --body false

gh variable list --repo "$REPO"
gh secret list --repo "$REPO"
```

The key command uploads the whole PEM through standard input, including its BEGIN/END lines. Secret readback shows the name, not its contents. Keep the file securely for recovery/rotation; do not create a GitHub App Client Secret for this workflow.

Set squash defaults without disabling existing merge methods:

```sh
gh api --method PATCH "repos/$REPO" \
  -F allow_squash_merge=true \
  -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=PR_BODY
```

The title must be a Conventional Commit, e.g. `fix: ...`, `feat: ...`, or `feat!: ...`. Preserving the body also preserves `BREAKING CHANGE:` footers. The App token triggers normal PR CI; the repository's default `GITHUB_TOKEN` need not receive general write access or permission to create/approve PRs.

Sources: [`gh variable set`](https://cli.github.com/manual/gh_variable_set), [`gh secret set`](https://cli.github.com/manual/gh_secret_set), [repository PATCH fields](https://docs.github.com/en/rest/repos/repos#update-a-repository), [token-trigger behavior](https://docs.github.com/en/actions/how-tos/write-workflows/choosing-when-your-workflow-runs/triggering-a-workflow).

## 4. Create/secure the npm account and log in

If necessary, register at <https://www.npmjs.com/signup> and verify your email. The npm account name may differ from `croogie`; do not infer it from the package name.

On npm's website use **profile picture → Account → Two-Factor Authentication → Enable 2FA**. Configure an available second-factor method and store recovery codes in your password manager, separate from the device. They are recovery tools, not the normal publication login method; recovery-code login currently imposes a 72-hour hold on publishing and other sensitive operations.

Then authenticate from the terminal:

```sh
npm login --auth-type=web --registry="$REGISTRY"
npm whoami --registry="$REGISTRY"
```

Complete the browser login/2FA prompt. `whoami` must print your npm username. Confirm you can own the unscoped `uszyist` name; a registry 404 is not a reservation. If someone else owns it, stop rather than choosing a different name silently.

Sources: [Creating an npm account](https://docs.npmjs.com/creating-a-new-npm-user-account/), [Configuring 2FA](https://docs.npmjs.com/configuring-two-factor-authentication/), [Using npm with 2FA](https://docs.npmjs.com/accessing-npm-using-2fa/), [Account recovery](https://docs.npmjs.com/recovering-your-2fa-enabled-account/).

## 5. Merge the implementation and inspect the first release PR

Only after the App installation and credentials are ready, intentionally merge PR #2 as the owner:

```sh
gh pr checks 2 --repo "$REPO" --watch --fail-fast
gh pr merge 2 --repo "$REPO" --squash
```

Do not run the merge if checks fail. Once merged, find the Release workflow and the Release Please PR:

```sh
gh run list --repo "$REPO" --workflow release.yml --branch main --limit 10 \
  --json databaseId,status,conclusion,headSha
gh pr list --repo "$REPO" --state open --base main --json number,title,url
```

If there is no release PR yet, inspect/watch the actual Release run: `gh run watch RUN_ID --repo "$REPO" --exit-status`; on failure, use `gh run view RUN_ID --repo "$REPO" --log-failed`. Replace `RUN_ID` with its displayed numeric value.

Set `RELEASE_PR` to the observed release PR number, not a guessed number:

```sh
RELEASE_PR='PASTE_RELEASE_PR_NUMBER'
gh pr view "$RELEASE_PR" --repo "$REPO" --web
gh pr checks "$RELEASE_PR" --repo "$REPO" --watch --fail-fast
```

Verify that its package/lockfile version is `1.0.0`, its manifest is updated, and its changelog is readable. Confirm that all six `verify (...)` jobs and `conventional-title` exist and pass. The title workflow runs from the base branch, so its first check is available only after PR #2 lands on main. Do not require a check that has not appeared yet.

Sources: [Release Please Action](https://github.com/googleapis/release-please-action), [`gh pr checks`](https://cli.github.com/manual/gh_pr_checks), [`gh pr merge`](https://cli.github.com/manual/gh_pr_merge), [`gh run list`](https://cli.github.com/manual/gh_run_list), [`gh run watch`](https://cli.github.com/manual/gh_run_watch).

## 6. Require the checks on main, without an App bypass

Run this in the original repository root, before merging the release PR. Inspect current rules first:

```sh
cd "$PROJECT_DIR"
gh api "repos/$REPO/rulesets" --jq '.[] | {id,name,enforcement}'
gh api "repos/$REPO/rules/branches/main"
gh pr checks "$RELEASE_PR" --repo "$REPO" --json name,state,workflow
```

The initial inspection found no repository rulesets. If `main release checks` already exists, edit it instead of creating a duplicate. Existing protection/rules are not overwritten by the following POST, but all applicable active rules must be satisfied.

The companion `docs/release-main-ruleset.json` targets main only, requires a PR and squash merge, requires the six matrix checks plus `conventional-title`, tests against up-to-date main, requires no approving review from another person, and grants no bypass. It binds checks to GitHub Actions App ID **15368**, observed in this repository's check-run API; this is not `RELEASE_APP_ID`.

You can verify the check producer before applying it:

```sh
PR_SHA="$(gh pr view "$RELEASE_PR" --repo "$REPO" --json headRefOid --jq '.headRefOid')"
gh api "repos/$REPO/commits/$PR_SHA/check-runs" \
  --jq '.check_runs[] | {name,app_id:.app.id,app_slug:.app.slug}'
```

Only after the seven expected checks have appeared, create the ruleset:

```sh
gh api --method POST "repos/$REPO/rulesets" \
  -H 'X-GitHub-Api-Version: 2026-03-10' \
  --input docs/release-main-ruleset.json

gh api "repos/$REPO/rules/branches/main"
```

Do not add the release App to the bypass list, require another person's approval for a sole-maintainer project, or enable a merge queue without updating the CI triggers. Actual check contexts are `verify (ubuntu-latest, 24.0.0)`, etc., and `conventional-title`; they do not include `CI /` or `PR title /` prefixes.

Browser alternative: <https://github.com/croogie/uszyist/settings/rules> → **New ruleset → New branch ruleset**. Configure the same rules; do not enable an approving-review requirement. Use the CLI template or the browser route, not both.

Sources: [Creating rulesets in the UI](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository), [Create ruleset API and parameter schema](https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset), [Check-run App/source API](https://docs.github.com/en/rest/checks/runs#list-check-runs-for-a-git-reference).

## 7. Prepare, download, and verify the first artifact

Intentionally merge the passing `1.0.0` release PR. This creates a GitHub release and prepares a tarball; it does not yet upload npm because the publication variable is false.

```sh
gh pr merge "$RELEASE_PR" --repo "$REPO" --squash
gh run list --repo "$REPO" --workflow release.yml --branch main --limit 10 \
  --json databaseId,status,conclusion,headSha
```

Set `RUN_ID` to the run created by that release merge. Watch it and inspect its jobs; `verify and retain release tarball` must succeed and `publish verified release` must be skipped:

```sh
RUN_ID='PASTE_ARTIFACT_RUN_ID'
gh run watch "$RUN_ID" --repo "$REPO" --exit-status
gh run view "$RUN_ID" --repo "$REPO" --verbose
```

Use a clean temporary clone of the exact tag, so you do not disturb your development checkout or rebuild a different artifact:

```sh
BOOTSTRAP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/uszyist-bootstrap.XXXXXX")"
git clone --branch v1.0.0 --depth 1 \
  https://github.com/croogie/uszyist.git "$BOOTSTRAP_DIR/source"
cd "$BOOTSTRAP_DIR/source"
export GITHUB_REPOSITORY=croogie/uszyist
RELEASE_SHA="$(git rev-parse HEAD)"
ARTIFACT_DIR="$BOOTSTRAP_DIR/artifact"

gh run download "$RUN_ID" --repo "$REPO" \
  --name uszyist-release-v1.0.0 --dir "$ARTIFACT_DIR"

node scripts/release-verify.mjs --artifact-dir "$ARTIFACT_DIR" \
  --tag v1.0.0 --sha "$RELEASE_SHA" --origin-run-id "$RUN_ID"
node scripts/package-smoke.mjs --tarball "$ARTIFACT_DIR/package.tgz"
```

Stop if either verification command fails. Do not run `npm pack`, build a new archive, or publish a directory. Preserve `package.tgz` and `release-metadata.json` securely in durable storage; Actions retention is 90 days. Merely cloning the source does not supply an alternative release artifact.

Sources: [`gh run download`](https://cli.github.com/manual/gh_run_download), [Git clone](https://git-scm.com/docs/git-clone), [npm lifecycle scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts/).

## 8. Authorize and execute the first npm publish

**Public and irreversible:** only run this after deciding to publish `uszyist@1.0.0`. npm name/version pairs cannot be reused, including after unpublish. This local first upload is not an OIDC publish and does not automatically gain OIDC provenance.

```sh
npm whoami --registry="$REGISTRY"
npm publish "$ARTIFACT_DIR/package.tgz" --tag latest --access public \
  --registry="$REGISTRY"
node scripts/package-smoke.mjs --registry 1.0.0
```

Complete any npm 2FA/browser challenge. Do not add an OTP or token to shell history. If publication reports an error, inspect the exact registry version before retrying; never assume a lost connection means nothing was published.

Check that npm received the same bytes:

```sh
LOCAL_INTEGRITY="sha512-$(openssl dgst -sha512 -binary "$ARTIFACT_DIR/package.tgz" | openssl base64 -A)"
REMOTE_INTEGRITY="$(npm view uszyist@1.0.0 dist.integrity --registry="$REGISTRY")"
test "$LOCAL_INTEGRITY" = "$REMOTE_INTEGRITY"
npm owner ls uszyist --registry="$REGISTRY"
```

If integrity or installed-consumer verification fails, stop. Correct defective releases with a new version, not routine unpublish. A tarball package spec supplies its existing bytes to npm; directory lifecycle hooks do not build a replacement tarball for this publish path.

Sources: [Publishing unscoped public packages](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/), [npm publish and immutable versions](https://docs.npmjs.com/cli/v11/commands/npm-publish/), [npm v11 tarball publication implementation](https://github.com/npm/cli/blob/release/v11/lib/commands/publish.js), [Using 2FA](https://docs.npmjs.com/accessing-npm-using-2fa/).

## 9. Prepare a real next change, configure trust, and activate OIDC

A new trusted-publisher connection must complete an actual first publish within **two days**. Do not create it weeks before the next release is ready; skipping the already published `1.0.0` during recovery does not validate the connection.

A real first compatible correction is to remove the now-false unpublished-package notice from README. Do this in a new PR, not by pushing directly to main:

```sh
cd "$PROJECT_DIR"
git fetch origin main
git switch -c fix/published-installation origin/main
```

In README's Installation section replace the unpublished-package sentence with `Install the CLI globally or run it once without a global install:`. Save the file, then:

```sh
git add README.md
git commit -m 'fix: correct installation instructions after npm publication'
git push -u origin fix/published-installation
gh pr create --repo "$REPO" --base main \
  --title 'fix: correct installation instructions after npm publication' \
  --body 'Remove the obsolete unpublished-package notice after the verified 1.0.0 registry release. No CLI or workflow semantics change.'
```

When that PR is reviewed and ready, inspect existing trust and configure the GitHub publisher through CLI:

```sh
npm trust list uszyist --registry="$REGISTRY"
npm trust github uszyist --file release.yml --repository croogie/uszyist \
  --allow-publish --registry="$REGISTRY"
npm trust list uszyist --registry="$REGISTRY"

gh variable set NPM_AUTOMATED_PUBLISH_ENABLED --repo "$REPO" --body true
```

Complete the npm browser/2FA prompt. Do not create a duplicate connection if one already exists. `--allow-publish` is essential: stage-only permission does not allow this workflow's direct `npm publish`. The environment is intentionally omitted because release.yml uses no GitHub environment. No `NPM_TOKEN`, `NODE_AUTH_TOKEN`, or Todoist credential is needed for publication.

Browser alternative: <https://www.npmjs.com/package/uszyist> → **Settings → Trusted publishing / Trusted Publisher** → GitHub Actions. Enter **Organization or user = croogie**, **Repository = uszyist**, **Workflow filename = release.yml**, leave **Environment name** empty, and allow direct **npm publish**. Choose either CLI or UI configuration, not both.

Merge the passing installation-fix PR as `croogie`, then find and inspect the resulting Release Please PR, expected to prepare `1.0.1` if no other releasable changes intervened. Check the actual version, passing required checks, lockfile, changelog, and metadata; merge that release PR as the owner. Watch its Release run. The publication job should now succeed through OIDC and smoke-test the exact registry version. Do not use an empty fake change solely to force a version bump.

Verify provenance for the actual released version on npm's version page; qualifying GitHub OIDC publications from this public source to this public package generate it automatically. No `--provenance` flag or long-lived publishing token is required. If the two-day window expires, revoke the expired trust connection by its observed ID and recreate it only when the next real publication is ready.

Sources: [npm trust GitHub flags](https://docs.npmjs.com/cli/v12/commands/npm-trust/#npm-trust-github), [Trusted Publisher UI/permissions](https://docs.npmjs.com/trusted-publishers/#configuring-trusted-publishing), [Two-day configuration expiry](https://docs.npmjs.com/trusted-publishers/#trusted-publisher-configuration-expiry), [Automatic provenance](https://docs.npmjs.com/trusted-publishers/#automatic-provenance-generation).

## 10. Retire legacy tokens and enable private security reports

Only after a successful real OIDC publication, go to <https://www.npmjs.com/package/uszyist> → **Settings → Publishing access**. Select **Require two-factor authentication and disallow tokens**, then **Update Package Settings**. OIDC remains usable; keep account 2FA and recovery.

List legacy tokens and revoke only obsolete publishing tokens by their ID, not by pasting a raw token:

```sh
npm token list --json
# Replace the placeholder with an obsolete token's ID, not the token value.
npm token revoke 'PASTE_OBSOLETE_TOKEN_ID'
```

If no such token exists, skip revocation. Do not revoke unrelated tokens blindly. Revocation can take up to an hour.

Private vulnerability reporting is independent of npm activation but is part of the agreed project setup:

```sh
gh api --method PUT "repos/$REPO/private-vulnerability-reporting"
gh api "repos/$REPO/private-vulnerability-reporting"
```

The readback should be `{"enabled":true}`. Only after enabling, update SECURITY.md through a normal PR to describe the private channel as operational; until then its disabled-channel warning is intentional.

Sources: [Restricting traditional publishing tokens](https://docs.npmjs.com/trusted-publishers/#recommended-restrict-token-access-when-using-trusted-publishers), [Publishing access settings](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/), [Revoking npm tokens](https://docs.npmjs.com/revoking-access-tokens/), [Private vulnerability reporting API](https://docs.github.com/en/rest/repos/repos#enable-private-vulnerability-reporting-for-a-repository), [Private reporting UI](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).

## Subsequent releases and recovery

Use Conventional Commit squash titles and full SemVer from 1.0.0: breaking changes to commands, flags, documented JSON, exit-code behavior, workflow semantics, or runtime support require a major release, compatible features a minor release, and fixes a patch release. Breaking changes need migration instructions. Exact help wording/table layout is not a stable API. Ordinary merges do not publish; owner merge of a passing release PR authorizes a stable release to `latest`.

Publication is serialized without cancelling a running publish. Release preparation uses the exact tagged commit, validates package/lock versions, builds once through prepack, consumer-smokes the exact tarball, and retains it before publication. The publisher checks identity, embedded package metadata, SHA-512, and registry integrity before uploading the same tarball.

For recovery, use the exact tag, 40-character SHA, and original artifact run ID. The commands below intentionally dispatch publication recovery; run them only for an authorized release and after setting the three observed values:

```sh
TAG='PASTE_EXACT_STABLE_TAG'
SHA='PASTE_40_CHARACTER_RELEASE_SHA'
ORIGIN_RUN_ID='PASTE_ORIGINAL_ARTIFACT_RUN_ID'

gh workflow run release.yml --repo "$REPO" --ref main \
  -f release_tag="$TAG" \
  -f release_sha="$SHA" \
  -f artifact_run_id="$ORIGIN_RUN_ID"
```

Find/watch the dispatch with `gh run list --repo "$REPO" --workflow release.yml --event workflow_dispatch`. The workflow checks out the original SHA and downloads the original 90-day-retained artifact, never newer automation or a rebuilt archive. Matching existing registry integrity skips publishing and repeats exact-version consumer smoke. Missing version (HTTP 404) publishes the same verified tarball. A different integrity, registry failure, or missing artifact stops recovery. With publication activation false, verification can run but publication stays disabled. Never treat unpublish as routine rollback.

Sources: [`gh workflow run`](https://cli.github.com/manual/gh_workflow_run), [`gh run list`](https://cli.github.com/manual/gh_run_list).

## Pinned workflow dependencies

Third-party Actions use full reviewed SHAs and receive Dependabot update PRs, not broad automerge. Current pins: [checkout v4.2.2](https://github.com/actions/checkout/releases/tag/v4.2.2) (`11bd71901bbe5b1630ceea73d27597364c9af683`), [setup-node v4.4.0](https://github.com/actions/setup-node/releases/tag/v4.4.0) (`49933ea5288caeca8642d1e84afbd3f7d6820020`), [upload-artifact v4.6.2](https://github.com/actions/upload-artifact/releases/tag/v4.6.2) (`ea165f8d65b6e75b540449e92b4886f43607fa02`), [download-artifact v4.3.0](https://github.com/actions/download-artifact/releases/tag/v4.3.0) (`d3f86a106a0bac45b974a628896c90dbdf5c8093`), [create-github-app-token v1.11.6](https://github.com/actions/create-github-app-token/releases/tag/v1.11.6) (`21cfef2b496dd8ef5b904c159339626a10ad380e`), [release-please-action v4.4.0](https://github.com/googleapis/release-please-action/releases/tag/v4.4.0) (`16a9c90856f42705d54a6fda1823352bdc62cf38`).

# Contributing

Thanks for improving uszyist. It is a read-only CLI: do not change Todoist data or broaden the documented query semantics without an explicit design and compatibility decision.

## Development setup

Use Node.js 24 or later and npm 11 or later.

```sh
npm ci
npm run check
npm test
npm run smoke:package
```

`npm run smoke:package` packs the project and validates an isolated consumer install. It needs no Todoist token and must not use real task data. Build output is produced by the packaging path; run `npm run build` when working locally on compiled output.

Keep `TODOIST_API_TOKEN` in your environment or secret manager. Do not commit it, pass it on a command line, include it in tests, or put it in issues or pull requests. Use sanitized fixtures and output only.

## Pull requests

Keep each pull request focused, include tests for behavior changes, and explain compatibility impact. CI is required on Linux and macOS with Node 24.0.0, the current 24.x release, and the current 26.x release.

Use a Conventional Commit squash title because Release Please derives versions and changelog entries from it:

- `fix: ...` for compatible bug fixes
- `feat: ...` for compatible features
- `feat!: ...` or a `BREAKING CHANGE:` footer for incompatible changes

The project uses full Semantic Versioning from the initial `1.0.0` release: incompatible changes require a major version, compatible features a minor version, and fixes a patch version. Treat commands, flags, documented JSON schemas, exit-code behavior, workflow semantics, and runtime support as compatibility surfaces. Breaking changes need migration notes.

Do not publish npm packages, create releases, or change release credentials from a contribution. Maintainers control release PRs and publication.

# Security policy

## Supported versions

Security fixes are considered for the latest stable release only, on a best-effort basis. There is no service-level agreement and no promise of backports.

## Reporting a vulnerability

GitHub Private Vulnerability Reporting is the selected private reporting channel, but it was verified **disabled** while this repository was prepared. Do not rely on it until a maintainer enables it and this policy is updated to say so.

Until a private channel is enabled, do not open a public issue for a suspected vulnerability. Contact a repository maintainer through an established private channel. If no private contact is available, do not disclose exploit details publicly; wait for a private reporting route to be published.

Never include any of the following in a report, public issue, pull request, log, or reproduction:

- `TODOIST_API_TOKEN`, npm tokens, GitHub tokens, or other credentials;
- Todoist task titles, notes, identifiers, URLs, activity, or other private task data;
- unredacted command output that can contain that information.

Provide a sanitized reproduction, affected version, Node.js version, operating system, impact, and safe steps to reproduce.

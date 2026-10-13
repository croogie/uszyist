import { fileURLToPath } from "node:url";

const conventionalTitle =
  /^(?:build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(?:\([A-Za-z0-9][A-Za-z0-9._/-]*\))?!?: \S[^\r\n]*$/;

function readArgument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index === process.argv.length - 1) {
    throw new Error(`Missing required ${name} argument.`);
  }
  return process.argv[index + 1];
}

export function validatePullRequest({ title }) {
  if (!conventionalTitle.test(title)) {
    throw new Error(
      "PR title must be a Conventional Commit title, for example 'feat(tasks): add timeline export' or 'feat!: remove deprecated output'."
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    validatePullRequest({
      title: readArgument("--title"),
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

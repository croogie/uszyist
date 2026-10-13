import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  CANONICAL_REPOSITORY,
  PACKAGE_NAME,
  readAndValidateArtifact,
  validateReleaseCheckout,
} from "./release-verify.mjs";

const execFile = promisify(execFileCallback);

function requiredArgument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index === process.argv.length - 1) {
    throw new Error(`Missing required ${name} argument.`);
  }
  return process.argv[index + 1];
}

async function registryRelease(version) {
  let response;
  try {
    response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(PACKAGE_NAME)}/${encodeURIComponent(version)}`,
      { headers: { Accept: "application/json" } }
    );
  } catch (error) {
    throw new Error(
      `Could not query npm registry: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(
      `npm registry returned HTTP ${response.status}; refusing to publish.`
    );
  }
  const release = await response.json();
  if (typeof release?.dist?.integrity !== "string") {
    throw new Error(
      "npm registry response lacks dist.integrity; refusing to publish."
    );
  }
  return release;
}

export async function publishReleaseArtifact({
  artifactDirectory,
  tag,
  sha,
  originRunId,
}) {
  const repository = process.env.GITHUB_REPOSITORY;
  if (repository !== CANONICAL_REPOSITORY) {
    throw new Error(
      `Refusing to publish from ${repository}; expected ${CANONICAL_REPOSITORY}.`
    );
  }
  await validateReleaseCheckout({ repository, tag, sha });
  const { integrity, tarballPath, version } = await readAndValidateArtifact({
    artifactDirectory,
    repository,
    tag,
    sha,
    originRunId,
  });
  const existing = await registryRelease(version);
  if (existing) {
    if (existing.dist.integrity !== integrity) {
      throw new Error(
        "npm already has this version with a different integrity; refusing to continue."
      );
    }
    return { published: false, version };
  }

  await execFile("npm", ["publish", tarballPath, "--tag", "latest"], {
    env: process.env,
  });
  const published = await registryRelease(version);
  if (!published || published.dist.integrity !== integrity) {
    throw new Error(
      "npm registry did not retain the verified release tarball integrity."
    );
  }
  return { published: true, version };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const result = await publishReleaseArtifact({
      artifactDirectory: requiredArgument("--artifact-dir"),
      tag: requiredArgument("--tag"),
      sha: requiredArgument("--sha"),
      originRunId: requiredArgument("--origin-run-id"),
    });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";
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

const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(PACKAGE_NAME)}`;
const visibilityTimeout = 300_000;
const requestTimeout = 15_000;
const pollInterval = 10_000;

async function registryJson(url, accept, timeout, fetchRegistry) {
  try {
    const response = await fetchRegistry(url, {
      headers: { Accept: accept, "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(timeout),
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(
        `npm registry returned HTTP ${response.status}; refusing to continue.`
      );
    }
    const result = await response.json();
    if (result === null) {
      throw new Error("npm registry returned null JSON; refusing to continue.");
    }
    return result;
  } catch (error) {
    throw new Error(
      `Could not query npm registry: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function verifyIntegrity(release, integrity) {
  if (typeof release?.dist?.integrity !== "string") {
    throw new Error(
      "npm registry response lacks dist.integrity; refusing to continue."
    );
  }
  if (release.dist.integrity !== integrity) {
    throw new Error(
      "Registry integrity differs from the verified artifact; refusing to continue."
    );
  }
}

export async function publishVerifiedTarball(
  { version, integrity, tarballPath },
  {
    fetch: fetchRegistry = globalThis.fetch,
    publish = (tarball) =>
      execFile("npm", ["publish", tarball, "--tag", "latest"], {
        env: process.env,
      }),
    now = () => performance.now(),
    sleep: wait = sleep,
    log = (message) => console.error(message),
  } = {}
) {
  const versionUrl = `${registryUrl}/${encodeURIComponent(version)}`;
  const existing = await registryJson(
    versionUrl,
    "application/json",
    requestTimeout,
    fetchRegistry
  );
  if (existing !== null) {
    verifyIntegrity(existing, integrity);
  } else {
    await publish(tarballPath);
  }
  const published = existing === null;
  const deadline = now() + visibilityTimeout;
  const visibilityError = () =>
    new Error(
      `${published ? "npm publish completed, but" : "Existing release found, but"} registry visibility for ${PACKAGE_NAME}@${version} was not confirmed within 300s. Publication may have succeeded. Inspect the exact version before recovery; do not repeat the upload blindly.`
    );
  const query = async (url, accept) => {
    const remaining = Math.ceil(deadline - now());
    if (remaining <= 0) {
      throw visibilityError();
    }
    try {
      const result = await registryJson(
        url,
        accept,
        Math.min(requestTimeout, remaining),
        fetchRegistry
      );
      if (now() >= deadline) {
        throw visibilityError();
      }
      return result;
    } catch (error) {
      if (now() >= deadline) {
        throw visibilityError();
      }
      throw error;
    }
  };
  log(
    `Waiting for ${PACKAGE_NAME}@${version} to become visible in npm registry.`
  );
  while (true) {
    const release = await query(versionUrl, "application/json");
    if (release !== null) {
      verifyIntegrity(release, integrity);
    }
    const metadata = await query(
      registryUrl,
      "application/vnd.npm.install-v1+json"
    );
    let consumerRelease;
    if (metadata !== null) {
      if (
        !metadata?.versions ||
        typeof metadata.versions !== "object" ||
        Array.isArray(metadata.versions)
      ) {
        throw new Error(
          "npm registry response lacks version metadata; refusing to continue."
        );
      }
      if (Object.hasOwn(metadata.versions, version)) {
        consumerRelease = metadata.versions[version];
        verifyIntegrity(consumerRelease, integrity);
      }
    }
    if (release !== null && consumerRelease !== undefined) {
      return { published, version };
    }
    const remaining = deadline - now();
    if (remaining <= 0) {
      throw visibilityError();
    }
    await wait(Math.min(pollInterval, remaining));
  }
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
  return publishVerifiedTarball({ version, integrity, tarballPath });
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

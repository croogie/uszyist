import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);

export const CANONICAL_REPOSITORY = "croogie/uszyist";
export const PACKAGE_NAME = "uszyist";
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const commitSha = /^[0-9a-f]{40}$/;

function requiredArgument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index === process.argv.length - 1) {
    throw new Error(`Missing required ${name} argument.`);
  }
  return process.argv[index + 1];
}

export function versionFromTag(tag) {
  const match = /^v(.+)$/.exec(tag);
  if (!match || !stableVersion.test(match[1])) {
    throw new Error(
      `Release tag must be a stable vX.Y.Z tag; received ${tag}.`
    );
  }
  return match[1];
}

export function validateReleaseDescriptor({
  repository,
  tag,
  sha,
  packageJson,
  lockJson,
}) {
  if (repository !== CANONICAL_REPOSITORY) {
    throw new Error(
      `Refusing to release from ${repository}; expected ${CANONICAL_REPOSITORY}.`
    );
  }
  if (!commitSha.test(sha)) {
    throw new Error(
      "Release SHA must be a full lowercase 40-character commit SHA."
    );
  }

  const version = versionFromTag(tag);
  if (packageJson.name !== PACKAGE_NAME || packageJson.version !== version) {
    throw new Error(
      "package.json name/version does not match the stable release tag."
    );
  }
  if (
    lockJson.name !== PACKAGE_NAME ||
    lockJson.version !== version ||
    lockJson.packages?.[""]?.name !== PACKAGE_NAME ||
    lockJson.packages[""].version !== version
  ) {
    throw new Error(
      "package-lock.json name/version does not match the stable release tag."
    );
  }
  return version;
}

export async function validateReleaseCheckout({ repository, tag, sha }) {
  const [packageText, lockText] = await Promise.all([
    readFile("package.json", "utf8"),
    readFile("package-lock.json", "utf8"),
  ]);
  const version = validateReleaseDescriptor({
    repository,
    tag,
    sha,
    packageJson: JSON.parse(packageText),
    lockJson: JSON.parse(lockText),
  });

  const { stdout: head } = await execFile("git", ["rev-parse", "HEAD"]);
  if (head.trim() !== sha) {
    throw new Error(
      "Checked-out commit does not match the declared release SHA."
    );
  }
  const { stdout: tagCommit } = await execFile("git", [
    "rev-parse",
    "--verify",
    `${tag}^{commit}`,
  ]);
  if (tagCommit.trim() !== sha) {
    throw new Error("Release tag does not point to the declared release SHA.");
  }
  return version;
}

export function readTarPackageJson(tarball) {
  const archive = gunzipSync(tarball);
  for (let offset = 0; offset < archive.length; ) {
    if (offset + 512 > archive.length) {
      throw new Error("Tarball ends before a complete archive header.");
    }
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      break;
    }
    const sizeText = header
      .subarray(124, 136)
      .toString("utf8")
      .replace(/\0.*$/, "")
      .trim();
    if (!/^[0-7]*$/.test(sizeText)) {
      throw new Error("Tarball has an invalid archive entry size.");
    }
    const size = Number.parseInt(sizeText || "0", 8);
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const prefix = header
      .subarray(345, 500)
      .toString("utf8")
      .replace(/\0.*$/, "");
    const entryName = prefix ? `${prefix}/${name}` : name;
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    if (contentEnd > archive.length) {
      throw new Error("Tarball archive entry exceeds its payload.");
    }
    if (entryName === "package/package.json") {
      return JSON.parse(
        archive.subarray(contentStart, contentEnd).toString("utf8")
      );
    }
    offset = contentStart + Math.ceil(size / 512) * 512;
  }
  throw new Error("Tarball does not contain package/package.json.");
}

export function validateTarPackage(tarball, version) {
  const tarPackage = readTarPackageJson(tarball);
  if (tarPackage.name !== PACKAGE_NAME || tarPackage.version !== version) {
    throw new Error(
      "Retained tarball package.json does not match the stable release tag."
    );
  }
}

export async function readAndValidateArtifact({
  artifactDirectory,
  repository,
  tag,
  sha,
  originRunId,
}) {
  const metadataPath = path.join(artifactDirectory, "release-metadata.json");
  const tarballPath = path.join(artifactDirectory, "package.tgz");
  const [metadataText, tarball] = await Promise.all([
    readFile(metadataPath, "utf8"),
    readFile(tarballPath),
  ]);
  const metadata = JSON.parse(metadataText);
  const version = validateReleaseDescriptor({
    repository,
    tag,
    sha,
    packageJson: { name: metadata.packageName, version: metadata.version },
    lockJson: {
      name: metadata.packageName,
      version: metadata.version,
      packages: {
        "": { name: metadata.packageName, version: metadata.version },
      },
    },
  });
  if (
    metadata.schemaVersion !== 1 ||
    metadata.tag !== tag ||
    metadata.sha !== sha ||
    metadata.originRunId !== originRunId ||
    metadata.tarball !== "package.tgz"
  ) {
    throw new Error(
      "Retained release metadata does not identify this exact release artifact."
    );
  }
  validateTarPackage(tarball, version);

  const sha512 = createHash("sha512").update(tarball).digest("hex");
  const integrity = `sha512-${createHash("sha512").update(tarball).digest("base64")}`;
  if (metadata.sha512 !== sha512 || metadata.integrity !== integrity) {
    throw new Error(
      "Retained tarball checksum does not match its release metadata."
    );
  }
  return { integrity, tarballPath, version };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const artifactDirectory = requiredArgument("--artifact-dir");
    const tag = requiredArgument("--tag");
    const sha = requiredArgument("--sha");
    const originRunId = requiredArgument("--origin-run-id");
    const repository = process.env.GITHUB_REPOSITORY;
    await validateReleaseCheckout({ repository, tag, sha });
    await readAndValidateArtifact({
      artifactDirectory,
      repository,
      tag,
      sha,
      originRunId,
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateReleaseCheckout } from "./release-verify.mjs";

const execFile = promisify(execFileCallback);

function requiredArgument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index === process.argv.length - 1) {
    throw new Error(`Missing required ${name} argument.`);
  }
  return process.argv[index + 1];
}

function validateRunId(runId) {
  if (!/^\d+$/.test(runId)) {
    throw new Error(
      "Originating GitHub Actions run ID must contain only decimal digits."
    );
  }
}

export async function prepareReleaseArtifact({
  outDirectory,
  repository,
  tag,
  sha,
  runId,
}) {
  validateRunId(runId);
  const version = await validateReleaseCheckout({ repository, tag, sha });
  await mkdir(outDirectory);

  const { stdout } = await execFile("npm", [
    "pack",
    "--json",
    "--pack-destination",
    outDirectory,
  ]);
  const packed = JSON.parse(stdout);
  if (
    !Array.isArray(packed) ||
    packed.length !== 1 ||
    typeof packed[0]?.filename !== "string" ||
    packed[0].name !== "uszyist" ||
    packed[0].version !== version
  ) {
    throw new Error("npm pack did not return this exact release package.");
  }

  const generatedTarball = path.join(outDirectory, packed[0].filename);
  const tarballPath = path.join(outDirectory, "package.tgz");
  await rename(generatedTarball, tarballPath);
  const tarball = await readFile(tarballPath);
  const sha512 = createHash("sha512").update(tarball).digest("hex");
  const integrity = `sha512-${createHash("sha512").update(tarball).digest("base64")}`;
  const metadata = {
    schemaVersion: 1,
    packageName: "uszyist",
    version,
    tag,
    sha,
    originRunId: runId,
    tarball: "package.tgz",
    sha512,
    integrity,
  };
  await writeFile(
    path.join(outDirectory, "release-metadata.json"),
    `${JSON.stringify(metadata, null, 2)}\n`
  );
  return { integrity, tarballPath, version };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await prepareReleaseArtifact({
      outDirectory: requiredArgument("--out-dir"),
      repository: process.env.GITHUB_REPOSITORY,
      tag: requiredArgument("--tag"),
      sha: requiredArgument("--sha"),
      runId: requiredArgument("--run-id"),
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync } from "node:zlib";

import {
  readTarPackageJson,
  validateReleaseDescriptor,
  validateTarPackage,
  versionFromTag,
} from "../scripts/release-verify.mjs";
import { validatePullRequest } from "../scripts/release-validate-pr-title.mjs";

function descriptor(overrides: Record<string, unknown> = {}) {
  const packageJson = { name: "uszyist", version: "1.2.3" };
  const lockJson = {
    name: "uszyist",
    version: "1.2.3",
    packages: { "": { name: "uszyist", version: "1.2.3" } },
  };
  return {
    repository: "croogie/uszyist",
    tag: "v1.2.3",
    sha: "a".repeat(40),
    packageJson,
    lockJson,
    ...overrides,
  };
}

function tarballWithPackageJson(packageJson: object) {
  const content = Buffer.from(JSON.stringify(packageJson));
  const header = Buffer.alloc(512);
  header.write("package/package.json");
  header.write(`${content.length.toString(8).padStart(11, "0")}\0`, 124);
  header.write("0", 156);
  const padding = Buffer.alloc((512 - (content.length % 512)) % 512);
  return gzipSync(
    Buffer.concat([header, content, padding, Buffer.alloc(1024)])
  );
}

test("release descriptor accepts only matching stable canonical metadata", () => {
  assert.equal(validateReleaseDescriptor(descriptor()), "1.2.3");
  assert.equal(versionFromTag("v1.0.0"), "1.0.0");
  assert.throws(() => versionFromTag("v1.2.3-rc.1"));
  assert.throws(() =>
    validateReleaseDescriptor(descriptor({ repository: "fork/uszyist" }))
  );
  assert.throws(() =>
    validateReleaseDescriptor(
      descriptor({
        lockJson: {
          name: "uszyist",
          version: "1.2.2",
          packages: { "": { name: "uszyist", version: "1.2.2" } },
        },
      })
    )
  );
});

test("tarball package metadata is read from the compressed archive", () => {
  const tarball = tarballWithPackageJson({ name: "uszyist", version: "1.2.3" });
  assert.deepEqual(readTarPackageJson(tarball), {
    name: "uszyist",
    version: "1.2.3",
  });
  assert.throws(() => validateTarPackage(tarball, "1.2.4"));
});

test("pull request titles reject missing Conventional Commit metadata and multiline input", () => {
  for (const title of [
    "release 1.0.0",
    "feat: ",
    "fix:   ",
    "fix: first\nfeat: second",
  ]) {
    assert.throws(() => validatePullRequest({ title }));
  }
});

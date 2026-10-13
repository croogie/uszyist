import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const groups = {
  tasks: [
    "list",
    "timeline",
    "day-tasks",
    "current",
    "next",
    "elapsed",
    "deadlines",
  ],
  planning: ["status"],
  activity: ["list"],
};
const args = process.argv.slice(2);
assert(
  args.length === 0 ||
    (args.length === 2 && ["--tarball", "--registry"].includes(args[0])),
  "Usage: node scripts/package-smoke.mjs [--tarball PATH | --registry VERSION]"
);
if (args[0] === "--registry") {
  assert(
    /^\d+\.\d+\.\d+$/.test(args[1]),
    "Registry version must be exact and stable"
  );
}
const temporary = await mkdtemp(path.join(tmpdir(), "uszyist-consumer-"));
const env = { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", CI: "true" };
for (const key of Object.keys(env)) {
  if (key.startsWith("TODOIST_") || key.startsWith("USZYIST_")) delete env[key];
}
// Do not reuse a contributor's private npm configuration in the consumer.
env.npm_config_userconfig = path.join(temporary, ".npmrc");
env.npm_config_registry = "https://registry.npmjs.org/";
env.npm_config_cache = path.join(temporary, "npm-cache");
delete env.NODE_PATH;
delete env.NODE_OPTIONS;

function run(executable, arguments_, cwd = temporary) {
  const result = spawnSync(executable, arguments_, {
    cwd,
    env,
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    0,
    `${path.basename(executable)} ${arguments_.join(" ")} failed:\n${result.stdout}\n${result.stderr}`
  );
  return result.stdout.replace(/\u001b\[[0-9;]*m/g, "");
}

function npm(arguments_, cwd) {
  const npmCli =
    process.env.npm_execpath ||
    (process.platform === "win32"
      ? path.join(
          path.dirname(process.execPath),
          "node_modules",
          "npm",
          "bin",
          "npm-cli.js"
        )
      : undefined);
  return npmCli
    ? run(process.execPath, [npmCli, ...arguments_], cwd)
    : run("npm", arguments_, cwd);
}

// Inspect actual gzip/tar bytes, not npm's predicted dry-run file list.
// npm's bounded payload uses regular ustar entries; reject links and extensions.
function inspectTarball(compressed) {
  const tar = gunzipSync(compressed);
  const entries = new Map();
  const text = (start, length) =>
    tar
      .subarray(start, start + length)
      .toString("utf8")
      .split("\0")[0];
  let offset = 0;
  while (offset + 512 <= tar.length && tar[offset] !== 0) {
    const name = [text(offset + 345, 155), text(offset, 100)]
      .filter(Boolean)
      .join("/");
    const size = Number.parseInt(text(offset + 124, 12).trim(), 8);
    const type = text(offset + 156, 1);
    assert(
      Number.isSafeInteger(size) && size >= 0,
      `Invalid tar size: ${name}`
    );
    assert(type === "" || type === "0", `Non-regular package entry: ${name}`);
    assert(!entries.has(name), `Duplicate package entry: ${name}`);
    assert(
      offset + 512 + size <= tar.length,
      `Truncated package entry: ${name}`
    );
    assert(
      [
        "package/package.json",
        "package/README.md",
        "package/LICENSE",
        "package/bin/run.js",
      ].includes(name) ||
        /^package\/dist\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.js$/.test(name),
      `Unselected file shipped: ${name}`
    );
    entries.set(name, tar.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  for (const required of [
    "package/package.json",
    "package/README.md",
    "package/LICENSE",
    "package/bin/run.js",
  ]) {
    assert(entries.has(required), `Missing package asset: ${required}`);
  }
  for (const [group, commands] of Object.entries(groups)) {
    for (const command of commands) {
      const required = `package/dist/commands/${group}/${command}.js`;
      assert(entries.has(required), `Missing compiled command: ${required}`);
    }
  }
  assert(
    entries
      .get("package/bin/run.js")
      .toString()
      .startsWith("#!/usr/bin/env node\n"),
    "Missing Node shebang"
  );
  const metadata = JSON.parse(entries.get("package/package.json").toString());
  assert.equal(metadata.name, "uszyist");
  assert.equal(metadata.bin.uszyist, "bin/run.js");
  assert.equal(metadata.oclif.commands, "./dist/commands");
  assert.equal(metadata.license, "MIT");
  assert.notEqual(metadata.private, true);
  for (const hook of ["preinstall", "install", "postinstall"]) {
    assert(
      !metadata.scripts?.[hook],
      `Consumer install hook is forbidden: ${hook}`
    );
  }
  return { metadata, count: entries.size };
}

try {
  await writeFile(env.npm_config_userconfig, "");
  let tarball;
  if (args[0] === "--tarball") {
    tarball = path.resolve(args[1]);
  } else {
    const packArgs = ["pack", "--json", "--pack-destination", temporary];
    if (args[0] === "--registry")
      packArgs.push(`uszyist@${args[1]}`, "--ignore-scripts");
    const packed = JSON.parse(npm(packArgs, args.length ? temporary : root));
    assert.equal(packed.length, 1, "Expected exactly one packed artifact");
    tarball = path.join(temporary, packed[0].filename);
  }
  const { metadata, count } = inspectTarball(await readFile(tarball));
  if (args[0] === "--registry") assert.equal(metadata.version, args[1]);
  await writeFile(path.join(temporary, "package.json"), '{"private":true}\n');
  npm(["install", "--omit=dev", "--no-audit", "--no-fund", tarball]);
  const installed = JSON.parse(
    await readFile(
      path.join(temporary, "node_modules", "uszyist", "package.json"),
      "utf8"
    )
  );
  assert.equal(installed.version, metadata.version);
  const launcher = path.join(
    temporary,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "uszyist.cmd" : "uszyist"
  );
  const cli = (arguments_) =>
    process.platform === "win32"
      ? run("cmd.exe", [
          "/d",
          "/s",
          "/c",
          `\"${launcher}\" ${arguments_.join(" ")}`,
        ])
      : run(launcher, arguments_);
  const rootHelp = cli(["--help"]);
  for (const [group, commands] of Object.entries(groups)) {
    assert(
      new RegExp(`\\b${group}\\b`).test(rootHelp),
      `Root help omits ${group}`
    );
    const groupHelp = cli([group, "--help"]);
    for (const command of commands) {
      assert(
        new RegExp(`\\b${group}[ :]+${command}(?=\\s|$)`).test(groupHelp),
        `Group help omits ${group} ${command}`
      );
      cli([group, command, "--help"]);
    }
  }
  const version = cli(["--version"]);
  assert(
    version.includes(`uszyist/${metadata.version} `),
    `Installed version mismatch: ${version.trim()}`
  );
  console.log(
    `Consumer smoke passed: uszyist@${metadata.version}; ${count} selected files; 3 groups; 9 command helps; npm launcher and version.`
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}

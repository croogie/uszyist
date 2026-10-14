import assert from "node:assert/strict";
import test from "node:test";

import { publishVerifiedTarball } from "../scripts/release-publish.mjs";

const artifact = {
  version: "1.2.3",
  integrity: "sha512-verified",
  tarballPath: "/verified/package.tgz",
};
const release = { dist: { integrity: artifact.integrity } };

test("publication waits for version and consumer metadata without uploading twice", async () => {
  let uploaded = false;
  let clock = 0;
  let consumerVisible = false;
  let uploads = 0;
  const result = await publishVerifiedTarball(artifact, {
    fetch: async (url: string) => {
      if (!uploaded || clock === 0) return new Response(null, { status: 404 });
      if (url.endsWith("/1.2.3")) return Response.json(release);
      consumerVisible = clock >= 20_000;
      return Response.json({
        versions: consumerVisible ? { "1.2.3": release } : {},
      });
    },
    publish: async () => {
      uploads++;
      uploaded = true;
    },
    now: () => clock,
    sleep: async (milliseconds: number) => {
      clock += milliseconds;
    },
    log: () => {},
  });
  assert.deepEqual(result, { published: true, version: "1.2.3" });
  assert.equal(uploads, 1);
  assert.equal(consumerVisible, true);
});

function runtime(
  respond: (
    url: string,
    elapsed: number,
    uploads: number
  ) => Response | Promise<Response>
) {
  const state = { elapsed: 0, uploads: 0 };
  return {
    state,
    io: {
      fetch: async (url: string) => respond(url, state.elapsed, state.uploads),
      publish: async () => {
        state.uploads++;
      },
      now: () => state.elapsed,
      sleep: async (milliseconds: number) => {
        state.elapsed += milliseconds;
      },
      log: () => {},
    },
  };
}

test("recovery waits for consumer metadata without uploading an existing version", async () => {
  const { state, io } = runtime((url, elapsed) =>
    Response.json(
      url.endsWith("/1.2.3")
        ? release
        : { versions: elapsed >= 10_000 ? { "1.2.3": release } : {} }
    )
  );
  assert.deepEqual(await publishVerifiedTarball(artifact, io), {
    published: false,
    version: "1.2.3",
  });
  assert.equal(state.uploads, 0);
  assert.equal(state.elapsed, 10_000);
});

for (const endpoint of ["preflight", "version", "consumer"]) {
  for (const defect of ["different", "missing"]) {
    test(`${endpoint} integrity ${defect} stops without retrying publication`, async () => {
      const invalid =
        defect === "different" ? { dist: { integrity: "sha512-other" } } : {};
      const { state, io } = runtime((url, _elapsed, uploads) => {
        if (uploads === 0) {
          return endpoint === "preflight"
            ? Response.json(invalid)
            : new Response(null, { status: 404 });
        }
        if (url.endsWith("/1.2.3")) {
          return Response.json(endpoint === "version" ? invalid : release);
        }
        return Response.json({ versions: { "1.2.3": invalid } });
      });
      await assert.rejects(
        publishVerifiedTarball(artifact, io),
        defect === "different" ? /integrity differs/ : /lacks dist.integrity/
      );
      assert.equal(state.uploads, endpoint === "preflight" ? 0 : 1);
      assert.equal(state.elapsed, 0);
    });
  }
}

test("visibility deadline expires without another upload", async () => {
  const { state, io } = runtime(() => new Response(null, { status: 404 }));
  await assert.rejects(
    publishVerifiedTarball(artifact, io),
    /npm publish completed.*not confirmed within 300s.*Inspect the exact version before recovery/
  );
  assert.equal(state.elapsed, 300_000);
  assert.equal(state.uploads, 1);
});

test("recovery deadline covers missing consumer metadata", async () => {
  const { state, io } = runtime((url) =>
    Response.json(url.endsWith("/1.2.3") ? release : { versions: {} })
  );
  await assert.rejects(
    publishVerifiedTarball(artifact, io),
    /Existing release found.*not confirmed within 300s/
  );
  assert.equal(state.elapsed, 300_000);
  assert.equal(state.uploads, 0);
});

test("both HTTP requests and sleep consume one visibility deadline", async () => {
  const { state, io } = runtime(() => {
    if (state.uploads)
      state.elapsed += Math.min(7_000, 300_000 - state.elapsed);
    return new Response(null, { status: 404 });
  });
  await assert.rejects(publishVerifiedTarball(artifact, io), /within 300s/);
  assert.equal(state.elapsed, 300_000);
  assert.equal(state.uploads, 1);
});

for (const status of [401, 403, 429, 500]) {
  test(`HTTP ${status} during visibility checking is not retried`, async () => {
    const { state, io } = runtime(
      (_url, _elapsed, uploads) =>
        new Response(null, { status: uploads ? status : 404 })
    );
    await assert.rejects(
      publishVerifiedTarball(artifact, io),
      new RegExp(`HTTP ${status}`)
    );
    assert.equal(state.elapsed, 0);
    assert.equal(state.uploads, 1);
  });
}

test("network errors are not treated as missing versions", async () => {
  const { state, io } = runtime(() => {
    throw new Error("connection refused");
  });
  await assert.rejects(
    publishVerifiedTarball(artifact, io),
    /connection refused/
  );
  assert.equal(state.uploads, 0);
  assert.equal(state.elapsed, 0);
});

test("malformed consumer metadata fails rather than timing out", async () => {
  const { state, io } = runtime((url) =>
    Response.json(url.endsWith("/1.2.3") ? release : {})
  );
  await assert.rejects(
    publishVerifiedTarball(artifact, io),
    /lacks version metadata/
  );
  assert.equal(state.uploads, 0);
  assert.equal(state.elapsed, 0);
});

test("failed upload is never retried or checked as successful", async () => {
  const { state, io } = runtime(() => new Response(null, { status: 404 }));
  io.publish = async () => {
    state.uploads++;
    throw new Error("npm publish failed");
  };
  await assert.rejects(
    publishVerifiedTarball(artifact, io),
    /npm publish failed/
  );
  assert.equal(state.uploads, 1);
  assert.equal(state.elapsed, 0);
});

test("a stalled JSON body is aborted within the remaining shared deadline", async (t) => {
  let clock = 0;
  let versionRequests = 0;
  t.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
    const controller = new AbortController();
    if (milliseconds < 15_000) {
      queueMicrotask(() => {
        clock += milliseconds;
        controller.abort(new DOMException("Request timed out", "TimeoutError"));
      });
    }
    return controller.signal;
  });
  await assert.rejects(
    publishVerifiedTarball(artifact, {
      fetch: async (url: string, options: { signal: AbortSignal }) => {
        if (url.endsWith("/1.2.3")) {
          if (++versionRequests === 2) clock = 299_990;
          return Response.json(release);
        }
        return new Response(
          new ReadableStream({
            start(controller) {
              options.signal.addEventListener(
                "abort",
                () => {
                  controller.error(options.signal.reason);
                },
                { once: true }
              );
            },
          })
        );
      },
      publish: async () => {
        assert.fail("Recovery must not upload");
      },
      now: () => clock,
      log: () => {},
    }),
    /Existing release found.*not confirmed within 300s/
  );
  assert.equal(clock, 300_000);
});

test("network failure after upload stops without another upload", async () => {
  const { state, io } = runtime((_url, _elapsed, uploads) => {
    if (uploads) throw new Error("connection reset");
    return new Response(null, { status: 404 });
  });
  await assert.rejects(
    publishVerifiedTarball(artifact, io),
    /connection reset/
  );
  assert.equal(state.uploads, 1);
  assert.equal(state.elapsed, 0);
});

test("a null registry JSON response must not authorize an upload", async () => {
  const { state, io } = runtime(() => Response.json(null));
  await assert.rejects(publishVerifiedTarball(artifact, io), /null JSON/);
  assert.equal(state.uploads, 0);
});

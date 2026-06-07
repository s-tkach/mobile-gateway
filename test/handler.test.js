const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { handler } = require("../src/handler");

const ENV = {
  IOS_URL: "https://apps.apple.com/app/id123",
  ANDROID_URL: "https://play.google.com/store/apps/details?id=com.x",
  DEFAULT_URL: "https://example.com/get-the-app",
  STATS_TOKEN: "secret-token",
};

beforeEach(() => {
  Object.assign(process.env, ENV);
});

// Build a Lambda Function URL event.
function event({ path = "/", ua = "", query = null } = {}) {
  return {
    requestContext: { http: { method: "GET", path } },
    headers: ua ? { "user-agent": ua } : {},
    queryStringParameters: query,
  };
}

// Capture recordClick calls; stub getStats.
function makeDeps(statsResult = { total: 0 }) {
  const recorded = [];
  return {
    recorded,
    deps: {
      recordClick: async (click) => {
        recorded.push(click);
      },
      getStats: async () => statsResult,
    },
  };
}

test("iPhone request redirects 302 to IOS_URL", async () => {
  const { deps } = makeDeps();
  const res = await handler(
    event({ ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" }),
    deps
  );
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, ENV.IOS_URL);
  assert.equal(res.headers["Cache-Control"], "no-store");
});

test("Android request redirects 302 to ANDROID_URL", async () => {
  const { deps } = makeDeps();
  const res = await handler(event({ ua: "Mozilla/5.0 (Linux; Android 14)" }), deps);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, ENV.ANDROID_URL);
});

test("desktop request redirects 302 to DEFAULT_URL", async () => {
  const { deps } = makeDeps();
  const res = await handler(event({ ua: "Mozilla/5.0 (Macintosh)" }), deps);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, ENV.DEFAULT_URL);
});

test("redirect records a click with the classified device", async () => {
  const { deps, recorded } = makeDeps();
  await handler(event({ ua: "iPhone" }), deps);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].device, "ios");
});

test("redirect still happens when recordClick throws", async () => {
  const recorded = [];
  const deps = {
    recordClick: async () => {
      throw new Error("dynamo down");
    },
    getStats: async () => ({}),
  };
  const res = await handler(event({ ua: "Android" }), deps);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, ENV.ANDROID_URL);
});

test("/stats without token returns 401", async () => {
  const { deps } = makeDeps();
  const res = await handler(event({ path: "/stats" }), deps);
  assert.equal(res.statusCode, 401);
});

test("/stats with wrong token returns 401", async () => {
  const { deps } = makeDeps();
  const res = await handler(
    event({ path: "/stats", query: { token: "wrong" } }),
    deps
  );
  assert.equal(res.statusCode, 401);
});

test("/stats with correct token returns 200 JSON stats", async () => {
  const { deps } = makeDeps({ total: 7, ios: 4, android: 3, other: 0 });
  const res = await handler(
    event({ path: "/stats", query: { token: ENV.STATS_TOKEN } }),
    deps
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Content-Type"], "application/json");
  const body = JSON.parse(res.body);
  assert.equal(body.total, 7);
  assert.equal(body.ios, 4);
});

test("/stats does not record a click", async () => {
  const { deps, recorded } = makeDeps();
  await handler(event({ path: "/stats", query: { token: ENV.STATS_TOKEN } }), deps);
  assert.equal(recorded.length, 0);
});

test("/favicon.ico does not record a click", async () => {
  const { deps, recorded } = makeDeps();
  const res = await handler(event({ path: "/favicon.ico", ua: "Chrome" }), deps);
  assert.equal(res.statusCode, 302);
  assert.equal(recorded.length, 0);
});

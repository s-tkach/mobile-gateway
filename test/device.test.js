const { test } = require("node:test");
const assert = require("node:assert/strict");
const { classifyDevice } = require("../src/device");

test("iPhone user-agent classifies as ios", () => {
  const ua =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
  assert.equal(classifyDevice(ua), "ios");
});

test("iPad user-agent classifies as ios", () => {
  const ua = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
  assert.equal(classifyDevice(ua), "ios");
});

test("iPod user-agent classifies as ios", () => {
  const ua = "Mozilla/5.0 (iPod touch; CPU iPhone OS 16_0 like Mac OS X)";
  assert.equal(classifyDevice(ua), "ios");
});

test("Android phone user-agent classifies as android", () => {
  const ua =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120";
  assert.equal(classifyDevice(ua), "android");
});

test("desktop macOS user-agent classifies as other", () => {
  const ua =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120";
  assert.equal(classifyDevice(ua), "other");
});

test("desktop Windows user-agent classifies as other", () => {
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120";
  assert.equal(classifyDevice(ua), "other");
});

test("empty user-agent classifies as other", () => {
  assert.equal(classifyDevice(""), "other");
});

test("undefined user-agent classifies as other", () => {
  assert.equal(classifyDevice(undefined), "other");
});

test("classification is case-insensitive", () => {
  assert.equal(classifyDevice("some iphone ua"), "ios");
  assert.equal(classifyDevice("some ANDROID ua"), "android");
});

"use strict";

const { classifyDevice } = require("./device");
const clicks = require("./clicks");

const TARGETS = {
  ios: () => process.env.IOS_URL,
  android: () => process.env.ANDROID_URL,
  other: () => process.env.DEFAULT_URL,
};

function redirect(location) {
  return {
    statusCode: 302,
    headers: { Location: location, "Cache-Control": "no-store" },
  };
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

/**
 * Lambda Function URL handler.
 *
 * @param {object} event - Function URL event
 * @param {{recordClick?:Function, getStats?:Function}} [deps] - injectable for tests
 */
async function handler(event, deps = {}) {
  const recordClick = deps.recordClick || clicks.recordClick;
  const getStats = deps.getStats || clicks.getStats;

  const path = event?.requestContext?.http?.path || "/";
  const headers = event?.headers || {};
  const query = event?.queryStringParameters || {};

  // --- Stats endpoint ---
  if (path === "/stats" || path === "/stats/") {
    if (!process.env.STATS_TOKEN || query.token !== process.env.STATS_TOKEN) {
      return json(401, { error: "unauthorized" });
    }
    const stats = await getStats({ limit: 20 });
    return json(200, stats);
  }

  // --- Redirect (all other paths) ---
  const ua = headers["user-agent"] || headers["User-Agent"] || "";
  const device = classifyDevice(ua);
  const country = headers["cloudfront-viewer-country"] || null;
  const ip = headers["x-forwarded-for"]
    ? headers["x-forwarded-for"].split(",")[0].trim()
    : null;

  // Logging must never block the redirect.
  try {
    await recordClick({ device, ua, country, ip });
  } catch (err) {
    console.error("recordClick failed:", err);
  }

  const target = TARGETS[device]();
  return redirect(target);
}

module.exports = { handler };

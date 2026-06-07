"use strict";

/**
 * Classify a visitor's device from its User-Agent string.
 *
 * @param {string|undefined} userAgent - raw User-Agent header value
 * @returns {"ios"|"android"|"other"}
 */
function classifyDevice(userAgent) {
  const ua = userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

module.exports = { classifyDevice };

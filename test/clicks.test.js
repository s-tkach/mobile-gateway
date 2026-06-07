const { test } = require("node:test");
const assert = require("node:assert/strict");
const { recordClick, getStats } = require("../src/clicks");

// Minimal fake DocumentClient: records the commands it was sent and returns
// a canned response for Query.
function makeFakeClient(queryItems = []) {
  const sent = [];
  return {
    sent,
    async send(command) {
      sent.push(command);
      // Identify the command by its constructor name.
      if (command.constructor.name === "QueryCommand") {
        return { Items: queryItems };
      }
      return {};
    },
  };
}

test("recordClick writes an item with pk=CLICK and device/ua/country", async () => {
  const client = makeFakeClient();
  await recordClick(
    { device: "ios", ua: "iPhone UA", country: "US", ip: "1.2.3.4" },
    { client, tableName: "T" }
  );

  assert.equal(client.sent.length, 1);
  const input = client.sent[0].input;
  assert.equal(input.TableName, "T");
  assert.equal(input.Item.pk, "CLICK");
  assert.match(input.Item.sk, /#/); // "<iso>#<uuid>"
  assert.equal(input.Item.device, "ios");
  assert.equal(input.Item.ua, "iPhone UA");
  assert.equal(input.Item.country, "US");
  assert.ok(typeof input.Item.ts === "string");
});

test("recordClick hashes the ip (does not store raw ip)", async () => {
  const client = makeFakeClient();
  await recordClick(
    { device: "android", ua: "x", country: null, ip: "9.9.9.9" },
    { client, tableName: "T" }
  );
  const item = client.sent[0].input.Item;
  assert.ok(item.ipHash, "expected an ipHash field");
  assert.notEqual(item.ipHash, "9.9.9.9");
  assert.equal(item.ip, undefined, "raw ip must not be stored");
});

test("recordClick handles missing country/ip gracefully", async () => {
  const client = makeFakeClient();
  await recordClick({ device: "other", ua: "x" }, { client, tableName: "T" });
  const item = client.sent[0].input.Item;
  assert.equal(item.country, null);
  assert.equal(item.ipHash, null);
});

test("getStats aggregates counts by device", async () => {
  const items = [
    { device: "ios", ts: "2026-06-07T10:00:00Z" },
    { device: "ios", ts: "2026-06-07T09:00:00Z" },
    { device: "android", ts: "2026-06-07T08:00:00Z" },
    { device: "other", ts: "2026-06-07T07:00:00Z" },
  ];
  const client = makeFakeClient(items);
  const stats = await getStats({ client, tableName: "T" });

  assert.equal(stats.total, 4);
  assert.equal(stats.ios, 2);
  assert.equal(stats.android, 1);
  assert.equal(stats.other, 1);
  assert.equal(stats.recent, undefined);
});

test("getStats queries pk=CLICK descending without a row Limit (counts need all rows)", async () => {
  const client = makeFakeClient([]);
  await getStats({ client, tableName: "T" });
  const input = client.sent[0].input;
  assert.equal(input.TableName, "T");
  assert.equal(input.ScanIndexForward, false);
  assert.equal(input.Limit, undefined);
  assert.equal(input.ExpressionAttributeValues[":pk"], "CLICK");
});

test("getStats handles empty table", async () => {
  const client = makeFakeClient([]);
  const stats = await getStats({ client, tableName: "T" });
  assert.equal(stats.total, 0);
  assert.equal(stats.ios, 0);
  assert.equal(stats.recent, undefined);
});

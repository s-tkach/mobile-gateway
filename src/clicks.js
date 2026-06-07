"use strict";

const crypto = require("node:crypto");
const { v4: uuidv4 } = require("uuid");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");

const PARTITION = "CLICK";

// Lazily-created default client so unit tests (which inject their own) never
// touch AWS, and the Lambda reuses one client across warm invocations.
let defaultClient;
function getDefaultClient() {
  if (!defaultClient) {
    defaultClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }
  return defaultClient;
}

function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash("sha256").update(String(ip)).digest("hex");
}

/**
 * Persist a single click as one DynamoDB item.
 *
 * @param {{device:string, ua?:string, country?:string|null, ip?:string|null}} click
 * @param {{client?:object, tableName?:string}} [deps]
 */
async function recordClick(click, deps = {}) {
  const client = deps.client || getDefaultClient();
  const tableName = deps.tableName || process.env.TABLE_NAME;
  const ts = new Date().toISOString();

  const item = {
    pk: PARTITION,
    sk: `${ts}#${uuidv4()}`,
    ts,
    device: click.device,
    ua: click.ua || null,
    country: click.country ?? null,
    ipHash: hashIp(click.ip),
  };

  await client.send(new PutCommand({ TableName: tableName, Item: item }));
}

/**
 * Aggregate click counts by device type.
 *
 * @param {{client?:object, tableName?:string}} [deps]
 * @returns {Promise<{total:number, ios:number, android:number, other:number}>}
 */
async function getStats(deps = {}) {
  const client = deps.client || getDefaultClient();
  const tableName = deps.tableName || process.env.TABLE_NAME;

  const res = await client.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": PARTITION },
      ScanIndexForward: false,
    })
  );

  const items = res.Items || [];
  const stats = { total: items.length, ios: 0, android: 0, other: 0 };
  for (const it of items) {
    if (it.device === "ios") stats.ios += 1;
    else if (it.device === "android") stats.android += 1;
    else stats.other += 1;
  }
  return stats;
}

module.exports = { recordClick, getStats };

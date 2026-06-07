# mobile-gateway

A tiny self-hosted, Dub-style redirect link for AWS. One link detects the
visitor's device and redirects:

- **iPhone / iPad / iPod** → your Apple App Store URL
- **Android** → your Google Play Store URL
- **everything else** → a fallback URL (your landing page)

Every click is logged to DynamoDB (device, timestamp, country, hashed IP), and a
token-protected `/stats` endpoint returns the totals as JSON.

It's one AWS Lambda behind a **Function URL** plus one DynamoDB table — **no API
Gateway, no servers, ~$0/month** at low traffic (Lambda's 1M-request/month free
tier is permanent; DynamoDB on-demand stays within the 25 GB free tier).

## Architecture

```
User taps link
  → Lambda Function URL  (https://<id>.lambda-url.<region>.on.aws/)
    → classify User-Agent → ios | android | other
    → log click to DynamoDB (failures never block the redirect)
    → 302 redirect to the matching store URL

You → /stats?token=SECRET → DynamoDB Query → { total, ios, android, other, recent[] }
```

## Project layout

```
src/
  device.js     classifyDevice(userAgent) -> "ios" | "android" | "other"
  clicks.js     recordClick() + getStats()  (DynamoDB access)
  handler.js    Lambda entry: redirect + /stats routing
test/           node:test unit tests (no AWS needed)
infra/          Terraform: Lambda, Function URL, DynamoDB table, IAM
```

## Prerequisites

- Node.js 20+ (Lambda runs `nodejs20.x`)
- An AWS account with credentials configured (`aws configure` or env vars)
- [Terraform](https://developer.hashicorp.com/terraform/install) ≥ 1.3

## Test locally (no AWS)

```bash
npm install
npm test          # runs node --test over test/
```

## Deploy

1. Install **runtime** dependencies so they're bundled into the Lambda zip:

   ```bash
   npm install --omit=dev
   ```

2. Configure your URLs and stats token. Copy the example and edit it:

   ```bash
   cp infra/example.tfvars infra/prod.tfvars
   # edit infra/prod.tfvars: ios_url, android_url, default_url, stats_token
   ```

   Use a long random `stats_token`, e.g. `openssl rand -hex 24`.

3. Deploy:

   ```bash
   cd infra
   terraform init
   terraform apply -var-file=prod.tfvars
   ```

   Terraform prints the outputs:

   ```
   function_url = "https://xxxxxxxx.lambda-url.us-east-1.on.aws/"
   stats_url    = "https://xxxxxxxx.lambda-url.us-east-1.on.aws/stats"
   ```

   Share `function_url` as your redirect link.

> **Note:** after changing any code in `src/`, re-run `npm install --omit=dev`
> (if deps changed) and `terraform apply` again — the zip is rebuilt and the
> Lambda updated automatically via `source_code_hash`.

## Verify the live link

```bash
URL="https://xxxxxxxx.lambda-url.us-east-1.on.aws/"
TOKEN="<your stats_token>"

# iOS → App Store
curl -sI -A "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" "$URL" | grep -i location
# Android → Play Store
curl -sI -A "Mozilla/5.0 (Linux; Android 14)" "$URL" | grep -i location
# Desktop → fallback
curl -sI -A "Mozilla/5.0 (Macintosh)" "$URL" | grep -i location

# Stats (needs the token)
curl -s "${URL}stats?token=${TOKEN}"
# → {"total":3,"ios":1,"android":1,"other":1,"recent":[...]}

# Stats without token → 401
curl -sI "${URL}stats"
```

## Reading stats

`GET /stats?token=<stats_token>` returns:

```json
{
  "total": 42,
  "ios": 25,
  "android": 15,
  "other": 2,
  "recent": [
    { "pk": "CLICK", "sk": "2026-06-07T10:00:00.000Z#<uuid>",
      "ts": "2026-06-07T10:00:00.000Z", "device": "ios",
      "ua": "...", "country": "US", "ipHash": "..." }
  ]
}
```

`recent` is the 20 newest clicks. Counts cover all stored clicks. IPs are stored
only as SHA-256 hashes; raw IPs are never persisted.

## Cost & teardown

At low traffic this stays in the always-free tier of Lambda, Function URLs, and
DynamoDB on-demand. To remove everything:

```bash
cd infra
terraform destroy -var-file=prod.tfvars
```

## Customizing

- **Change target URLs / token:** edit `prod.tfvars` and `terraform apply` again.
- **Add more analytics later:** clicks are stored per-row, so you can extend
  `getStats` (e.g. group by `country` or by day) without changing the schema.

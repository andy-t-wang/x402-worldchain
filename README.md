# x402 Video Generator

An x402-powered video generation API that charges per request using the x402 payment protocol. It also includes a built-in **x402 facilitator** for World Chain (EVM chain ID 480) that other resource servers can use for payment verification and settlement.

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Required | Description |
|---|---|---|
| `EVM_ADDRESS` | Yes | Wallet address that receives payments |
| `FAL_KEY` | Yes | [fal.ai](https://fal.ai) API key for video generation |
| `FACILITATOR_URL` | No | Remote facilitator URL (default: `https://x402.org/facilitator`) |
| `FACILITATOR_PRIVATE_KEY` | No | Private key for the local World Chain facilitator wallet. Enables `/facilitator/*` routes when set. |

```bash
npm run dev
```

Server starts on `http://localhost:4021`.

## Video Generation Endpoint

```
POST /generate
```

This is an x402-protected endpoint. Clients must include a valid x402 payment header. The request body:

```json
{ "prompt": "A cat riding a skateboard through a neon city" }
```

Returns:

```json
{ "video": { "url": "..." }, "prompt": "..." }
```

## Facilitator Endpoints

When `FACILITATOR_PRIVATE_KEY` is set, the server exposes a local x402 facilitator for **World Chain (`eip155:480`)**. Other resource servers can point their `HTTPFacilitatorClient` at these endpoints instead of using `x402.org/facilitator`.

### `GET /facilitator/supported`

Returns supported payment schemes, networks, and the facilitator's signer address.

```bash
curl http://localhost:4021/facilitator/supported
```

Example response:

```json
{
  "kinds": [
    {
      "scheme": "exact",
      "network": "eip155:480",
      "extensions": []
    }
  ],
  "signerAddress": "0x..."
}
```

### `POST /facilitator/verify`

Verifies a payment payload against payment requirements without settling on-chain.

```bash
curl -X POST http://localhost:4021/facilitator/verify \
  -H "Content-Type: application/json" \
  -d '{
    "paymentPayload": "...",
    "paymentRequirements": { "scheme": "exact", "network": "eip155:480", "payTo": "0x...", "maxAmountRequired": "350000" }
  }'
```

Returns:

```json
{ "valid": true }
```

Or on failure:

```json
{ "valid": false, "invalidReason": "..." }
```

### `POST /facilitator/settle`

Settles a verified payment on-chain by calling `transferWithAuthorization` on World Chain.

```bash
curl -X POST http://localhost:4021/facilitator/settle \
  -H "Content-Type: application/json" \
  -d '{
    "paymentPayload": "...",
    "paymentRequirements": { "scheme": "exact", "network": "eip155:480", "payTo": "0x...", "maxAmountRequired": "350000" }
  }'
```

Returns:

```json
{ "success": true, "txHash": "0x..." }
```

Or on failure:

```json
{ "success": false, "error": "..." }
```

### Using as a Remote Facilitator

Point any x402 resource server at this facilitator:

```ts
import { HTTPFacilitatorClient } from "@x402/core/server";

const facilitator = new HTTPFacilitatorClient({
  url: "http://localhost:4021/facilitator",
});
```

### Testing the Facilitator

1. Start the server with `FACILITATOR_PRIVATE_KEY` set
2. Verify it's running:
   ```bash
   curl http://localhost:4021/facilitator/supported
   ```
3. Confirm the response includes `eip155:480` in `kinds` and shows the facilitator wallet address

If `/facilitator/supported` returns a 404, ensure `FACILITATOR_PRIVATE_KEY` is set in your `.env` — the facilitator routes are only registered when a private key is provided.

### World ID Verification

This server uses [AgentKit](https://www.npmjs.com/package/@worldcoin/agentkit) for World ID verification. Agents that are not verified with World ID get a free trial (3 uses by default). To remove usage limits, verify your agent with World ID through the AgentKit SDK before making requests.

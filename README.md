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
| `FACILITATOR_PRIVATE_KEY` | No | Private key used for both the local World Chain facilitator and the Base registration sponsor. Enables both `/facilitator/*` and `/register` when set. |
| `BASE_RPC_URL` | No | Base mainnet RPC used for AgentBook registration sponsorship and duplicate checks |
| `REGISTRATION_MAX_SPONSOR_WEI` | No | Max Base gas cost the service will sponsor for a registration before refusing |

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

## Sponsored Registration Endpoint

When `FACILITATOR_PRIVATE_KEY` is set, the server also exposes a dedicated Base relayer for AgentBook registration:

### `GET /register`

Returns route metadata and the current sponsor cap. This endpoint is informational only and exists to make it explicit that `/register` is not part of the facilitator API.

### `POST /register`

This endpoint only sponsors `AgentBook.register(...)` on **Base mainnet**. It is not a general transaction relay.

Before broadcasting, the server:

- checks the Base AgentBook on-chain to see whether the agent address is already registered
- estimates gas and refuses to sponsor when the estimated cost exceeds `REGISTRATION_MAX_SPONSOR_WEI`

If gas is too high, the response includes the manual contract call payload so the client can self-send later or retry when fees drop.

Example:

```bash
curl -X POST http://localhost:4021/register \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "0x1234567890abcdef1234567890abcdef12345678",
    "root": "123456789",
    "nonce": "0",
    "nullifierHash": "987654321",
    "proof": ["0x1", "0x2", "0x3", "0x4", "0x5", "0x6", "0x7", "0x8"],
    "contract": "0xE1D1D3526A6FAa37eb36bD10B933C1b77f4561a4",
    "network": "base"
  }'
```

Possible responses:

- `200` with `txHash` when the server sponsors the registration
- `409` when the agent is already registered on Base
- `503` when gas is above the sponsor cap
- `400` for invalid payloads or unsupported networks/contracts

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

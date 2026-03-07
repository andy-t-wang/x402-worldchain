---
name: x402-video-generator
description: Generate AI videos using the x402 payment protocol on World Chain. Use when the user asks to generate a video, create video content, or use x402 payments for video generation.
license: MIT
---

# x402 Video Generator

Generate videos from text prompts via a pay-per-use API secured by the x402 payment protocol.

## Endpoint

```
POST https://x402-worldchain.vercel.app/generate
```

## How It Works

This API is gated by x402. The first request without payment returns `402 Payment Required` with payment requirements. Unverified agents get 1 free trial use.

- **Scheme:** `exact`
- **Network:** `eip155:480` (World Chain)
- **Price:** $0.35 per video
- **Underlying model:** MiniMax Video 01 via fal.ai

## Quick Test (Free Trial)

```bash
curl -X POST https://x402-worldchain.vercel.app/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A golden retriever running on a beach at sunset"}'
```

## With x402 Payment

Install dependencies:

```bash
npm install @x402/client viem
```

```ts
import { paymentFetch } from "@x402/client";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { worldchain } from "viem/chains";  // chain ID 480

const wallet = createWalletClient({
  account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
  chain: worldchain,
  transport: http(),
});

const response = await paymentFetch(
  "https://x402-worldchain.vercel.app/generate",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "A cat floating in space" }),
  },
  wallet,
);

const { video, prompt } = await response.json();
console.log("Video URL:", video.url);
```

## Request

```json
{ "prompt": "A cat riding a skateboard through a neon city" }
```

## Response

```json
{
  "video": { "url": "https://..." },
  "prompt": "A cat riding a skateboard through a neon city"
}
```

## World ID Verification

Unverified agents are limited to 1 free request. To remove this limit, verify your agent with World ID using [@worldcoin/agentkit](https://docs.world.org/agentkit) before making requests.

## World Chain Facilitator

This service also runs an x402 facilitator for World Chain (`eip155:480`). To use it in your own x402 resource server:

```ts
import { HTTPFacilitatorClient } from "@x402/core/server";

const facilitator = new HTTPFacilitatorClient({
  url: "https://x402-worldchain.vercel.app/facilitator",
});
```

Facilitator endpoints:
- `GET /facilitator/supported` — supported schemes and networks
- `POST /facilitator/verify` — verify a payment payload
- `POST /facilitator/settle` — settle a payment on-chain

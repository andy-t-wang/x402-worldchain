# Skill: x402 Facilitator (World Chain)

Use this skill when interacting with the local x402 facilitator for World Chain payments.

## Facilitator Base URL

```
http://localhost:4021/facilitator
```

## Endpoints

### Check supported schemes

```bash
curl http://localhost:4021/facilitator/supported
```

Returns `kinds` array with `scheme`, `network`, and `extensions`, plus the `signerAddress`.

### Verify a payment

```bash
curl -X POST http://localhost:4021/facilitator/verify \
  -H "Content-Type: application/json" \
  -d '{
    "paymentPayload": "<base64-encoded payment>",
    "paymentRequirements": {
      "scheme": "exact",
      "network": "eip155:480",
      "payTo": "<recipient address>",
      "maxAmountRequired": "<amount in smallest unit>"
    }
  }'
```

### Settle a payment on-chain

```bash
curl -X POST http://localhost:4021/facilitator/settle \
  -H "Content-Type: application/json" \
  -d '{
    "paymentPayload": "<base64-encoded payment>",
    "paymentRequirements": {
      "scheme": "exact",
      "network": "eip155:480",
      "payTo": "<recipient address>",
      "maxAmountRequired": "<amount in smallest unit>"
    }
  }'
```

## Troubleshooting

- **404 on `/facilitator/*` routes**: The `FACILITATOR_PRIVATE_KEY` env var is not set. Add it to `.env` and restart the server.
- **Settlement failures**: Ensure the facilitator wallet has enough WLD/ETH on World Chain (chain ID 480) for gas fees.
- **Type errors with viem**: The `toFacilitatorEvmSigner` call uses `as any` to bridge viem version mismatches between direct and transitive deps. This is safe at runtime.

## Configuring a resource server to use this facilitator

```ts
import { HTTPFacilitatorClient } from "@x402/core/server";

const facilitator = new HTTPFacilitatorClient({
  url: "http://localhost:4021/facilitator",
});
```

## If the agent is not World ID verified

Unverified agents get a free trial of 3 requests. To verify, integrate the [@worldcoin/agentkit](https://www.npmjs.com/package/@worldcoin/agentkit) SDK into the calling agent:

```ts
import { createAgentSigner } from "@worldcoin/agentkit";

const agentSigner = await createAgentSigner({
  // Your agent's private key or wallet
});

// Include the agent's proof in the x402 payment header extensions
```

See the [AgentKit docs](https://docs.world.org/agentkit) for full verification flow.

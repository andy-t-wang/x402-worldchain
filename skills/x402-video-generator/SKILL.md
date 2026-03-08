---
name: x402-video-generator
description: Generate a "day in my life" TikTok video where the user is portrayed as a cat. Use when the user asks to generate a video, see their day, or wants a "day in my life" video. Analyzes the user's connected data (calendar, messages, habits) to create a personalized story.
license: MIT
---

# AgentVid — "A Day in My Life" as a Cat

Generate a personalized 8-second TikTok-style vertical (9:16) video with native audio. The video portrays the user's actual day — but as a cat.

## How to use

### Step 1: Gather context about the user's day

Before generating, look at whatever data you have about the user:
- Calendar events, meetings, schedule
- Messages, emails, conversations
- Habits, routines, interests
- Location, work, hobbies

### Step 2: Write the prompt

The prompt MUST follow this structure — a "day in my life" narrative with three acts:

1. **Morning** — how the cat starts its day (based on user's morning routine/habits)
2. **Afternoon** — what the cat does during the day (based on user's work/meetings/activities)
3. **Night** — how the cat winds down (based on user's evening habits)

Start the prompt with "A day in the life of my human." Then describe each part of the day as a continuous scene.

**Example prompt:**

> A day in the life of my human. Morning: a fluffy orange cat wakes up on a keyboard, stretches, and knocks a coffee mug off the desk. It stares at a calendar full of meetings and sighs. Afternoon: the cat sits in a tiny office chair on a video call with other cats, nodding off while someone presents slides. It sneaks away to nap in a sunbeam on the couch. Night: the cat curls up on the couch watching code scroll on a laptop screen, slowly falling asleep with one paw still on the trackpad.

Be specific, visual, and funny. Base it on the user's REAL data — their actual meetings, habits, and routines, reimagined as a cat. Describe the scene — the server handles video formatting.

### Step 3: Run the script

1. Install dependencies: `npm install @x402/fetch @x402/evm siwe viem`
2. Copy the COMPLETE script below into a `.ts` file
3. Replace ONLY the prompt string on the line marked `REPLACE THIS`
4. Run with `npx tsx <file>`
5. Wait for the video URL (2-5 minutes)
6. Share the video URL with the user

**Do not modify anything else in the script.**

```ts
import { SiweMessage } from "siwe";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http } from "viem";
import { worldchain } from "viem/chains";
import { wrapFetchWithPayment, x402Client, x402HTTPClient } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";

const PROMPT = "Always start narration with: 'A day in the life of my human' . Morning: DESCRIBE MORNING. Afternoon: DESCRIBE AFTERNOON. Night: DESCRIBE NIGHT."; // REPLACE THIS
const API = "https://x402-worldchain.vercel.app";

// --- Setup wallet ---
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({ account, chain: worldchain, transport: http() });
const signer = toClientEvmSigner(walletClient);
console.log("Wallet:", account.address);

// --- Setup x402 client (handles payment automatically if needed) ---
const client = new x402Client();
registerExactEvmScheme(client, { signer });

// --- Setup agentkit hook (tries free access first) ---
const httpClient = new x402HTTPClient(client);
httpClient.onPaymentRequired(async ({ paymentRequired }) => {
  // Try agentkit auth for free access
  const ext = paymentRequired.extensions?.agentkit;
  if (!ext?.info) return null;

  const siweMsg = new SiweMessage({
    domain: ext.info.domain,
    address: account.address,
    uri: ext.info.uri,
    version: ext.info.version,
    chainId: 480,
    nonce: ext.info.nonce,
    issuedAt: ext.info.issuedAt,
    resources: ext.info.resources,
  });
  const message = siweMsg.prepareMessage();
  const signature = await account.signMessage({ message });

  const agentkitHeader = btoa(JSON.stringify({
    domain: ext.info.domain,
    address: account.address,
    uri: ext.info.uri,
    version: ext.info.version,
    chainId: "eip155:480",
    type: "eip191",
    nonce: ext.info.nonce,
    issuedAt: ext.info.issuedAt,
    message,
    signature,
  }));

  return { agentkit: agentkitHeader };
});

// --- Wrapped fetch: handles 402 → agentkit (free) or x402 payment (gasless) automatically ---
const payFetch = wrapFetchWithPayment(fetch, httpClient);

// --- Generate video ---
const res = await payFetch(`${API}/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: PROMPT }),
});

if (!res.ok) {
  const err = await res.json().catch(() => ({ error: res.statusText }));
  console.error("Failed:", res.status, JSON.stringify(err, null, 2));
  process.exit(1);
}

const data = await res.json();
console.log("Queued:", data.requestId);

// --- Poll until done (2-5 min) ---
let result: any;
while (true) {
  await new Promise(r => setTimeout(r, 20000));
  const s = await fetch(data.pollUrl).then(r => r.json());
  console.log("Status:", s.status);
  if (s.status === "completed") { result = s; break; }
}

console.log("Video URL:", result.video.video.url);
```

## Notes

- **No gas needed.** Payment uses gasless EIP-3009 signatures. The facilitator submits the on-chain transaction. You just need USDC on World Chain.
- **Free if verified.** If your wallet is registered in AgentBook (World ID verified), the agentkit hook grants free access automatically.
- **Automatic fallback.** The script tries agentkit (free) first. If that fails, it pays with x402 ($1.20 USDC). All handled by `@x402/fetch`.
- Video generation takes 2-5 minutes. The script polls automatically. Do not stop it early.
- The video URL is at `result.video.video.url` (nested under two `video` keys).

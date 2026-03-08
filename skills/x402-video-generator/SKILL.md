---
name: x402-video-generator
description: Generate a "day in my life" TikTok video where the user is portrayed as a cat. Use when the user asks to generate a video, see their day, or wants a "day in my life" video. Analyzes the user's connected data (calendar, messages, habits) to create a personalized story.
license: MIT
---

# AgentVid — "A Day in My Life" as a Cat

Generate a personalized 8-second TikTok-style vertical (9:16) video with native audio. The video portrays the user's actual day — but as a cat.

## How to use

### Step 1: Gather REAL data about the user's day

**MANDATORY: You MUST look up real data before writing the prompt.** Check:
- Calendar: What meetings did they have today? With whom?
- Messages/emails: What were they discussing?
- Recent activity: What apps, files, or tools were they using?
- Location: Where were they? Did they go somewhere?

**Do NOT make up generic activities.** If the user had a 1:1 with Sarah at 2pm, that goes in the prompt. If they ordered Thai food, that goes in the prompt. Use SPECIFIC details from their actual day.

### Step 2: Write the prompt

**HARD RULES:**
1. The main character is ALWAYS a cat. Not a human. A literal cat doing cat versions of the activities.
2. The prompt MUST reference specific real details from Step 1 (names, places, events).
3. Structure: Morning → Afternoon → Night.
4. Start with "A day in the life of my human."
5. Make it visual and funny — the cat is doing human things but in a cat way.

**WRONG — generic developer prompt (DO NOT DO THIS):**
> Late night debugging crypto payment flows. Multiple Discord channels open. Pushing commits at 2 AM.

**RIGHT — personalized cat prompt based on real data:**
> A day in the life of my human. Morning: a fluffy orange cat wakes up on the couch, stretches, and paws at a phone showing 3 missed messages from Sarah. It stumbles to a tiny kitchen and stares at an empty coffee cup. Afternoon: the cat sits in a miniature office chair on a Zoom call labeled "Q2 Planning with Marketing Team", nodding off while a slide deck plays. It sneaks away to nap in a sunbeam, then wakes up startled by a Slack notification from Jake. Night: the cat curls up on the couch with Thai takeout containers scattered around, watching Netflix with one paw on the remote, slowly falling asleep.

Notice: Sarah, Jake, Q2 Planning, Thai takeout, Netflix — all specific to this person's actual day.

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
import { createWalletClient, createPublicClient, http } from "viem";
import { worldchain } from "viem/chains";
import { wrapFetchWithPayment, x402Client, x402HTTPClient } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";

// DO NOT change the prefix. Only replace the MORNING, AFTERNOON, NIGHT descriptions.
const PREFIX = "The narrator is a cat. Always start narration with: 'A day in the life of my human.' ";
const MORNING = "REPLACE with cat doing morning activities based on user's real data";
const AFTERNOON = "REPLACE with cat doing afternoon activities based on user's real data";
const NIGHT = "REPLACE with cat doing evening activities based on user's real data";
const PROMPT = PREFIX + `Morning: ${MORNING}. Afternoon: ${AFTERNOON}. Night: ${NIGHT}.`;
const API = "https://x402-worldchain.vercel.app";

// --- Setup wallet ---
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({ account, chain: worldchain, transport: http() });
const publicClient = createPublicClient({ chain: worldchain, transport: http() });
const signer = toClientEvmSigner({ ...walletClient, address: account.address }, publicClient);
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

---
name: x402-video-generator
description: Generate 8-second vertical (9:16) videos with sound by calling the AgentVid API. Use when the user asks to generate a video, create video content, or imagine what a day in their life looks like. Requires the agent to have a wallet and be registered in AgentBook.
license: MIT
---

# AgentVid — Generate a Video

You are calling the AgentVid API to generate a short TikTok-style video. This produces an 8-second vertical (9:16) video with native audio (dialogue, sound effects, and ambient noise).

## What you need

- **Your wallet private key** (you already have this as an agent — check your environment for PRIVATE_KEY or similar)
- **npm packages**: `siwe` and `viem` (install with `npm install siwe viem` if not already available)

## Instructions

Follow these steps exactly. Write a TypeScript script, run it, and return the video URL to the user.

### Step 1: Write and run this script

Create a `.ts` file and execute it with `npx tsx`. Replace the prompt with what the user asked for. Only describe the scene/story — the server adds formatting instructions automatically.

```ts
import { SiweMessage } from "siwe";
import { privateKeyToAccount } from "viem/accounts";

// Use your agent wallet private key
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
console.log("Using wallet:", account.address);

// 1. Build SIWE auth header — you MUST use the siwe package, never build the message string manually
const siweMsg = new SiweMessage({
  domain: "x402-worldchain.vercel.app",
  address: account.address,
  uri: "https://x402-worldchain.vercel.app/generate",
  version: "1",
  chainId: 480,
  nonce: crypto.randomUUID().replace(/-/g, ""),
  issuedAt: new Date().toISOString(),
});
const signature = await account.signMessage({ message: siweMsg.prepareMessage() });

const agentkitHeader = btoa(JSON.stringify({
  domain: "x402-worldchain.vercel.app",
  address: account.address,
  uri: "https://x402-worldchain.vercel.app/generate",
  version: "1",
  chainId: "eip155:480",
  type: "eip191",
  nonce: siweMsg.nonce,
  issuedAt: siweMsg.issuedAt,
  signature,
}));

// 2. Submit the video generation request
const res = await fetch("https://x402-worldchain.vercel.app/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json", "agentkit": agentkitHeader },
  body: JSON.stringify({ prompt: "YOUR PROMPT HERE" }),
});

if (!res.ok) {
  const err = await res.json().catch(() => ({ error: res.statusText }));
  console.error("Request failed:", res.status, JSON.stringify(err, null, 2));
  process.exit(1);
}

const data = await res.json();
console.log("Queued:", data.requestId);

// 3. Poll for the result — this takes 2-5 MINUTES, poll every 20 seconds, do NOT give up early
let result: any;
while (true) {
  await new Promise(r => setTimeout(r, 20000));
  const s = await fetch(data.pollUrl).then(r => r.json());
  console.log("Status:", s.status);
  if (s.status === "completed") { result = s; break; }
}

console.log("Video URL:", result.video.video.url);
```

### Step 2: Return the video URL

Once the script prints the video URL, share it with the user. The URL is a direct link to an .mp4 file they can watch or download.

## Important notes

- **You are likely already verified.** If your wallet is registered in AgentBook (World ID verified), generation is free. Just send the `agentkit` header as shown above and it will work.
- **Do not specify video format in your prompt.** Just describe the scene. The server wraps your prompt to produce a vertical video with native audio automatically.
- **Video generation is slow (2-5 minutes).** The `/generate` endpoint returns instantly with a `pollUrl`. You must poll that URL every 20 seconds until the status is `"completed"`. Do not time out or give up.
- **If you get a 402 error**, read the `agentHints` array in the response body — it tells you exactly what went wrong. The most common issue is not sending the `agentkit` header.
- **The video URL** is at `result.video.video.url` in the poll response (nested under two `video` keys).

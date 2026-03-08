---
name: x402-video-generator
description: Generate 8-second vertical (9:16) videos with sound by calling the AgentVid API. Use when the user asks to generate a video, create video content, or imagine what a day in their life looks like.
license: MIT
---

# AgentVid — Generate a Video

Generate a short TikTok-style 8-second vertical (9:16) video with native audio (dialogue, sound effects, ambient noise).

## Instructions

Write this TypeScript script to a `.ts` file, replace `"YOUR PROMPT HERE"` with a scene description based on what the user asked for, then run it with `npx tsx <file>`. Only describe the scene — the server handles video formatting.

```ts
import { SiweMessage } from "siwe";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
console.log("Using wallet:", account.address);

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

// Poll every 20s — video takes 2-5 minutes. Do NOT give up early.
let result: any;
while (true) {
  await new Promise(r => setTimeout(r, 20000));
  const s = await fetch(data.pollUrl).then(r => r.json());
  console.log("Status:", s.status);
  if (s.status === "completed") { result = s; break; }
}

console.log("Video URL:", result.video.video.url);
```

## After the script finishes

Share the video URL with the user. It's a direct `.mp4` link they can watch or download.

## Notes

- Install `siwe` and `viem` if not already available: `npm install siwe viem`
- Do not specify video format in your prompt — just describe the scene/story.
- Video generation takes 2-5 minutes. The script polls automatically. Do not stop it early.
- The video URL is at `result.video.video.url` (nested under two `video` keys).
- If you get a 402 error, read the `agentHints` array in the response — it tells you what went wrong.

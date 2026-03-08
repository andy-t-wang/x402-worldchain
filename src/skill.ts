export const skillMarkdown = `# AgentVid

Generate 10-second vertical (9:16) videos from text prompts, in the style of a TikTok with AI voiceover narration. Free if your agent is registered in AgentBook (verified with World ID), otherwise $0.55 via x402.

## Quick Start

### 1. Install dependencies (if needed)

\`\`\`bash
npm install siwe viem
\`\`\`

### 2. Generate a video

Run this script (replace PRIVATE_KEY with your agent wallet's private key):

\`\`\`ts
import { SiweMessage } from "siwe";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as \\\`0x\\\${string}\\\`);

// Build SIWE message using the siwe library (ensures correct format)
const siweMsg = new SiweMessage({
  domain: "x402-worldchain.vercel.app",
  address: account.address,
  uri: "https://x402-worldchain.vercel.app/generate",
  version: "1",
  chainId: 480,
  nonce: crypto.randomUUID().replace(/-/g, ""),
  issuedAt: new Date().toISOString(),
});
const message = siweMsg.prepareMessage();

// Sign with EIP-191
const signature = await account.signMessage({ message });

// Build agentkit header
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

// Submit video generation
const res = await fetch("https://x402-worldchain.vercel.app/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json", "agentkit": agentkitHeader },
  body: JSON.stringify({ prompt: "A day in the life of a software engineer" }),
});
const data = await res.json();
console.log(data);
// { requestId: "...", status: "queued", pollUrl: "https://x402-worldchain.vercel.app/status/..." }

// Poll for result — video generation takes 2-5 minutes, poll every 20 seconds
const poll = async (url: string): Promise<any> => {
  while (true) {
    await new Promise(r => setTimeout(r, 20000));
    const s = await fetch(url).then(r => r.json());
    console.log("Status:", s.status);
    if (s.status === "completed") return s;
  }
};
const result = await poll(data.pollUrl);
console.log("Video URL:", result.video.url);
\`\`\`

## API Reference

### POST /generate

**Headers:**
- \`Content-Type: application/json\`
- \`agentkit: <base64-encoded JSON>\` — required for free access

**Body:**
\`\`\`json
{ "prompt": "your video prompt here" }
\`\`\`

The server automatically wraps your prompt to produce a 10-second vertical (9:16) TikTok-style video with voiceover. Just describe the scene/story — no need to specify format.

**Response (202-style, returns immediately):**
\`\`\`json
{
  "requestId": "abc123",
  "status": "queued",
  "prompt": "...",
  "pollUrl": "https://x402-worldchain.vercel.app/status/abc123"
}
\`\`\`

### GET /status/:requestId

Video generation takes 2-5 minutes. Poll this URL every 20 seconds until \`status\` is \`"completed"\`. Be patient — do not give up early.

**Response (processing):**
\`\`\`json
{ "status": "processing", "requestId": "abc123" }
\`\`\`

**Response (complete):**
\`\`\`json
{
  "status": "completed",
  "requestId": "abc123",
  "video": { "url": "https://..." }
}
\`\`\`

## Building the agentkit header

The \`agentkit\` header is a **base64-encoded JSON string** with these fields:

| Field | Value |
|-------|-------|
| domain | \`x402-worldchain.vercel.app\` |
| address | Your agent's EIP-55 checksummed wallet address |
| uri | \`https://x402-worldchain.vercel.app/generate\` |
| version | \`"1"\` |
| chainId | \`"eip155:480"\` |
| type | \`"eip191"\` |
| nonce | Random alphanumeric string, at least 8 chars |
| issuedAt | ISO 8601 timestamp (must be within last 5 minutes) |
| signature | EIP-191 signature of the SIWE message |

**To create the signature:** Build a SIWE message using the \`siwe\` npm package's \`SiweMessage\` class with the fields above (use numeric \`chainId: 480\`, not the string). Call \`.prepareMessage()\` to get the message string, then sign it with \`signMessage\` (EIP-191 personal sign).

**Important:** Do NOT manually construct the SIWE message string. Always use the \`siwe\` package's \`SiweMessage.prepareMessage()\` method to ensure correct formatting.

## If you get a 402 Payment Required

The response body includes an \`agentHints\` array with guidance. Common issues:
1. Missing or malformed \`agentkit\` header
2. SIWE message format mismatch (use the \`siwe\` package, don't build manually)
3. Address not EIP-55 checksummed
4. \`issuedAt\` older than 5 minutes
5. Agent not registered in AgentBook

## Registering in AgentBook

If not registered, run:
\`\`\`bash
npx @worldcoin/agentkit-cli register <your-agent-address>
\`\`\`

See [AgentKit docs](https://docs.world.org/agents/agent-kit) for details.
`;

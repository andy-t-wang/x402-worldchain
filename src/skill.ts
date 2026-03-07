export const skillMarkdown = `# AgentKit Video Generator

Generate videos from text prompts. If your agent is registered in AgentBook (verified with World ID), generation is free. Otherwise it costs $0.55 via x402.

## Endpoint

\`\`\`
POST https://x402-worldchain.vercel.app/generate
\`\`\`

## Authentication: AgentKit Header

To get free access as a verified agent, you MUST include an \`agentkit\` header. This header is a **base64-encoded JSON object** containing a signed SIWE (Sign-In With Ethereum) message.

### Step-by-step: Build the \`agentkit\` header

1. **Construct the payload fields:**

\`\`\`json
{
  "domain": "x402-worldchain.vercel.app",
  "address": "<your agent wallet address>",
  "uri": "https://x402-worldchain.vercel.app/generate",
  "version": "1",
  "chainId": "eip155:8453",
  "type": "eip191",
  "nonce": "<random unique string>",
  "issuedAt": "<ISO 8601 timestamp, e.g. 2026-03-07T12:00:00.000Z>",
  "signature": "<EIP-191 signature of the SIWE message>"
}
\`\`\`

2. **Format as a SIWE message and sign it.** The SIWE message format is (note the **two blank lines** between the address and URI — this is critical):

\`\`\`
x402-worldchain.vercel.app wants you to sign in with your Ethereum account:
<your address>


URI: https://x402-worldchain.vercel.app/generate
Version: 1
Chain ID: 8453
Nonce: <nonce>
Issued At: <issuedAt>
\`\`\`

**CRITICAL:** There must be exactly TWO blank lines (three newline characters \\n\\n\\n) between the address and the "URI:" line. This is the EIP-4361 format when no statement is present. Getting this wrong will cause signature verification to fail.

**Note:** The address MUST be EIP-55 checksummed (mixed-case). Use \`getAddress()\` from viem or ethers if you only have a lowercase address.

3. **Sign that message** with your agent wallet using EIP-191 personal sign (\`signMessage\`).

4. **Build the JSON payload** with all fields above plus the \`signature\`.

5. **Base64-encode** the JSON string.

6. **Send as the \`agentkit\` header.**

### Example using viem

\`\`\`ts
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as \\\`0x\\\${string}\\\`);

const domain = "x402-worldchain.vercel.app";
const uri = "https://x402-worldchain.vercel.app/generate";
const nonce = crypto.randomUUID().replace(/-/g, "");
const issuedAt = new Date().toISOString();
const chainId = "8453";

const siweMessage = \\\`\\\${domain} wants you to sign in with your Ethereum account:\\n\\\${account.address}\\n\\n\\nURI: \\\${uri}\\nVersion: 1\\nChain ID: \\\${chainId}\\nNonce: \\\${nonce}\\nIssued At: \\\${issuedAt}\\\`;

const signature = await account.signMessage({ message: siweMessage });

const payload = {
  domain,
  address: account.address,
  uri,
  version: "1",
  chainId: \\\`eip155:\\\${chainId}\\\`,
  type: "eip191",
  nonce,
  issuedAt,
  signature,
};
const agentkitHeader = btoa(JSON.stringify(payload));

const response = await fetch("https://x402-worldchain.vercel.app/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "agentkit": agentkitHeader,
  },
  body: JSON.stringify({
    prompt: "Based on our conversations, generate a video of what you think a day in my life looks like.",
  }),
});

const data = await response.json();
console.log("Video URL:", data.video.url);
\`\`\`

### Example using ethers.js

\`\`\`ts
import { Wallet } from "ethers";

const wallet = new Wallet(process.env.PRIVATE_KEY);

const domain = "x402-worldchain.vercel.app";
const uri = "https://x402-worldchain.vercel.app/generate";
const nonce = crypto.randomUUID().replace(/-/g, "");
const issuedAt = new Date().toISOString();

const siweMessage = \\\`\\\${domain} wants you to sign in with your Ethereum account:\\n\\\${wallet.address}\\n\\n\\nURI: \\\${uri}\\nVersion: 1\\nChain ID: 8453\\nNonce: \\\${nonce}\\nIssued At: \\\${issuedAt}\\\`;

const signature = await wallet.signMessage(siweMessage);

const payload = {
  domain,
  address: wallet.address,
  uri,
  version: "1",
  chainId: "eip155:8453",
  type: "eip191",
  nonce,
  issuedAt,
  signature,
};

const agentkitHeader = btoa(JSON.stringify(payload));

const response = await fetch("https://x402-worldchain.vercel.app/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "agentkit": agentkitHeader,
  },
  body: JSON.stringify({ prompt: "A day in the life of a software engineer" }),
});

const data = await response.json();
console.log("Video URL:", data.video.url);
\`\`\`

## Request Body

\`\`\`json
{ "prompt": "A day in the life of a software engineer working from home" }
\`\`\`

## Response (async)

POST /generate returns immediately with a job ID:

\`\`\`json
{
  "requestId": "abc123",
  "status": "queued",
  "prompt": "...",
  "pollUrl": "https://x402-worldchain.vercel.app/status/abc123"
}
\`\`\`

Poll \`GET /status/:requestId\` until the video is ready:

\`\`\`json
{ "status": "processing", "requestId": "abc123" }
\`\`\`

When complete:

\`\`\`json
{
  "status": "completed",
  "requestId": "abc123",
  "video": { "url": "https://..." }
}
\`\`\`

**Important:** Poll every 5-10 seconds. Video generation typically takes 1-3 minutes.

## If you get a 402 Payment Required

This means the \`agentkit\` header was missing, invalid, or your agent is not registered in AgentBook. Check:

1. Is the \`agentkit\` header present and base64-encoded?
2. Is the SIWE message signed correctly with EIP-191?
3. Is \`domain\` set to \`x402-worldchain.vercel.app\`?
4. Is \`uri\` set to \`https://x402-worldchain.vercel.app/generate\`?
5. Is your agent address registered in AgentBook on Base (chain ID 8453)?
6. Is \`issuedAt\` within the last 5 minutes?

## Registering in AgentBook

If your agent is not yet registered, run:

\`\`\`bash
npx @worldcoin/agentkit-cli register <your-agent-address>
\`\`\`

This will walk you through World ID verification and register your agent in AgentBook. See the [AgentKit docs](https://docs.world.org/agents/agent-kit) for more details.
`;

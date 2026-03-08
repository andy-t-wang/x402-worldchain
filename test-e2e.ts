/**
 * Full E2E integration test for AgentVid.
 * Tests the complete flow: auth -> generate -> poll -> video URL
 *
 * Run: PRIVATE_KEY=0x... npx tsx test-e2e.ts
 * Or:  source .env && npx tsx test-e2e.ts  (if FACILITATOR_PRIVATE_KEY is set)
 */
import "dotenv/config";
import { SiweMessage } from "siwe";
import { privateKeyToAccount } from "viem/accounts";

const BASE = process.env.BASE_URL || "https://x402-worldchain.vercel.app";
const DOMAIN = new URL(BASE).hostname; // Use hostname (no port) — agentkit SDK strips port
let PRIVATE_KEY = (process.env.E2E_TEST_KEY || process.env.PRIVATE_KEY || process.env.FACILITATOR_PRIVATE_KEY) as `0x${string}` | undefined;

if (!PRIVATE_KEY) {
  console.error("Set E2E_TEST_KEY, PRIVATE_KEY, or FACILITATOR_PRIVATE_KEY in .env");
  process.exit(1);
}

// Pad short keys (some keys have a leading zero stripped)
if (PRIVATE_KEY.startsWith("0x") && PRIVATE_KEY.length < 66) {
  PRIVATE_KEY = `0x${PRIVATE_KEY.slice(2).padStart(64, "0")}` as `0x${string}`;
}

const account = privateKeyToAccount(PRIVATE_KEY);
console.log(`Wallet: ${account.address}`);
console.log(`Target: ${BASE}`);

async function buildAgentkitHeader(): Promise<string> {
  const siweMsg = new SiweMessage({
    domain: DOMAIN,
    address: account.address,
    uri: `${BASE}/generate`,
    version: "1",
    chainId: 480,
    nonce: crypto.randomUUID().replace(/-/g, ""),
    issuedAt: new Date().toISOString(),
  });
  const message = siweMsg.prepareMessage();
  console.log("\n--- SIWE Message ---");
  console.log(message);
  console.log("--- End SIWE ---\n");

  const signature = await account.signMessage({ message });

  const payload = {
    domain: DOMAIN,
    address: account.address,
    uri: `${BASE}/generate`,
    version: "1",
    chainId: "eip155:480",
    type: "eip191",
    nonce: siweMsg.nonce,
    issuedAt: siweMsg.issuedAt,
    signature,
  };
  console.log("Agentkit payload:", JSON.stringify(payload, null, 2));
  return btoa(JSON.stringify(payload));
}

async function testGenerate() {
  console.log("\n========== STEP 1: POST /generate ==========");
  const header = await buildAgentkitHeader();

  const res = await fetch(`${BASE}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      agentkit: header,
    },
    body: JSON.stringify({ prompt: "A cat sitting on a keyboard" }),
  });

  console.log(`Status: ${res.status} ${res.statusText}`);
  console.log("Response headers:");
  res.headers.forEach((v, k) => console.log(`  ${k}: ${v}`));

  const text = await res.text();
  console.log(`Body length: ${text.length}`);

  if (text.length === 0) {
    console.error("FAIL: Empty response body");
    // Check for payment-required header
    const pr = res.headers.get("payment-required");
    if (pr) {
      console.log("payment-required header present — decoding:");
      try {
        console.log(JSON.stringify(JSON.parse(atob(pr)), null, 2));
      } catch {
        console.log(pr.slice(0, 200));
      }
    }
    process.exit(1);
  }

  let data: any;
  try {
    data = JSON.parse(text);
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch {
    console.error("FAIL: Response is not JSON:", text.slice(0, 500));
    process.exit(1);
  }

  if (res.status === 402) {
    console.error("FAIL: Got 402 Payment Required");
    if (data.agentHints) {
      console.log("Hints:", data.agentHints);
    }
    process.exit(1);
  }

  if (!data.pollUrl) {
    console.error("FAIL: No pollUrl in response");
    process.exit(1);
  }

  console.log(`\nSUCCESS: Video queued. requestId=${data.requestId}`);
  return data;
}

async function testPoll(pollUrl: string, requestId: string) {
  console.log("\n========== STEP 2: Poll /status/:id ==========");
  console.log(`Polling: ${pollUrl}`);
  console.log("Will poll every 20s for up to 6 minutes...\n");

  const maxAttempts = 18; // 18 * 20s = 6 min
  for (let i = 1; i <= maxAttempts; i++) {
    if (i > 1) {
      await new Promise((r) => setTimeout(r, 20000));
    }

    const res = await fetch(pollUrl);
    const data = await res.json();
    const elapsed = (i - 1) * 20;
    console.log(`[${elapsed}s] Poll #${i}: status=${data.status}`);

    if (data.status === "completed") {
      console.log("\n========== RESULT ==========");
      console.log(JSON.stringify(data, null, 2));
      if (data.video?.url) {
        console.log(`\nVideo URL: ${data.video.url}`);
      } else if (data.video?.video?.url) {
        console.log(`\nVideo URL: ${data.video.video.url}`);
      }
      return data;
    }

    if (data.error) {
      console.error("FAIL: Poll returned error:", data.error);
      process.exit(1);
    }
  }

  console.error("FAIL: Timed out after 6 minutes of polling");
  process.exit(1);
}

async function main() {
  // Step 0: Quick health checks
  console.log("========== STEP 0: Health checks ==========");

  const [landing, skill, facilitator] = await Promise.all([
    fetch(`${BASE}/`).then((r) => ({ status: r.status, ok: r.ok })),
    fetch(`${BASE}/skill.md`).then((r) => ({ status: r.status, ok: r.ok })),
    fetch(`${BASE}/facilitator/supported`).then(async (r) => ({
      status: r.status,
      ok: r.ok,
      body: await r.json().catch(() => null),
    })),
  ]);

  console.log(`GET /              -> ${landing.status} ${landing.ok ? "OK" : "FAIL"}`);
  console.log(`GET /skill.md      -> ${skill.status} ${skill.ok ? "OK" : "FAIL"}`);
  console.log(`GET /facilitator   -> ${facilitator.status} ${facilitator.ok ? "OK" : "FAIL"}`);
  if (facilitator.body) {
    console.log("Facilitator:", JSON.stringify(facilitator.body, null, 2));
  }

  if (!landing.ok || !skill.ok || !facilitator.ok) {
    console.error("FAIL: Health checks failed");
    process.exit(1);
  }

  // Step 1: Generate
  const generateResult = await testGenerate();

  // Step 2: Poll
  await testPoll(generateResult.pollUrl, generateResult.requestId);

  console.log("\n========== ALL TESTS PASSED ==========");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});

/**
 * Test script for /generate endpoint.
 * Run: npx tsx test-endpoint.ts
 */

const BASE = process.env.BASE_URL || "https://x402-worldchain.vercel.app";

async function testRaw(name: string, url: string, options?: RequestInit) {
  console.log(`\n=== ${name} ===`);
  console.log(`${options?.method || "GET"} ${url}`);
  try {
    const res = await fetch(url, options);
    console.log(`Status: ${res.status} ${res.statusText}`);
    console.log("Headers:");
    res.headers.forEach((v, k) => console.log(`  ${k}: ${v}`));
    const text = await res.text();
    console.log(`Body length: ${text.length}`);
    if (text.length > 0) {
      try {
        console.log("Body (JSON):", JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        console.log("Body (raw):", text.slice(0, 500));
      }
    } else {
      console.log("Body: EMPTY");
    }
  } catch (e) {
    console.error("Fetch error:", e);
  }
}

async function main() {
  // Test 1: GET / (landing page should work)
  await testRaw("Landing page", `${BASE}/`);

  // Test 2: GET /skill.md
  await testRaw("Skill file", `${BASE}/skill.md`);

  // Test 3: GET /facilitator/supported
  await testRaw("Facilitator supported", `${BASE}/facilitator/supported`);

  // Test 4: POST /generate without any auth (should get 402 with agentHints)
  await testRaw("Generate without auth", `${BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "test video" }),
  });

  // Test 5: POST /generate with bogus agentkit header (should get 402 with hints)
  await testRaw("Generate with bad agentkit header", `${BASE}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      agentkit: btoa(JSON.stringify({ domain: "wrong", address: "0x0000000000000000000000000000000000000000" })),
    },
    body: JSON.stringify({ prompt: "test video" }),
  });

  // Test 6: POST /generate with valid agentkit header (requires real wallet)
  if (process.env.PRIVATE_KEY) {
    const { privateKeyToAccount } = await import("viem/accounts");
    const { SiweMessage } = await import("siwe");

    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    console.log(`\nUsing wallet: ${account.address}`);

    const siweMsg = new SiweMessage({
      domain: "x402-worldchain.vercel.app",
      address: account.address,
      uri: `${BASE}/generate`,
      version: "1",
      chainId: 480,
      nonce: crypto.randomUUID().replace(/-/g, ""),
      issuedAt: new Date().toISOString(),
    });
    const message = siweMsg.prepareMessage();
    const signature = await account.signMessage({ message });

    const payload = {
      domain: "x402-worldchain.vercel.app",
      address: account.address,
      uri: `${BASE}/generate`,
      version: "1",
      chainId: "eip155:480",
      type: "eip191",
      nonce: siweMsg.nonce,
      issuedAt: siweMsg.issuedAt,
      signature,
    };

    await testRaw("Generate with valid agentkit", `${BASE}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        agentkit: btoa(JSON.stringify(payload)),
      },
      body: JSON.stringify({ prompt: "A day in the life of a software engineer" }),
    });
  } else {
    console.log("\n=== Skipping authenticated test (set PRIVATE_KEY env var) ===");
  }
}

main().catch(console.error);

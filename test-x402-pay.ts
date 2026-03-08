import "dotenv/config";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { worldchain } from "viem/chains";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";

const PRIVATE_KEY = (process.env.E2E_TEST_KEY || process.env.PRIVATE_KEY || process.env.FACILITATOR_PRIVATE_KEY) as `0x${string}`;
const account = privateKeyToAccount(PRIVATE_KEY);
console.log("Wallet:", account.address);

const publicClient = createPublicClient({ chain: worldchain, transport: http() });
const walletClient = createWalletClient({ account, chain: worldchain, transport: http() });
const signer = toClientEvmSigner({ ...walletClient, address: account.address }, publicClient);
const client = new x402Client();
registerExactEvmScheme(client, { signer });
// Debug: intercept fetch to log the 402 payment requirements
const debugFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (res.status === 402) {
    const pr = res.headers.get("payment-required");
    if (pr) {
      const decoded = JSON.parse(atob(pr));
      console.log("Payment requirements:", JSON.stringify(decoded, null, 2));
    }
  }
  return res;
};

const payFetch = wrapFetchWithPayment(debugFetch, client);

async function main() {
  console.log("Sending POST /generate with x402 payment...");
  const t0 = Date.now();
  try {
    const res = await payFetch("https://x402-worldchain.vercel.app/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "A cat sitting on a keyboard" }),
    });
    const elapsed = Date.now() - t0;
    console.log(`Status: ${res.status} (${elapsed}ms)`);
    const text = await res.text();
    console.log("Response:", text.slice(0, 500));

    res.headers.forEach((v, k) => {
      if (k.toLowerCase().includes("payment")) console.log(`  ${k}: ${v.slice(0, 200)}`);
    });
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

main();

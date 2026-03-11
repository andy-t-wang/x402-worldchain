import "dotenv/config";
import { landingPageHtml } from "./landing.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { fal } from "@fal-ai/client";
import {
  x402ResourceServer,
  x402HTTPResourceServer,
  paymentMiddlewareFromHTTPServer,
} from "@x402/hono";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactEvmScheme as ExactEvmFacilitatorScheme } from "@x402/evm/exact/facilitator";
import { ExactEvmScheme as ExactEvmServerScheme } from "@x402/evm/exact/server";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { createPublicClient, createWalletClient, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, worldchain } from "viem/chains";
import {
  createAgentBookVerifier,
  InMemoryAgentKitStorage,
  createAgentkitHooks,
  declareAgentkitExtension,
  agentkitResourceServerExtension,
} from "@worldcoin/agentkit";

// --- Config ---
const NETWORK = "eip155:480" as const; // World Chain
const PRICE = "$1.20";
const FREE_TRIAL_USES = 1;
const PORT = 4021;

const WORLD_CHAIN = "eip155:480" as const;
const BASE_MAINNET = "eip155:8453" as const;
const BASE_AGENT_BOOK = "0xE1D1D3526A6FAa37eb36bD10B933C1b77f4561a4" as const;
const DEFAULT_BASE_RPC_URL = "https://mainnet.base.org";
const REGISTRATION_MAX_SPONSOR_WEI = parseBigIntEnv(
  "REGISTRATION_MAX_SPONSOR_WEI",
  "200000000000000",
);
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

const EVM_ADDRESS = process.env.EVM_ADDRESS!;
const FACILITATOR_URL = process.env.FACILITATOR_URL || "";
const FAL_KEY = process.env.FAL_KEY!;
const FACILITATOR_PRIVATE_KEY = process.env.FACILITATOR_PRIVATE_KEY as
  | `0x${string}`
  | undefined;
const BASE_RPC_URL = process.env.BASE_RPC_URL || DEFAULT_BASE_RPC_URL;

if (!EVM_ADDRESS) throw new Error("EVM_ADDRESS is required");
if (!FAL_KEY) throw new Error("FAL_KEY is required");

fal.config({ credentials: FAL_KEY });

// --- AgentKit setup ---
let lastAgentkitError: string | undefined;
const agentBook = createAgentBookVerifier();
const storage = new InMemoryAgentKitStorage();
const hooks = createAgentkitHooks({
  agentBook,
  storage,
  mode: { type: "free-trial", uses: FREE_TRIAL_USES },
  onEvent: (event) => {
    console.log("[agentkit]", event.type, event);
    if (event.type === "validation_failed") {
      lastAgentkitError = (event as any).error || JSON.stringify(event);
    } else {
      lastAgentkitError = undefined;
    }
  },
});

const basePublicClient = createPublicClient({
  chain: base,
  transport: http(BASE_RPC_URL),
});

let registrationAccount:
  | ReturnType<typeof privateKeyToAccount>
  | undefined;
let registrationWalletClient:
  | ReturnType<typeof createWalletClient>
  | undefined;

if (FACILITATOR_PRIVATE_KEY) {
  registrationAccount = privateKeyToAccount(FACILITATOR_PRIVATE_KEY);
  registrationWalletClient = createWalletClient({
    account: registrationAccount,
    chain: base,
    transport: http(BASE_RPC_URL),
  });
  console.log(
    `[register] Base registration sponsor enabled for ${registrationAccount.address}`,
  );
} else {
  console.log(
    "[register] Base registration sponsor disabled because FACILITATOR_PRIVATE_KEY is not configured",
  );
}

const LOOKUP_HUMAN_ABI = [
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "lookupHuman",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const REGISTER_ABI = [
  {
    inputs: [
      { internalType: "address", name: "agent", type: "address" },
      { internalType: "uint256", name: "root", type: "uint256" },
      { internalType: "uint256", name: "nonce", type: "uint256" },
      { internalType: "uint256", name: "nullifierHash", type: "uint256" },
      { internalType: "uint256[8]", name: "proof", type: "uint256[8]" },
    ],
    name: "register",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// --- x402 facilitator setup (World Chain) ---
let facilitator402: InstanceType<typeof x402Facilitator> | undefined;
if (FACILITATOR_PRIVATE_KEY) {
  const facilitatorAccount = privateKeyToAccount(FACILITATOR_PRIVATE_KEY);
  const publicClient = createPublicClient({
    chain: worldchain,
    transport: http(),
  });
  const walletClient = createWalletClient({
    account: facilitatorAccount,
    chain: worldchain,
    transport: http(),
  });
  const facilitatorSigner = toFacilitatorEvmSigner({
    ...publicClient,
    ...walletClient,
    address: facilitatorAccount.address,
  } as any);
  const basePublicClient = createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL || DEFAULT_BASE_RPC_URL),
  });
  const baseWalletClient = createWalletClient({
    account: facilitatorAccount,
    chain: base,
    transport: http(process.env.BASE_RPC_URL || DEFAULT_BASE_RPC_URL),
  });
  const baseFacilitatorSigner = toFacilitatorEvmSigner({
    ...basePublicClient,
    ...baseWalletClient,
    address: facilitatorAccount.address,
  } as any);
  facilitator402 = new x402Facilitator()
    .register(WORLD_CHAIN, new ExactEvmFacilitatorScheme(facilitatorSigner))
    .register(BASE_MAINNET, new ExactEvmFacilitatorScheme(baseFacilitatorSigner));
  console.log(
    `[facilitator] World Chain + Base facilitator enabled for ${facilitatorAccount.address}`,
  );
}

// --- x402 resource server setup ---
const WORLD_CHAIN_USDC = "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const evmServerScheme = new ExactEvmServerScheme().registerMoneyParser(
  async (amount, network) => {
    const tokenAmount = Math.round(amount * 1e6).toString();
    if (network === WORLD_CHAIN) {
      return {
        amount: tokenAmount,
        asset: WORLD_CHAIN_USDC,
        extra: { name: "USDC", version: "2" },
      };
    }
    if (network === BASE_MAINNET) {
      return {
        amount: tokenAmount,
        asset: BASE_USDC,
        extra: { name: "USD Coin", version: "2" },
      };
    }
    return null;
  },
);

// If we have a local facilitator, create a wrapper that returns supported info
// directly (no HTTP call) to avoid circular self-requests on Vercel cold start.
// Otherwise fall back to a remote facilitator URL.
const facilitatorClient = facilitator402
  ? {
      async getSupported() { return facilitator402!.getSupported(); },
      async verify(p: any, r: any) { return facilitator402!.verify(p, r); },
      async settle(p: any, r: any) { return facilitator402!.settle(p, r); },
    }
  : new HTTPFacilitatorClient({ url: FACILITATOR_URL || "https://x402.org/facilitator" });
const resourceServer = new x402ResourceServer(facilitatorClient as any)
  .register(NETWORK, evmServerScheme)
  .register(BASE_MAINNET, evmServerScheme)
  .registerExtension(agentkitResourceServerExtension);

const routes = {
  "POST /generate": {
    accepts: [
      {
        scheme: "exact",
        price: PRICE,
        network: NETWORK,
        payTo: EVM_ADDRESS,
      },
      {
        scheme: "exact",
        price: PRICE,
        network: BASE_MAINNET,
        payTo: EVM_ADDRESS,
      },
    ],
    extensions: declareAgentkitExtension({
      mode: { type: "free-trial", uses: FREE_TRIAL_USES },
    }),
  },
};

const httpServer = new x402HTTPResourceServer(
  resourceServer,
  routes,
).onProtectedRequest(hooks.requestHook);

// Log when initialization completes (this promise is awaited by payment middleware)
const initStart = Date.now();
httpServer.initialize().then(() => {
  console.log(`[init] httpServer.initialize() completed in ${Date.now() - initStart}ms`);
}).catch((e: any) => {
  console.error(`[init] httpServer.initialize() FAILED in ${Date.now() - initStart}ms: ${e?.message || e}`);
});

// --- Hono app ---
const app = new Hono();

// --- Force HTTPS in request URL (Vercel reports http:// internally) ---
// --- Also cache POST body before payment middleware consumes the stream ---
app.use("/*", async (c, next) => {
  console.log(`[early-mw] ${c.req.method} ${c.req.path}`);
  const proto = c.req.header("x-forwarded-proto");
  if (proto === "https" && c.req.url.startsWith("http://")) {
    const url = new URL(c.req.url);
    url.protocol = "https:";
    Object.defineProperty(c.req.raw, "url", { value: url.toString() });
  }
  // No body caching — payment middleware only reads headers, not body
  return next();
});

// --- Landing page ---
app.get("/", (c) => {
  return c.html(landingPageHtml);
});

// --- Skill file route (serves skills/x402-video-generator/SKILL.md) ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const skillMarkdown = readFileSync(resolve(__dirname, "../skills/x402-video-generator/SKILL.md"), "utf-8");
app.get("/skill.md", (c) => {
  return c.text(skillMarkdown, 200, { "Content-Type": "text/markdown; charset=utf-8" });
});

// --- Facilitator routes ---
if (facilitator402) {
  app.get("/facilitator/supported", (c) => {
    return c.json(facilitator402!.getSupported());
  });

  app.post("/facilitator/verify", async (c) => {
    const { paymentPayload, paymentRequirements } = await c.req.json();
    const result = await facilitator402!.verify(
      paymentPayload,
      paymentRequirements,
    );
    return c.json(result);
  });

  app.post("/facilitator/settle", async (c) => {
    const { paymentPayload, paymentRequirements } = await c.req.json();
    const result = await facilitator402!.settle(
      paymentPayload,
      paymentRequirements,
    );
    return c.json(result);
  });
}

// --- Sponsored AgentBook registration routes ---
if (registrationWalletClient && registrationAccount) {
  app.get("/register", (c) => {
    return c.json({
      enabled: true,
      purpose: "Sponsor AgentBook.register on Base mainnet only",
      sponsoredNetwork: BASE_MAINNET,
      contract: BASE_AGENT_BOOK,
      maxSponsorCostWei: REGISTRATION_MAX_SPONSOR_WEI.toString(),
      maxSponsorCostEth: formatEther(REGISTRATION_MAX_SPONSOR_WEI),
      note: "This endpoint only relays AgentBook registration. It is not an x402 facilitator endpoint.",
    });
  });

  app.post("/register", async (c) => {
    let payload: RegistrationPayload;

    try {
      payload = parseRegistrationPayload(await c.req.json());
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Invalid payload" },
        400,
      );
    }

    if (payload.network !== "base") {
      return c.json(
        {
          code: "UNSUPPORTED_NETWORK",
          error: "This sponsor only supports Base mainnet registration.",
          supportedNetwork: "base",
          manualRegistration: buildManualRegistration(payload),
        },
        400,
      );
    }

    if (payload.contract.toLowerCase() !== BASE_AGENT_BOOK.toLowerCase()) {
      return c.json(
        {
          code: "UNSUPPORTED_CONTRACT",
          error: "This sponsor only submits to the canonical Base AgentBook.",
          expectedContract: BASE_AGENT_BOOK,
          manualRegistration: buildManualRegistration(payload),
        },
        400,
      );
    }

    const existingHumanId = await basePublicClient.readContract({
      address: BASE_AGENT_BOOK,
      abi: LOOKUP_HUMAN_ABI,
      functionName: "lookupHuman",
      args: [payload.agent],
    });

    if (existingHumanId !== 0n) {
      return c.json(
        {
          code: "ALREADY_REGISTERED",
          error: "This agent address is already registered on Base.",
          humanId: `0x${existingHumanId.toString(16)}`,
        },
        409,
      );
    }

    const proof = payload.proof.map((value) => BigInt(value)) as [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
    ];

    try {
      const feeEstimate = await basePublicClient.estimateFeesPerGas();
      const maxFeePerGas = feeEstimate.maxFeePerGas ?? feeEstimate.gasPrice;

      if (!maxFeePerGas) {
        throw new Error("Unable to estimate Base gas fees");
      }

      const gas = await basePublicClient.estimateContractGas({
        account: registrationAccount,
        address: BASE_AGENT_BOOK,
        abi: REGISTER_ABI,
        functionName: "register",
        args: [
          payload.agent,
          BigInt(payload.root),
          BigInt(payload.nonce),
          BigInt(payload.nullifierHash),
          proof,
        ],
      });

      const estimatedSponsorCostWei = gas * maxFeePerGas;

      if (estimatedSponsorCostWei > REGISTRATION_MAX_SPONSOR_WEI) {
        return c.json(
          {
            code: "SPONSOR_GAS_TOO_HIGH",
            error:
              "Base gas is above the sponsor cap right now. Try again later or self-send the transaction.",
            estimatedGas: gas.toString(),
            maxFeePerGas: maxFeePerGas.toString(),
            estimatedSponsorCostWei: estimatedSponsorCostWei.toString(),
            estimatedSponsorCostEth: formatEther(estimatedSponsorCostWei),
            maxSponsorCostWei: REGISTRATION_MAX_SPONSOR_WEI.toString(),
            maxSponsorCostEth: formatEther(REGISTRATION_MAX_SPONSOR_WEI),
            manualRegistration: buildManualRegistration(payload),
          },
          503,
        );
      }

      const { request } = await basePublicClient.simulateContract({
        account: registrationAccount,
        address: BASE_AGENT_BOOK,
        abi: REGISTER_ABI,
        functionName: "register",
        args: [
          payload.agent,
          BigInt(payload.root),
          BigInt(payload.nonce),
          BigInt(payload.nullifierHash),
          proof,
        ],
        maxFeePerGas,
        maxPriorityFeePerGas: feeEstimate.maxPriorityFeePerGas,
      });

      const txHash = await registrationWalletClient.writeContract(request);

      return c.json({
        sponsored: true,
        txHash,
        contract: BASE_AGENT_BOOK,
        network: payload.network,
        estimatedSponsorCostWei: estimatedSponsorCostWei.toString(),
        estimatedSponsorCostEth: formatEther(estimatedSponsorCostWei),
      });
    } catch (error) {
      return c.json(
        {
          code: "REGISTRATION_RELAY_FAILED",
          error:
            error instanceof Error ? error.message : "Registration relay failed",
          manualRegistration: buildManualRegistration(payload),
        },
        400,
      );
    }
  });
}

// --- Debug: simple POST echo to verify POST requests work on Vercel ---
app.post("/debug-post", async (c) => {
  console.log("[debug-post] reached");
  try {
    const body = await c.req.json();
    return c.json({ ok: true, echo: body });
  } catch (e: any) {
    return c.json({ ok: false, error: e?.message });
  }
});

// --- Enrich 402 responses with agent-friendly guidance ---
app.use("/generate", async (c, next) => {
  const method = c.req.method;
  const url = c.req.url;
  const hasAgentkit = !!c.req.header("agentkit");
  const contentType = c.req.header("content-type") || "none";
  console.log(`[generate-mw] ${method} ${url} agentkit=${hasAgentkit} content-type=${contentType}`);


  await next();

  console.log(`[generate-mw] Response: ${c.res.status} payment-required=${!!c.res.headers.get("payment-required")}`);

  // Check for x402 v2 payment-required header (returns 402 status or 200 with header)
  const hasPaymentRequired = !!c.res.headers.get("payment-required");
  if (c.res.status === 402 || hasPaymentRequired) {
    const hasPaymentSig = !!c.req.header("payment-signature");

    const hints: string[] = [];
    if (hasPaymentSig) {
      hints.push(
        "You sent a payment-signature header but it was rejected. The x402 exact scheme requires this format:",
        'Base64 encode: { "x402Version": 2, "payload": { "authorization": { "from": "0x...", "to": "0x...(payTo)", "value": "(amount)", "validAfter": "(unix-600)", "validBefore": "(unix+300)", "nonce": "0x...(random bytes32)" }, "signature": "0x...(EIP-712 sig)" } }',
        "Sign EIP-712 TransferWithAuthorization on USDC. World Chain: contract 0x79A02482A880bCE3F13e09Da970dC34db4CD24d1, domain { name: 'USDC', version: '2', chainId: 480 }. Base: contract 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, domain { name: 'USD Coin', version: '2', chainId: 8453 }.",
        "This is gasless — you only sign, the facilitator submits the transaction.",
      );
    } else if (!hasAgentkit) {
      hints.push(
        'Send an "agentkit" header for free access (if World ID verified), or a "payment-signature" header to pay $1.20 USDC.',
        "Do NOT send both headers in the same request.",
      );
    } else {
      hints.push(
        'An "agentkit" header was present but access was not granted. Possible causes:',
        '- The SIWE message domain must be exactly "x402-worldchain.vercel.app"',
        '- The URI must be exactly "https://x402-worldchain.vercel.app/generate"',
        "- The chainId must be \"eip155:480\" (World Chain)",
        "- Your agent address must be registered in AgentBook on Base",
        "- The nonce must be unique (not reused)",
      );
    }

    // Preserve the payment-required header, return proper 402 with body
    const paymentHeader = c.res.headers.get("payment-required");
    c.res = new Response(JSON.stringify({ error: "Payment required", agentHints: hints }), {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        ...(paymentHeader ? { "payment-required": paymentHeader } : {}),
      },
    });
  }
});

// Wrap payment middleware with logging to diagnose Vercel hangs
const _paymentMw = paymentMiddlewareFromHTTPServer(httpServer);
app.use("/*", async (c, next) => {
  const t0 = Date.now();
  console.log(`[payment-mw] START ${c.req.method} ${c.req.path}`);
  try {
    await _paymentMw(c, next);
    console.log(`[payment-mw] DONE ${c.req.method} ${c.req.path} ${Date.now() - t0}ms status=${c.res?.status}`);
  } catch (e: any) {
    console.error(`[payment-mw] ERROR ${c.req.method} ${c.req.path} ${Date.now() - t0}ms: ${e?.message || e}`);
    throw e;
  }
});

app.post("/generate", async (c) => {
  const startTime = Date.now();
  console.log("[generate] Handler reached, reading body...");
  let body: any;
  try {
    body = await c.req.json();
    console.log("[generate] Body:", JSON.stringify(body).slice(0, 200));
  } catch (e: any) {
    console.error("[generate] Failed to parse body:", e?.message || e);
    return c.json({ error: "Invalid JSON body. Send {\"prompt\": \"...\"}", detail: e?.message }, 400);
  }
  const prompt = body?.prompt;

  if (!prompt || typeof prompt !== "string") {
    console.error("[generate] Missing or invalid prompt:", typeof prompt, prompt);
    return c.json({ error: "prompt is required" }, 400);
  }

  console.log(`[generate] Submitting to fal.ai veo3.1/fast: "${prompt.slice(0, 100)}..."`);

  try {
    const { request_id } = await fal.queue.submit("fal-ai/veo3.1/fast", {
      input: {
        prompt,
        aspect_ratio: "9:16",
        duration: "8s",
        resolution: "720p",
        generate_audio: true,
      },
    });

    const elapsed = Date.now() - startTime;
    console.log(`[generate] SUCCESS queued=${request_id} elapsed=${elapsed}ms`);

    return c.json({
      requestId: request_id,
      status: "queued",
      prompt,
      pollUrl: `https://x402-worldchain.vercel.app/status/${request_id}`,
    });
  } catch (e: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[generate] FAILED elapsed=${elapsed}ms error=${e?.message || e}`, e);
    return c.json({ error: "Video generation failed to queue", detail: e?.message }, 500);
  }
});

app.get("/status/:id", async (c) => {
  const requestId = c.req.param("id");
  console.log(`[status] Checking ${requestId}`);

  try {
    const status = await fal.queue.status("fal-ai/veo3.1/fast", {
      requestId,
      logs: false,
    });
    console.log(`[status] ${requestId} -> ${status.status}`);

    if (status.status === "COMPLETED") {
      try {
        const result = await fal.queue.result("fal-ai/veo3.1/fast", {
          requestId,
        });
        console.log(`[status] ${requestId} result fetched, keys: ${Object.keys(result.data || {}).join(",")}`);
        return c.json({
          status: "completed",
          requestId,
          video: result.data,
        });
      } catch (e: any) {
        console.error(`[status] ${requestId} result fetch failed: ${e?.message || e}`);
        return c.json({ status: "completed", requestId, error: "Result fetch failed, retry this request" });
      }
    }

    return c.json({
      status: status.status === "IN_QUEUE" ? "queued" : "processing",
      requestId,
    });
  } catch (e: any) {
    console.error(`[status] ${requestId} status check failed: ${e?.message || e}`);
    return c.json({ status: "unknown", requestId, error: "Status check failed, retry this request" });
  }
});

// --- Export for Vercel ---
export default app;

// --- Start server (local dev) ---
if (process.env.NODE_ENV !== "production") {
  console.log(`Starting x402 video proxy on port ${PORT}`);
  serve({ fetch: app.fetch, port: PORT });
}

type RegistrationPayload = {
  agent: `0x${string}`;
  root: string;
  nonce: string;
  nullifierHash: string;
  proof: string[];
  contract: string;
  network: string;
};

function parseRegistrationPayload(input: unknown): RegistrationPayload {
  if (!input || typeof input !== "object") {
    throw new Error("Expected a JSON object");
  }

  const payload = input as Record<string, unknown>;
  const agent = String(payload.agent ?? "");
  const contract = String(payload.contract ?? "");
  const network = String(payload.network ?? "");
  const root = String(payload.root ?? "");
  const nonce = String(payload.nonce ?? "");
  const nullifierHash = String(payload.nullifierHash ?? "");
  const proof = payload.proof;

  if (!ADDRESS_REGEX.test(agent)) {
    throw new Error("Invalid agent address");
  }

  if (!ADDRESS_REGEX.test(contract)) {
    throw new Error("Invalid contract address");
  }

  if (!Array.isArray(proof) || proof.length !== 8) {
    throw new Error("Proof must be an array of 8 uint256 values");
  }

  for (const value of [root, nonce, nullifierHash, ...proof]) {
    BigInt(String(value));
  }

  return {
    agent: agent as `0x${string}`,
    root,
    nonce,
    nullifierHash,
    proof: proof.map((value) => String(value)),
    contract,
    network,
  };
}

function buildManualRegistration(payload: RegistrationPayload) {
  return {
    contract: payload.contract,
    function:
      "register(address agent, uint256 root, uint256 nonce, uint256 nullifierHash, uint256[8] proof)",
    args: {
      agent: payload.agent,
      root: payload.root,
      nonce: payload.nonce,
      nullifierHash: payload.nullifierHash,
      proof: payload.proof,
    },
  };
}

function parseBigIntEnv(name: string, fallback: string): bigint {
  const value = process.env[name] || fallback;

  try {
    return BigInt(value);
  } catch {
    throw new Error(`${name} must be a valid integer string in wei`);
  }
}

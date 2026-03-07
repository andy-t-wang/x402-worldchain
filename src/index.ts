import "dotenv/config";
import { landingPageHtml } from "./landing.js";
import { skillMarkdown } from "./skill.js";
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
const PRICE = "$0.55";
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
const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "https://x402.org/facilitator";
const FAL_KEY = process.env.FAL_KEY!;
const FACILITATOR_PRIVATE_KEY = process.env.FACILITATOR_PRIVATE_KEY as
  | `0x${string}`
  | undefined;
const BASE_RPC_URL = process.env.BASE_RPC_URL || DEFAULT_BASE_RPC_URL;

if (!EVM_ADDRESS) throw new Error("EVM_ADDRESS is required");
if (!FAL_KEY) throw new Error("FAL_KEY is required");

fal.config({ credentials: FAL_KEY });

// --- AgentKit setup ---
const agentBook = createAgentBookVerifier();
const storage = new InMemoryAgentKitStorage();
const hooks = createAgentkitHooks({
  agentBook,
  storage,
  mode: { type: "free-trial", uses: FREE_TRIAL_USES },
  onEvent: (event) => console.log("[agentkit]", event.type, event),
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
  facilitator402 = new x402Facilitator().register(
    WORLD_CHAIN,
    new ExactEvmFacilitatorScheme(facilitatorSigner),
  );
  console.log(
    `[facilitator] World Chain facilitator enabled for ${facilitatorAccount.address}`,
  );
}

// --- x402 resource server setup ---
const WORLD_CHAIN_USDC = "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1";
const evmServerScheme = new ExactEvmServerScheme().registerMoneyParser(
  async (amount, network) => {
    if (network === WORLD_CHAIN) {
      const tokenAmount = Math.round(amount * 1e6).toString();
      return {
        amount: tokenAmount,
        asset: WORLD_CHAIN_USDC,
        extra: { name: "USD Coin", version: "2" },
      };
    }
    return null;
  },
);

const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitator).registerExtension(
  agentkitResourceServerExtension,
);
resourceServer.register(WORLD_CHAIN, evmServerScheme);

const routes = {
  "POST /generate": {
    accepts: {
      scheme: "exact",
      network: NETWORK,
      payTo: EVM_ADDRESS,
      price: PRICE,
    },
    description: "Generate a video from a text prompt",
    extensions: declareAgentkitExtension({
      mode: { type: "free-trial", uses: FREE_TRIAL_USES },
    }),
  },
};

const httpServer = new x402HTTPResourceServer(
  resourceServer,
  routes,
).onProtectedRequest(hooks.requestHook);

// --- Hono app ---
const app = new Hono();

// --- Landing page ---
app.get("/", (c) => {
  return c.html(landingPageHtml);
});

// --- Skill file route ---
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

// --- Enrich 402 responses with agent-friendly guidance ---
app.use("/generate", async (c, next) => {
  await next();
  if (c.res.status === 402) {
    const original = await c.res.json().catch(() => ({}));
    const hasAgentkitHeader = !!c.req.header("agentkit");
    c.res = undefined as any;

    const hints: string[] = [];
    if (!hasAgentkitHeader) {
      hints.push(
        'You did not send an "agentkit" header. Verified agents (registered in AgentBook with World ID) can generate for free.',
        "To authenticate: construct a SIWE message for domain \"x402-worldchain.vercel.app\" and URI \"https://x402-worldchain.vercel.app/generate\", sign it with your wallet (EIP-191), then send the base64-encoded JSON payload as the \"agentkit\" header.",
      );
    } else {
      hints.push(
        'An "agentkit" header was present but access was not granted. Possible causes:',
        '- The SIWE message domain must be exactly "x402-worldchain.vercel.app"',
        '- The URI must be exactly "https://x402-worldchain.vercel.app/generate"',
        "- The chainId must be \"eip155:8453\" (Base mainnet, where AgentBook lives)",
        "- issuedAt must be within the last 5 minutes",
        "- Your agent address must be registered in AgentBook on Base",
        "- The nonce must be unique (not reused from a previous request)",
      );
    }

    hints.push(
      "If you are not registered in AgentBook, run: npx @worldcoin/agentkit-cli register <your-agent-address>",
      "Alternatively, pay $0.55 via x402 (exact scheme on eip155:480 World Chain) using @x402/client.",
    );

    return c.json(
      {
        ...original,
        agentHints: hints,
      },
      402,
    );
  }
});

app.use("/*", paymentMiddlewareFromHTTPServer(httpServer));

app.post("/generate", async (c) => {
  console.log("[generate] Handler reached");
  let body: any;
  try {
    body = await c.req.json();
  } catch (e) {
    console.error("[generate] Failed to parse request body:", e);
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const prompt = body?.prompt;

  if (!prompt || typeof prompt !== "string") {
    return c.json({ error: "prompt is required" }, 400);
  }

  const fullPrompt = `Create a 10-second vertical 9:16 TikTok-style video with voiceover narration. ${prompt}`;
  console.log(`[generate] Submitting video for prompt: "${fullPrompt}"`);

  try {
    const { request_id } = await fal.queue.submit("fal-ai/minimax-video", {
      input: { prompt: fullPrompt },
    });

    console.log(`[generate] Queued with request_id: ${request_id}`);

    return c.json({
      requestId: request_id,
      status: "queued",
      prompt,
      pollUrl: `https://x402-worldchain.vercel.app/status/${request_id}`,
    });
  } catch (e) {
    console.error("[generate] fal.queue.submit failed:", e);
    return c.json({ error: "Video generation failed to queue" }, 500);
  }
});

app.get("/status/:id", async (c) => {
  const requestId = c.req.param("id");

  const status = await fal.queue.status("fal-ai/minimax-video", {
    requestId,
    logs: false,
  });

  if (status.status === "COMPLETED") {
    const result = await fal.queue.result("fal-ai/minimax-video", {
      requestId,
    });
    return c.json({
      status: "completed",
      requestId,
      video: result.data,
    });
  }

  return c.json({
    status: status.status === "IN_QUEUE" ? "queued" : "processing",
    requestId,
  });
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

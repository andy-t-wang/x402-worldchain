import "dotenv/config";
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
import { toFacilitatorEvmSigner } from "@x402/evm";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { worldchain } from "viem/chains";
import {
  createAgentBookVerifier,
  InMemoryAgentKitStorage,
  createAgentkitHooks,
  declareAgentkitExtension,
  agentkitResourceServerExtension,
} from "@worldcoin/agentkit";

// --- Config ---
const NETWORK = "eip155:84532" as const; // Base Sepolia
const PRICE = "$0.55";
const FREE_TRIAL_USES = 1;
const PORT = 4021;

const WORLD_CHAIN = "eip155:480" as const;

const EVM_ADDRESS = process.env.EVM_ADDRESS!;
const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "https://x402.org/facilitator";
const FAL_KEY = process.env.FAL_KEY!;
const FACILITATOR_PRIVATE_KEY = process.env.FACILITATOR_PRIVATE_KEY as
  | `0x${string}`
  | undefined;

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
const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitator).registerExtension(
  agentkitResourceServerExtension,
);

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

app.use("/*", paymentMiddlewareFromHTTPServer(httpServer));

app.post("/generate", async (c) => {
  const body = await c.req.json();
  const prompt = body?.prompt;

  if (!prompt || typeof prompt !== "string") {
    return c.json({ error: "prompt is required" }, 400);
  }

  console.log(`[generate] Generating video for prompt: "${prompt}"`);

  const result = await fal.subscribe("fal-ai/minimax-video", {
    input: { prompt },
  });

  return c.json({ video: result.data, prompt });
});

// --- Export for Vercel ---
export default app;

// --- Start server (local dev) ---
if (process.env.NODE_ENV !== "production") {
  console.log(`Starting x402 video proxy on port ${PORT}`);
  serve({ fetch: app.fetch, port: PORT });
}

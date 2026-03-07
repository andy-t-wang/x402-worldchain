import { handle } from "@hono/node-server/vercel";
import app from "../src/index.js";

export default handle(app);

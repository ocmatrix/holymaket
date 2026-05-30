import Fastify, { type FastifyInstance } from "fastify";

import { registerHealthRoutes } from "./routes/health.js";
import { registerMarketRoutes } from "./routes/markets.js";
import { registerUserRoutes } from "./routes/users.js";

export async function buildApiServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
  });

  await registerHealthRoutes(app);
  await registerMarketRoutes(app);
  await registerUserRoutes(app);

  return app;
}

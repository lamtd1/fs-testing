import { createLogger } from "@app/shared";
import { env } from "../config/env.js";

export const logger = createLogger({ name: "user-service", nodeEnv: env.NODE_ENV });

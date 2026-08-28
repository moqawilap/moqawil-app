import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { logger } from "./lib/logger";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";

const app: Express = express();
const trustedOrigins = new Set(
  [process.env.REPLIT_DEV_DOMAIN, process.env.REPLIT_EXPO_DEV_DOMAIN, ...(process.env.REPLIT_DOMAINS ?? "").split(",")]
    .filter((domain): domain is string => Boolean(domain?.trim()))
    .map((domain) => domain.startsWith("http") ? domain.trim() : `https://${domain.trim()}`),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({
  credentials: false,
  origin(origin, callback) {
    // Non-browser clients (including bearer-token curl/API clients) do not send Origin.
    if (!origin || trustedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("CORS origin is not trusted"));
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(clerkMiddleware());

app.use("/api", router);

export default app;

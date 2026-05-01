import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import { rateLimit } from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { statusCheck } from "./middlewares/status-check";

const app: Express = express();
app.set("trust proxy", true);

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
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "session",
    }),
    secret: process.env.SESSION_SECRET ?? "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "development" ? "lax" : "none",
      secure: process.env.NODE_ENV !== "development",
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    },
  }),
);


// Rate limiting to prevent brute force and abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 1000, // Limit each IP to 1000 requests per 15 minutes (to allow for polling)
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 15, // Limit each IP to 15 requests per minute
  message: { message: "Too many login attempts, please try again after a minute" },
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

app.use("/api/auth/login", loginLimiter);
app.use("/api", apiLimiter);
app.use("/api", statusCheck);
app.use("/api", router);

export default app;

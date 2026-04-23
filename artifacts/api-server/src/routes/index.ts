import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import postsRouter from "./posts";
import statsRouter from "./stats";
import notificationsRouter from "./notifications";
import draftsRouter from "./drafts";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/posts", postsRouter);
router.use("/stats", statsRouter);
router.use("/notifications", notificationsRouter);
router.use("/drafts", draftsRouter);

export default router;

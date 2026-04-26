import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import postsRouter from "./posts";
import postsBookmarksRouter from "./posts-bookmarks";
import postsActivityRouter from "./posts-activity";
import statsRouter from "./stats";
import notificationsRouter from "./notifications";
import draftsRouter from "./drafts";
import verificationRouter from "./verification";
import likesRouter from "./likes";
import commentsRouter from "./comments";
import dmRouter from "./dm";
import plannerRouter from "./planner";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/dm", dmRouter);
router.use("/likes", likesRouter);
router.use("/auth", authRouter);
router.use("/posts/bookmarks", postsBookmarksRouter);
router.use("/posts/activity", postsActivityRouter);
router.use("/posts", postsRouter);
router.use("/comments", commentsRouter);
router.use("/stats", statsRouter);
router.use("/notifications", notificationsRouter);
router.use("/drafts", draftsRouter);
router.use("/auth/student-verification", verificationRouter);
router.use("/planner", plannerRouter);

export default router;

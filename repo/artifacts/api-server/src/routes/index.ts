import { Router, type IRouter } from "express";
import healthRouter from "./health";
import signalsRouter from "./signals";
import statsRouter from "./stats";
import performanceRouter from "./performance";
import serverResourcesRouter from "./server-resources";
import journalRouter from "./journal";
import backtestRouter from "./backtest";
import checklistRouter from "./checklist";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(signalsRouter);
router.use(statsRouter);
router.use(performanceRouter);
router.use(serverResourcesRouter);
router.use(journalRouter);
router.use(backtestRouter);
router.use(checklistRouter);
router.use(reportsRouter);

export default router;

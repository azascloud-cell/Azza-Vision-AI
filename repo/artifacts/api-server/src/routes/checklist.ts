import { Router } from "express";

const router = Router();

router.get("/checklist/latest", (_req, res) => {
  res.json({
    h4trend: "STRONG_BUY",
    h1trend: "STRONG_BUY",
    confidence: 76,
    status: "BULLISH",
    lydiaComment: "Market dalam mode STRONG_BUY. Level 4100 jadi support kunci hari ini. Perhatikan resistance di 4115.",
  });
});

export default router;

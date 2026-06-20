import { Router } from "express";
import { buildMarketState } from "../market/service.js";

export const tokenShopRouter = Router();

tokenShopRouter.get("/token-shop", async (_req, res) => {
  const market = await buildMarketState(null);
  res.json(market);
});
import { Router } from "express";
import { buildTokenShopInfo } from "../tokenShop/catalog.js";

export const tokenShopRouter = Router();

tokenShopRouter.get("/token-shop", async (_req, res) => {
  const info = await buildTokenShopInfo(null);
  res.json(info);
});
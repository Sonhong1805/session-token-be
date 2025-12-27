import { Router } from "express";
import authRoutes from "./auth.route";
import { ENV } from "~/configs/env";

const router = Router();

router.use(`${ENV.apiVersion}/auth`, authRoutes);

router.get("/", (req, res) => {
  res.send("Welcome to the website event ticket!");
});

export default router;

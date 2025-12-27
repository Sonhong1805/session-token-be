import { Router } from "express";
import authController from "~/controllers/auth.controller";
import authenticate from "~/middlewares/authenticate.middleware";

const router = Router();

router.post("/register", authController.register);

router.post("/login", authController.login);

router.post("/logout", authController.logout);

router.get("/refresh-token", authController.refreshToken);

router.get("/me", authenticate, authController.me);

router.get("/users", authController.getAllUsers);

export default router;

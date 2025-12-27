import express from "express";
import { createServer } from "http";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";
import { ENV } from "./configs/env";
import { corsConfig } from "./configs/cors";
import router from "./routes";
import { errorHandler, notFound } from "./middlewares/error.middleware";

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan("dev"));
app.use(cookieParser());
// app.use("/public", express.static("public"));

// Cấu hình CORS
app.use(cors(corsConfig));

// Đăng ký routes
app.use(router);

// Middleware 404
app.use(notFound);

// Middleware xử lý lỗi
app.use(errorHandler);

httpServer.listen(ENV.port, () => {
  console.log(`Server running at http://localhost:${ENV.port}`);
});


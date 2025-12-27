import { ENV } from "./env";

export const corsConfig = {
  origin: [ENV.clientUrl].filter(Boolean),
  credentials: true,
  optionsSuccessStatus: 200,
};

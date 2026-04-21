const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

if (process.env.S360_ALLOW_INSECURE_TLS === "true") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const appConfig = {
  port: Number.parseInt(process.env.PORT || "3000", 10),
  sessionSecret: process.env.APP_SESSION_SECRET || "dev-only-secret-change-me",
  sqlitePath: path.resolve(
    process.cwd(),
    process.env.SQLITE_PATH || "./data/app.db"
  ),
};

const s360Config = {
  defaultBaseUrl: process.env.S360_BASE_URL || "https://api.s360web.com",
  defaultUsername: process.env.S360_API_USERNAME || "",
  defaultPassword: process.env.S360_API_PASSWORD || "",
  defaultSubscriptionKey: process.env.S360_SUBSCRIPTION_KEY || "",
};

module.exports = {
  appConfig,
  s360Config,
};

import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./tests",
    timeout: 90_000,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? "github" : "list",
    use: {
        baseURL: "http://localhost:7891",
        browserName: "chromium",
    },
    webServer: {
        command: "node tests/server.mjs",
        url: "http://localhost:7891",
        reuseExistingServer: !process.env.CI,
        timeout: 15_000,
    },
});

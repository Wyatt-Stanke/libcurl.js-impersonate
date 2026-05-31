import { test, expect } from "@playwright/test";

test("libcurl.js fetches example.com through Wisp", async ({ page }) => {
    page.on("console", (msg) => {
        if (msg.type() === "error") console.error("[browser]", msg.text());
    });
    page.on("pageerror", (err) => console.error("[page error]", err.message));

    await page.goto("/");

    const summary = page.locator("#test-summary");
    await expect(summary).toBeVisible({ timeout: 60_000 });

    const result = await summary.getAttribute("data-result");
    const text = await summary.textContent();

    console.log("Test summary:", text);

    expect(result).toBe("pass");
});

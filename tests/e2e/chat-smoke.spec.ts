import { test, expect } from "@playwright/test";

test("chat page renders native thread shell", async ({ page }) => {
  await page.goto("/chat");

  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  await expect(page.getByPlaceholder("Ask about schema, query with sql: SELECT ..., or say neon demo")).toBeVisible();
});

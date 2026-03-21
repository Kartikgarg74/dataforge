import { beforeAll, describe, expect, it } from "vitest";
import { executeQuery } from "@/db/connection";

describe("db/connection executeQuery", () => {
  beforeAll(() => {
    process.env.DB_PROVIDER = "sqlite";
  });

  it("runs read-only select queries", async () => {
    const result = await executeQuery("SELECT 1 AS one");

    expect(result.columns).toContain("one");
    expect(result.results[0]).toEqual({ one: 1 });
  });

  it("blocks non-read-only statements", async () => {
    await expect(executeQuery("DELETE FROM sales")).rejects.toThrow(
      "Only read-only SELECT queries are allowed",
    );
  });

  it("blocks stacked queries", async () => {
    await expect(executeQuery("SELECT 1; SELECT 2")).rejects.toThrow(
      "Multiple statements are not allowed",
    );
  });
});

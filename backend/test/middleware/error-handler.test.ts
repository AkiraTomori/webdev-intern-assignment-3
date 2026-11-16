import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorHandler, notFoundHandler } from "../../middleware/error-handler";

// A route that is not the candidate lookup: it must not inherit the SBD-specific error code.
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.get("/api/other/:value", (req, res) => res.json({ data: req.params.value }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

describe("errorHandler", () => {
  it("maps a malformed URL escape to generic INVALID_PARAMETER, not INVALID_SBD", async () => {
    const res = await fetch(`${baseUrl}/api/other/%E0%A4%A`);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_PARAMETER");
  });
});

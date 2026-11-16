import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { startServer } from "../../util/start-server";

const open: Server[] = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

describe("startServer", () => {
  it("resolves with a listening server", async () => {
    const server = await startServer(express(), 0);
    open.push(server);
    expect((server.address() as AddressInfo).port).toBeGreaterThan(0);
  });

  it("rejects when the port is already taken, so index.ts can exit instead of pretending to listen", async () => {
    const first = await startServer(express(), 0);
    open.push(first);
    const { port } = first.address() as AddressInfo;
    await expect(startServer(express(), port)).rejects.toMatchObject({ code: "EADDRINUSE" });
  });
});

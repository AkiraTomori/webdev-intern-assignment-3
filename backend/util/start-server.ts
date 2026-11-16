import type { Express } from "express";
import type { Server } from "node:http";

/**
 * Express 5 reports a listen failure (EADDRINUSE, EACCES) through the listen callback, not by throwing.
 * This turns it into a rejected promise so the caller cannot report "listening" for a server that is not.
 */
export function startServer(app: Express, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, (error?: Error) => {
      if (error) reject(error);
      else resolve(server);
    });
  });
}

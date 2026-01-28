// Server factory for BIOMON
// Creates Express + Socket.io server with CORS configuration
// Used by both production server and integration tests

import express, { type Express } from "express";
import { createServer as createHTTPServer, type Server as HTTPServer } from "http";
import { Server } from "socket.io";
import type { TypedServer } from "./src/types/index.js";

export interface ServerOptions {
  corsOrigin?: string | string[];
}

export interface ServerInstance {
  app: Express;
  server: HTTPServer;
  io: TypedServer;
}

/**
 * Creates an Express + Socket.io server with CORS configuration
 * @param options - Server options
 * @param options.corsOrigin - CORS origin(s) to allow
 * @returns { app, server, io } - Express app, HTTP server, and Socket.io instance
 */
export function createServer(options: ServerOptions = {}): ServerInstance {
  const app = express();
  const server = createHTTPServer(app);

  // Parse CORS origin - supports single string or array
  let corsOrigin: string | string[] = options.corsOrigin || "http://localhost:3051";

  // If it's a string with commas, split it into an array
  if (typeof corsOrigin === "string" && corsOrigin.includes(",")) {
    corsOrigin = corsOrigin.split(",").map(origin => origin.trim());
  }

  const io: TypedServer = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  return { app, server, io };
}

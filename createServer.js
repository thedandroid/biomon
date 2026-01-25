// Server factory for BIOMON
// Creates Express + Socket.io server with CORS configuration
// Used by both production server and integration tests

import express from "express";
import http from "http";
import { Server } from "socket.io";

/**
 * Creates an Express + Socket.io server with CORS configuration
 * @param {object} options - Server options
 * @param {string|string[]} options.corsOrigin - CORS origin(s) to allow
 * @returns {object} { app, server, io } - Express app, HTTP server, and Socket.io instance
 */
export function createServer(options = {}) {
  const app = express();
  const server = http.createServer(app);

  // Parse CORS origin - supports single string or array
  let corsOrigin = options.corsOrigin || "http://localhost:3051";
  
  // If it's a string with commas, split it into an array
  if (typeof corsOrigin === "string" && corsOrigin.includes(",")) {
    corsOrigin = corsOrigin.split(",").map(origin => origin.trim());
  }

  const io = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  return { app, server, io };
}

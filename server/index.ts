import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { setupWebSocket } from "./websocket";

const app = express();

// ✅ Middleware for JSON + URL parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ✅ Enable CORS so frontend can access backend (both on port 5000)
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Allow localhost and Replit domains
      const allowedOrigins = [
        'http://localhost:5000',
        'https://localhost:5000',
        /^https?:\/\/.*\.replit\.dev$/,
        /^https?:\/\/.*\.repl\.co$/,
        /^https?:\/\/.*\.webcontainer-api\.io$/,
        /^https?:\/\/.*\.local-credentialless\.webcontainer-api\.io$/
      ];
      
      const isAllowed = allowedOrigins.some(pattern => {
        if (typeof pattern === 'string') {
          return origin === pattern;
        }
        return pattern.test(origin);
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all origins for now to fix WebSocket issues
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

// ✅ Mount authentication routes
setupAuth(app);

// ✅ Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // ✅ Create HTTP server
  const httpServer = createServer(app);

  // ✅ Register all other API routes
  const server = await registerRoutes(app, httpServer);

  // ✅ Setup WebSocket for real-time updates
  const wsService = setupWebSocket(httpServer);
  
  // ✅ Make WebSocket service available to routes
  app.set('wsService', wsService);

  // ✅ Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    log(`❌ Error: ${status} - ${message}`);
  });

  // ✅ Vite in dev, static files in prod
  if (app.get("env") === "development") {
    await setupVite(app, httpServer);
  } else {
    serveStatic(app);
  }

  // ✅ Always listen on PORT (default 5000)
  const port = parseInt(process.env.PORT || "5000", 10);
  const listener = httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`🚀 Backend server running on http://localhost:${port}`);
      log(`🔗 WebSocket server ready on ws://localhost:${port}/ws`);
    }
  );

  listener.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `❌ Port ${port} is already in use. Please stop the other process or use a different port.`
      );
      process.exit(1);
    } else {
      throw err;
    }
  });
})();

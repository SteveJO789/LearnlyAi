import express, { type Express } from "express";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/health/live", (_request, response) => {
    response.status(200).json({
      data: {
        status: "ok",
      },
    });
  });

  app.get("/health/ready", (_request, response) => {
    response.status(200).json({
      data: {
        status: "ready",
        checks: {
          api: "ok",
        },
      },
    });
  });

  return app;
}

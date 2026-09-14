import { createApp } from "./app.js";

const DEFAULT_PORT = 8000;
const requestedPort = Number.parseInt(process.env.PORT ?? "", 10);
const port = Number.isInteger(requestedPort) ? requestedPort : DEFAULT_PORT;

const app = createApp();

app.listen(port, "0.0.0.0", () => {
  console.log("Learnly AI API listening on port " + port);
});

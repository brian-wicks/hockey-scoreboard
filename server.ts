import { createScoreboardServer } from "./serverApp.ts";

const PORT = process.env.PORT || 3696;

const server = createScoreboardServer();
server.start(Number(PORT)).then((port) => {
  console.log(`Server running on http://localhost:${port}`);
});

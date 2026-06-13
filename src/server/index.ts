import { createApp } from "./app.js";
import { openDatabase } from "./database.js";

const port = Number(process.env.PORT ?? 4000);
const db = openDatabase();
const app = createApp({ db });

const server = app.listen(port, () => {
  console.log(`SignalStack API listening on http://localhost:${port}`);
});

process.on("SIGTERM", () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
});


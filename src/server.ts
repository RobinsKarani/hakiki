import { createLocalServer, defaultServerOptions } from "./http.ts";

const port = Number(process.env.PORT) || 4317;
const host = process.env.HOST || (process.env.PORT ? "0.0.0.0" : "127.0.0.1");

const app = createLocalServer(defaultServerOptions);
app.server.listen(port, host, () => {
  console.log(`Review interface running on http://${host}:${port}`);
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    app.cancelAll();
    app.server.close();
  });

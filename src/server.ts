import { createLocalServer, defaultServerOptions } from "./http.ts";

const app = createLocalServer(defaultServerOptions);
app.server.listen(4317, "127.0.0.1", () => {
  console.log("Local review interface: http://127.0.0.1:4317");
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    app.cancelAll();
    app.server.close();
  });

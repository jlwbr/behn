#!/usr/bin/env bun

import { program } from "commander";
import { readConfig } from "../config";
import { Router } from "../router";
import { join } from "path";
import { cwd } from "process";

program.command("run").action(async () => {
  const config = await readConfig();
  const router = new Router({ basePath: join(cwd(), config.basePath) });

  await router.addAll();

  const server = Bun.serve({
    hostname: config.server.hostname,
    port: config.server.port,
    fetch(req) {
      const url = new URL(req.url);

      return router.match(url, req);
    },
  });

  console.log(
    `🦊 Behn is running at http://${server.hostname}:${server.port}/`,
  );
});

program.command("dev").action(async () => {
  const config = await readConfig();
  const router = new Router({
    basePath: join(cwd(), config.basePath),
    devMode: true,
  });

  const server = Bun.serve({
    hostname: config.server.hostname,
    port: config.server.port,
    fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname.startsWith("/.htmx/hotreload")) {
        if (server.upgrade(req)) {
          return; // do not return a Response
        }
        return new Response("Upgrade failed :(", { status: 500 });
      }

      return router.match(url, req);
    },
    websocket: {
      message() {},
      open(ws) {
        ws.subscribe("reload");
      },
      close(ws) {
        ws.unsubscribe("reload");
      },
      drain() {},
    },
  });

  router.server = server;
  await router.watch();
  console.log(
    `🦊 Behn is running at http://${server.hostname}:${server.port}/`,
  );
});

program.parse();

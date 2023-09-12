#!/usr/bin/env bun

import { program } from "commander";
import { App } from "../app";
import { readConfig } from "../config";

program.command("run").action(async () => {
  const config = await readConfig()
  const app = new App({ config })

  await app.initialRender();
  await app.startServer();

  console.log(
    `🦊 Behn is running at ${app.config.server.hostname}:${app.config.server.port}`
  );
});

program.command("dev").action(async () => {
  const config = await readConfig()
  const app = new App({ config })

  await app.initialRender();
  await app.startDevServer();

  console.log(
    `🦊 Behn is running at ${app.config.server.hostname}:${app.config.server.port}`
  );
});

program.parse()

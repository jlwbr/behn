#!/usr/bin/env bun

import { program } from "commander";
import { App } from "../app";
import { readConfig } from "../config";

program.command("run").action(async () => {
  const config = await readConfig()
  const app = new App({ config })

  await app.initialRender();
  await app.startServer();

  // console.log(
  //   `🦊 Behn is running at ${app.server?.hostname}:${app.server?.port}`
  // );
});

// program.command("").action(() => {
//   const app = new Elysia().use(html()).use(bundle).listen(3000);
//
//   console.log(
//     `🦊 Behn is running at ${app.server?.hostname}:${app.server?.port}`
//   );
// });

program.parse()

#!/usr/bin/env bun

import * as p from "@clack/prompts";
import { program } from "commander";
import process from "process";
import { createProjectDir } from "./utils/createProjectDir";
import { scaffoldProject } from "./utils/scaffoldProject";
import { installDependencies } from "./utils/installDependencies";
import { initializeGit } from "./utils/git";

program.argument("[dir]", "The name of the app").parse();

const cliProvidedName = program.args[0];

const project = await p.group(
  {
    ...(!cliProvidedName && {
      name: () =>
        p.text({
          message: "What will your project be called?",
          defaultValue: cliProvidedName,
        }),
    }),
    git: () => {
      return p.confirm({
        message: "Should we initialize a Git repository and stage the changes?",
      });
    },
  },
  {
    onCancel() {
      process.exit(1);
    },
  },
);

const path = await createProjectDir(cliProvidedName ?? project.name);

await scaffoldProject(path, { name: cliProvidedName ?? project.name });

if (project.git) {
  await initializeGit(path);
}

await installDependencies({ projectDir: path });

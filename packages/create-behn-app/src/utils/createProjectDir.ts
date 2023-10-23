import fs from "fs/promises";
import { resolve } from "path";
import { cwd } from "process";

export const createProjectDir = async (name: string) => {
  const resolvedPath = resolve(cwd(), name);
  if (!(await fs.exists(resolvedPath))) {
    await fs.mkdir(resolvedPath);
  }

  return resolvedPath;
};

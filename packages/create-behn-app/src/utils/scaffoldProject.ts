import path from "path";

import { getFiles } from "./getFiles";
import { compile } from "handlebars";
import fs from "fs/promises";

export const scaffoldProject = async (dir: string, templateData: any) => {
  const templateDir = path.resolve(import.meta.path, "../../../template");
  for await (const filePath of getFiles(templateDir)) {
    const relativePath = path.relative(templateDir, filePath);
    const absolutePath = path.join(dir, relativePath);
    const pathInfo = path.parse(absolutePath);

    const file = Bun.file(filePath);
    const template = compile(await file.text());

    if (!(await fs.exists(pathInfo.dir))) {
      await fs.mkdir(pathInfo.dir, { recursive: true });
    }

    Bun.write(path.join(pathInfo.dir, pathInfo.name), template(templateData));
  }
};

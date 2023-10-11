import { extname, join } from "path";
import Bun, { BuildArtifact } from "bun";

export type Script = {
  data: BuildArtifact;
};

const clientEntry = await import.meta.resolve("./client/main.ts");
const hmr = await import.meta.resolve("./client/hotreload.ts");

export const bundle = async ({ devMode }: { devMode: boolean }) => {
  const entrypoints = [clientEntry];
  if (devMode) entrypoints.push(hmr);

  const client = await Bun.build({
    entrypoints,
    splitting: true,
    minify: true,
    sourcemap: devMode ? "inline" : "none",
  });

  if (!client.success)
    throw new AggregateError(client.logs, "Build failed, bailing");

  const scripts: Map<string, Script> = new Map();

  for (const output of client.outputs) {
    const path = join("/.htmx/scripts", `${output.path}`);

    scripts.set(path, { data: output });
  }

  return { client: scripts };
};

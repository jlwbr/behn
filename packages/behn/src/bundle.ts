import { join } from "path";
import Bun, { BuildArtifact } from "bun";

export type Script = {
  data: BuildArtifact;
};

const clientEntry = import.meta.resolveSync("./client/main.ts");
const hmr = import.meta.resolveSync("./client/hotreload.ts");

export const bundleServerFile = async ({
  file,
  devMode,
}: {
  file: string;
  devMode: boolean;
}) =>
  await Bun.build({
    entrypoints: [file],
    splitting: false,
    target: "bun",
    minify: !devMode,
    sourcemap: devMode ? "inline" : "none",
    outdir: ".behn",
    naming: "[dir]/[name]-[hash].[ext]"
  });

export const bundle = async ({ devMode }: { devMode: boolean }) => {
  const entrypoints = [clientEntry];
  if (devMode) entrypoints.push(hmr);

  const client = await Bun.build({
    entrypoints,
    splitting: true,
    minify: !devMode,
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

import Bun, { BuildArtifact } from "bun";

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
    root: ".",
  });

export const bundle = async ({ devMode }: { devMode: boolean }) => {
  const entrypoints = [clientEntry];
  if (devMode) entrypoints.push(hmr);

  console.log(`📦 Bundling client`);
  const client = await Bun.build({
    entrypoints,
    splitting: true,
    minify: !devMode,
    sourcemap: devMode ? "inline" : "none",
  });

  if (!client.success)
    throw new AggregateError(client.logs, "Build failed, bailing");

  const scripts: Map<string, BuildArtifact> = new Map();

  for (const output of client.outputs) {
    const name = output.path.replace(/.\//, "");
    scripts.set(name, output);
  }

  return { client: scripts };
};

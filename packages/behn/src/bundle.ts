import { extname, join } from "path";
import Bun, { BuildArtifact } from "bun";

export type Script = {
  src: string;
  data: BuildArtifact;
};

const clientEntry = await import.meta.resolve("./client/main.ts");

const bundleClient = () =>
  Bun.build({
    entrypoints: [clientEntry],
    splitting: true,
    minify: true,
  });

export const bundle = async () => {
  const client = await bundleClient();

  if (!client.success) {
    throw new AggregateError(client.logs, "Build failed, bailing");
  }

  const scripts: Script[] = [];

  for (const output of client.outputs) {
    const extension = extname(output.path);
    const path = join(".htmx", `${output.hash}${extension}`);

    scripts.push({ src: path, data: output });
  }

  return { client: scripts };
};

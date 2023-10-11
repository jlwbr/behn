import { glob } from "glob";
import { cwd } from "process";
import { Output, number, object, parse, string } from "valibot";

const ConfigSchema = object({
  basePath: string(),
  server: object({
    hostname: string(),
    port: number(),
  }),
});

export type Config = Output<typeof ConfigSchema>;

const defaultConfig: Config = {
  basePath: "src/app",
  server: {
    hostname: "localhost",
    port: 3000,
  },
};

export const readConfig = async () => {
  const configFiles = await glob(`${cwd()}/config.htmx.{js,ts}`);

  if (configFiles.length == 0) return defaultConfig;

  if (configFiles.length > 1)
    throw new Error("More than one config file found, bailing");

  const data = await import(configFiles[0]);

  if (!data.config) throw new Error("Missing config export, bailing");

  return parse(ConfigSchema, Object.assign({}, defaultConfig, data.config));
};

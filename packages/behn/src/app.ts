import { cwd } from "process";
import { Script, bundle } from "./bundle";
import { Config } from "./config";
import path from "path";
import {
  Layout,
  Metadata,
  getAllFiles,
  parseFile,
  renderRoute,
  resolveLayout,
} from "./router";
import Elysia from "elysia";
import html from "@elysiajs/html";

const isComponent = (component: any) => typeof component === "function";

export class App {
  private config: Config;
  private scripts: Script[] = [];
  private layouts: Map<string, Layout> = new Map();
  private routes: Map<
    { url: string; method: string },
    { component: () => any; metadata: Metadata }
  > = new Map();

  constructor({ config }: { config: Config }) {
    this.config = config;
  }

  async initialRender() {
    const { client } = await bundle();
    this.scripts = client;

    const basePath = path.join(cwd(), this.config.basePath);
    const files = getAllFiles(basePath);

    for await (const file of files.layouts) {
      const { url, exports } = await parseFile(basePath, file);

      if (!exports.default)
        throw new Error(`Layout at ${file} missing default export`);

      this.layouts.set(url, exports.default);
    }

    for await (const file of files.routes) {
      const { url, exports } = await parseFile(basePath, file);

      const metadata = (exports.metadata || {}) as Metadata;
      if (!metadata.scripts) metadata.scripts = [];
      metadata.scripts.push(...this.scripts);

      if (!metadata.layout) {
        metadata.layout = resolveLayout(url, this.layouts);
      }

      if (isComponent(exports.GET)) {
        this.routes.set(
          { url, method: "GET" },
          { component: exports.GET, metadata }
        );
      }
    }
  }

  async startServer() {
    const app = new Elysia().use(html());

    for (const [route, data] of this.routes) {
      if (route.method === "GET") {
        app.get(route.url, async ({ html, request }) => {
          const isHX = request.headers.get("HX-Request") === "true";
          const output = await renderRoute(data, isHX);

          return html(output);
        });
      }
    }

    for (const script of this.scripts) {
      app.get(script.src, () => new Response(script.data));
    }

    app.listen(3000);
  }
}

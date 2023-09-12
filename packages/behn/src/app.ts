import { cwd } from "process";
import { Script, bundle } from "./bundle";
import { Config } from "./config";
import path from "path";
import fs from "node:fs";
import {
  Layout,
  Metadata,
  getAllFiles,
  parseFile,
  renderRoute,
  resolveLayout,
} from "./router";
import { Elysia } from "elysia";
import { html } from "@elysiajs/html";

const isComponent = (component: any) => typeof component === "function";

enum Method {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
  PATCH = "PATCH",
}

export class App {
  public config: Config;
  private scripts: Script[] = [];
  private layouts: Map<string, Layout> = new Map();
  private routes: Map<
    { url: string; method: Method },
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

      if (!metadata.layouts) {
        metadata.layouts = resolveLayout(url, this.layouts);
      }

      for (const method of Object.values(Method)) {
        if (isComponent(exports[method])) {
          this.routes.set(
            { url, method },
            { component: exports.GET, metadata }
          );
        }
      }
    }
  }

  async startDevServer() {
    await this.startServer();

    fs.watch(
      path.join(cwd(), this.config.basePath),
      {
        recursive: true,
      },
      (event, filename) => {
        console.log(event, filename)
      }
    );
  }

  async startServer() {
    const app = new Elysia().use(html());

    for (const [route, data] of this.routes) {
      // TODO: Find a less repetitive way of doing this.
      switch (route.method) {
        case Method.GET:
          app.get(
            route.url,
            async ({ request }) => await renderRoute(data, request)
          );
        case Method.POST:
          app.post(
            route.url,
            async ({ request }) => await renderRoute(data, request)
          );
        case Method.PUT:
          app.put(
            route.url,
            async ({ request }) => await renderRoute(data, request)
          );
        case Method.DELETE:
          app.delete(
            route.url,
            async ({ request }) => await renderRoute(data, request)
          );
        case Method.PATCH:
          app.patch(
            route.url,
            async ({ request }) => await renderRoute(data, request)
          );
      }
    }

    for (const script of this.scripts) {
      app.get(script.src, () => new Response(script.data));
    }

    app.listen(this.config.server);
  }
}

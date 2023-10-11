import { Script, bundle } from "../bundle";
import chokidar from "chokidar";
import {
  Layout,
  Metadata,
  Page,
  clearCache,
  getAllFiles,
  parseFile,
  renderRoute,
  resolveLayout,
} from "./utils";
import { Server } from "bun";
import { cwd } from "process";
import { parse, join } from "path";

const isComponent = (component: any) => typeof component === "function";

enum Method {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
  PATCH = "PATCH",
}

export class Router {
  private scripts: Map<string, Script> = new Map();
  public layouts: Map<string, { file: string; layout: Layout }> = new Map();
  private routesByLayout: Map<string, string[]> = new Map();
  public modules: Map<string, { type: "layout" | "route"; file: string }> =
    new Map();
  private modulesByFile: Map<string, readonly string[]> = new Map();
  public routes: {
    [pathname: string]: {
      [method in Method]: { component: Page; metadata: Metadata };
    };
  } = {};
  private updateQueue: Set<string> = new Set();

  private basePath;
  private devMode = false;
  public server?: Server;

  constructor({
    basePath,
    server,
    devMode,
  }: {
    basePath: string;
    server?: Server;
    devMode?: boolean;
  }) {
    this.basePath = basePath;
    this.devMode = devMode || false;
    this.server = server;
  }

  updateModules(
    file: string,
    type: "layout" | "route",
    imports: readonly string[],
  ) {
    const currentModules = this.modulesByFile.get(file);

    if (currentModules) {
      for (const module of currentModules) {
        const parsed = parse(module);
        this.modules.delete(join(parsed.dir, parsed.name));
      }
    }

    for (const module of imports) {
      this.modules.set(module, { type, file });
    }

    this.modulesByFile.set(file, imports);
  }

  async addAll() {
    const { client } = await bundle({ devMode: this.devMode });
    this.scripts = client;

    const files = getAllFiles(this.basePath);

    for await (const file of files.layouts) {
      this.addLayout(file);
    }

    for await (const file of files.routes) {
      this.addRoute(file);
    }
  }

  async addLayout(file: string) {
    const { url, imports, exports } = await parseFile(this.basePath, file);

    console.log(`📼 Rendering layout: ${url}`);
    this.updateModules(file, "layout", imports);

    if (!exports.default)
      throw new Error(`Layout at ${file} missing default export`);

    this.layouts.set(url, { file, layout: exports.default });

    const routes = this.routesByLayout.get(file);
    if (!routes) return;

    for (const route of routes) {
      this.addRoute(route);
    }
  }

  async addRoute(file: string) {
    const { url, exports, imports } = await parseFile(this.basePath, file);

    console.log(`📼 Rendering route: ${url}`);

    this.updateModules(file, "route", imports);

    const metadata = (exports.metadata || {}) as Metadata;
    if (!metadata.scripts) metadata.scripts = new Map();
    metadata.scripts = new Map([...metadata.scripts, ...this.scripts]);

    const { urls, layouts } = resolveLayout(url, this.layouts);

    metadata.layouts = layouts;
    for (const url of urls) {
      const current = this.routesByLayout.get(url);

      this.routesByLayout.set(url, [...(current || []), file]);
    }

    if (!this.routes[url]) this.routes[url] = {} as (typeof this.routes)[0];

    for (const method of Object.values(Method)) {
      if (isComponent(exports[method])) {
        this.routes[url][method] = { component: exports[method], metadata };
      }
    }

    this.updateQueue.add(url);
  }

  notifyHMR() {
    if (!this.devMode) return;

    this.server?.publish(
      "reload",
      JSON.stringify([...this.updateQueue.values()]),
    );

    this.updateQueue.clear();
  }

  async watch() {
    await this.addAll();
    const files = getAllFiles(this.basePath);

    const rest = chokidar.watch(cwd(), {
      ignored: [...files.routes.pattern, ...files.layouts.pattern],
      ignoreInitial: true,
      usePolling: true,
    });

    const routes = chokidar.watch(files.routes.pattern, {
      ignoreInitial: true,
      usePolling: true,
    });

    const layouts = chokidar.watch(files.layouts.pattern, {
      ignoreInitial: true,
      usePolling: true,
    });

    rest.on("change", async (file, stats) => {
      if (!stats?.isFile()) return;

      const parsed = parse(file);
      const basefile = this.modules.get(join(parsed.dir, parsed.name));
      if (!basefile) return;

      clearCache(file);

      switch (basefile.type) {
        case "layout":
          await this.addLayout(basefile.file);
        case "route":
          await this.addRoute(basefile.file);
      }

      this.notifyHMR();
    });

    layouts.on("add", async (file, stats) => {
      if (!stats?.isFile()) return;

      await this.addLayout(file);
      this.notifyHMR();
    });
    layouts.on("change", async (file, stats) => {
      if (!stats?.isFile()) return;

      await this.addLayout(file);
      this.notifyHMR();
    });

    routes.on("add", async (file, stats) => {
      if (!stats?.isFile()) return;

      await this.addRoute(file);
      this.notifyHMR();
    });
    routes.on("change", async (file, stats) => {
      if (!stats?.isFile()) return;

      await this.addRoute(file);
      this.notifyHMR();
    });

    return {
      stop: () => {
        routes.unwatch(files.routes.pattern);
        layouts.unwatch(files.layouts.pattern);
        rest.unwatch(cwd());
      },
    };
  }

  async match(url: URL, request: Request) {
    if (url.pathname.startsWith("/.htmx")) return this.handleDotHtmx(url);

    if (!this.routes[url.pathname])
      return new Response("NOT_FOUND", { status: 404 });

    console.log(`🔎 Got new ${request.method} request: ${url.pathname}`);
    const route =
      this.routes[url.pathname][Method[request.method as keyof typeof Method]];

    if (!route) return new Response("NOT_FOUND", { status: 404 });

    return renderRoute(route, request);
  }

  async handleDotHtmx(url: URL) {
    if (url.pathname.startsWith("/.htmx/scripts")) {
      const script = this.scripts.get(url.pathname);
      if (!script) return new Response("NOT_FOUND", { status: 404 });

      return new Response(script.data.stream(), {
        headers: {
          "Content-Type": script.data.type,
        },
      });
    }

    return new Response("NOT_FOUND", { status: 404 });
  }
}

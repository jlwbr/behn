import { Script, bundle } from "../bundle";
import chokidar from "chokidar";
import {
  Layout,
  Metadata,
  Page,
  getAllFiles,
  parseFile,
  renderRoute,
  resolveLayout,
  urlToParts,
} from "./utils";
import { Server } from "bun";
import { cwd } from "process";
import { parse, join } from "path";
import debug from "../utils/debug";
import { Tree } from "../utils/tree";

const isComponent = (component: any) => typeof component === "function";

export enum Method {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
  PATCH = "PATCH",
}

export class Router {
  private scripts: Map<string, Script> = new Map();
  public layouts: Tree<{ path: string; file: string; layout: Layout }> =
    new Tree();
  private routesByLayout: Map<string, string[]> = new Map();
  public modules: Map<string, { type: "layout" | "route"; file: string }> =
    new Map();
  private modulesByFile: Map<string, string[]> = new Map();
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

  updateModules(file: string, type: "layout" | "route", imports: string[]) {
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

    for (const file of files.layouts) {
      await this.addLayout(file);
    }

    for (const file of files.routes) {
      await this.addRoute(file);
    }
  }

  async addLayout(file: string) {
    const { url, imports, exports } = await parseFile(this.basePath, file);

    console.log(`📼 Rendering layout: ${url}`);
    this.updateModules(file, "layout", imports);

    if (!exports.default)
      throw new Error(`Layout at ${file} missing default export`);

    const urlparts = urlToParts(url);
    const layout = {
      path: urlparts[urlparts.length - 1],
      file,
      layout: exports.default,
    };

    this.layouts.update_or_add_at_location(
      layout,
      urlparts,
      (value, pathspec) => value.path === pathspec,
      (target) => target.path === layout.path,
    );

    // console.dir(this.layouts, { depth: null });
    const routes = this.routesByLayout.get(file);
    if (!routes) return;

    for (const route of routes) {
      this.addRoute(route);
    }
  }

  async addRoute(file: string) {
    const { url, exports, imports, lastModified } = await parseFile(
      this.basePath,
      file,
    );

    console.log(`📼 Rendering route: ${url}`);

    this.updateModules(file, "route", imports);

    const metadata = (exports.metadata || {}) as Metadata;
    if (!metadata.scripts) metadata.scripts = new Map();
    metadata.scripts = new Map([...metadata.scripts, ...this.scripts]);
    metadata.lastModified = this.devMode ? new Date() : lastModified;

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
      } else if (isComponent(exports[method.toLowerCase()])) {
        this.routes[url][method] = {
          component: exports[method.toLowerCase()],
          metadata,
        };
      }
    }

    this.updateQueue.add(url);
  }

  notifyHMR() {
    if (!this.devMode) return;

    debug("Got hot reload request for urls: %o", this.updateQueue.values());
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

      debug("Module file changed", file);
      const parsed = parse(file);
      const basefile = this.modules.get(join(parsed.dir, parsed.name));
      if (!basefile) return;
      debug("Found base file %s for module %s", basefile.file, file);

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

      debug("New layout file added: %s", file);
      await this.addLayout(file);
      this.notifyHMR();
    });
    layouts.on("change", async (file, stats) => {
      if (!stats?.isFile()) return;

      debug("Layout file changed", file);
      await this.addLayout(file);
      this.notifyHMR();
    });

    routes.on("add", async (file, stats) => {
      if (!stats?.isFile()) return;

      debug("New routed file added: %s", file);
      await this.addRoute(file);
      this.notifyHMR();
    });
    routes.on("change", async (file, stats) => {
      if (!stats?.isFile()) return;

      debug("Route file changed", file);
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

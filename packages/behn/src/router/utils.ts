import { Glob } from "glob";
import path from "path";
import Html from "@kitajs/html";
import { traceImports } from "../utils/traceImports";
import debug from "../utils/debug";
import { Tree } from "../utils/tree";
import "@kitajs/html/register";
import { BuildArtifact } from "bun";
import { compileCss } from "../utils/postcss";

export const getAllFiles = (basePath: string) => {
  const layouts = new Glob(`${basePath}/**/layout.{tsx,jsx,js,ts}`, {});
  const routes = new Glob(`${basePath}/**/route.{tsx,jsx,js,ts}`, {});

  return { layouts, routes };
};

export const clearCache = (file: string) => {
  // @ts-ignore
  delete require.cache[require.resolve(file)];
};

async function sha256(message) {
    // encode as UTF-8
    const msgBuffer = new TextEncoder().encode(message);

    // hash the message
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    
    // convert ArrayBuffer to Array
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    // convert bytes to hex string
    const hashHex = hashArray.map(b => ('00' + b.toString(16)).slice(-2)).join('');
    return hashHex;
}


export const parseFile = async (basepath: string, file: string) => {
  clearCache(file);
  const exports = require(file);
  const parsedPath = path.parse(file);
  const url = parsedPath.dir.replace(basepath, "");
  const imports = await traceImports(file, 10);
  imports.forEach((file) => clearCache(file));

  const buildAssets: BuildArtifact[] = [];

  for (const asset of imports) {
    const parsed = path.parse(asset);

    switch (parsed.ext) {
      case ".css":
        const output = await compileCss({ path: asset });

        const blob = new Blob([output], { type: "text/css" }) as BuildArtifact;

        blob.kind = "asset";
        blob.hash = await sha256(output);
        blob.path = `${parsed.name}${parsed.ext}`;
        blob.loader = "text";
        blob.sourcemap = null;

        buildAssets.push(blob);
    }
  }

  debug("Parsed file %s, url: %s", file, url);

  return {
    url: url.length === 0 ? "/" : url,
    exports,
    imports,
    assets: buildAssets,
    lastModified: new Date(Bun.file(file).lastModified),
  };
};

type MabyAsync<T> = T | Promise<T>;

export type Layout = ({
  children,
}: {
  children: Html.Children;
}) => MabyAsync<string>;
export type Page = ({
  request,
  headers,
}: {
  request: Request;
  headers: Headers;
}) => MabyAsync<string | Response>;

export type Metadata = {
  assets: Map<string, BuildArtifact>;
  title?: string;
  layouts?: Layout[];
  lastModified: Date;
};

const rewriteHtml = (document: Response, { assets, title }: Metadata) => {
  const rewriter = new HTMLRewriter();
  const htmlString = [...assets.entries()]
    .map(([src, asset]) => {
      switch (asset.kind) {
        case "entry-point":
        case "chunk":
          return `<script type="module" src=".behn/assets/${src}"></script>`;
        case "asset":
          return `<link rel="stylesheet" href=".behn/assets/${src}">`;
        case "sourcemap":
      }
    })
    .join("");

  if (title)
    rewriter.on("title", {
      element(element) {
        element.setInnerContent(title);
      },
    });

  rewriter.on("head", {
    element(element) {
      element.append(htmlString, { html: true });
    },
  });

  return rewriter.transform(document);
};

export const urlToParts = (url: string) => [
  "/",
  ...url.split("/").filter((url) => url),
];

export const resolveLayout = (
  url: string,
  layouts: Tree<{ path: string; file?: string; layout?: Layout }>,
) => {
  const urlParts = urlToParts(url);
  urlParts.shift();

  let node = layouts.root;
  for (const part of urlParts) {
    const newNode = node?.children.find((node) => node.value.path === part);

    if (!newNode) break;

    node = newNode;
  }

  const matches: { path: string; file?: string; layout?: Layout }[] = [];

  while (node) {
    const { file, layout } = node.value;

    if (!layout || !file) break;

    matches.push(node.value);

    node = node.parent;
  }

  return matches;
};

const initResponse = ({
  finalLayout,
  headers,
}: {
  finalLayout: string | Response;
  headers: Headers;
}) => {
  if (typeof finalLayout === "string") {
    headers.set("Content-Type", "text/html");
    return new Response(finalLayout, {
      headers,
    });
  } else {
    headers.forEach((val, key) => {
      if (!finalLayout.headers.get(key)) {
        finalLayout.headers.set(key, val);
      }
    });

    return finalLayout;
  }
};

export const renderRoute = async (
  { component, metadata }: { component: Page; metadata: Metadata },
  request: Request,
) => {
  const headers = new Headers({
    "Last-Modified": metadata.lastModified.toUTCString(),
    Vary: "HX-Request",
  });
  const layouts = metadata.layouts;
  let finalLayout = await component({ request, headers });

  const skipLayout =
    request.headers.get("HX-Request") === "true" ||
    typeof finalLayout !== "string";

  if (skipLayout) {
    const response = initResponse({ finalLayout, headers });
    return rewriteHtml(response, metadata);
  }

  if (!layouts || layouts.length === 0) throw Error(`Missing layout`);

  for (const layout of layouts.reverse()) {
    finalLayout = await layout({ children: finalLayout as string });
  }

  const response = initResponse({ finalLayout, headers });
  return rewriteHtml(response, metadata);
};

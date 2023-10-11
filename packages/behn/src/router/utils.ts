import { Glob } from "glob";
import { Script } from "./../bundle";
import path from "path";
import Html from "@kitajs/html";
import { traceImports } from "../utils/traceImports";

export const getAllFiles = (basePath: string) => {
  const layouts = new Glob(`${basePath}/**/layout.{tsx,jsx,js,ts}`, {});
  const routes = new Glob(`${basePath}/**/route.{tsx,jsx,js,ts}`, {});

  return { layouts, routes };
};

export const clearCache = (file: string) => {
  // @ts-ignore
  delete require.cache[require.resolve(file)];
};

export const parseFile = async (basepath: string, file: string) => {
  clearCache(file);
  const exports = require(file);
  const parsedPath = path.parse(file);
  const url = parsedPath.dir.replace(basepath, "");
  const imports = traceImports(file);

  return { url: url.length === 0 ? "/" : url, exports, imports };
};

type MabyAsync<T> = T | Promise<T>;

export type Layout = ({
  children,
}: {
  children: Html.Children;
}) => MabyAsync<string>;
export type Page = ({
  request,
}: {
  request: Request;
}) => MabyAsync<string | Response>;

export type Metadata = {
  scripts: Map<string, Script>;
  title?: string;
  layouts?: Layout[];
};

const rewriteHtml = (
  document: string | Response,
  { scripts, title }: Metadata,
) => {
  const rewriter = new HTMLRewriter();
  const htmlString = [...scripts.entries()]
    .map(([src, script]) => {
      switch (script.data.kind) {
        case "entry-point":
          return `<script type="module" src="${src}"></script>`;
        case "chunk":
          return `<script type="module" src="${src}"></script>`;
        case "asset":
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

  return rewriter.transform(
    typeof document === "string"
      ? new Response(document, {
          headers: {
            "Content-Type": "text/html",
          },
        })
      : document,
  );
};

const urlToParts = (url: string) => [
  "/",
  ...url.split("/").filter((url) => url),
];

export const resolveLayout = (
  url: string,
  layouts: Map<string, { file: string; layout: Layout }>,
) => {
  const urlParts = urlToParts(url);
  const matches: Layout[] = [];
  const urls: string[] = [];

  const countMatching = (lhs: string[], rhs: string[]) => {
    let matching = 0;

    if (rhs.length > lhs.length) return matching;
    for (const [i, url] of lhs.entries()) {
      if (i > rhs.length - 1) break;

      if (url === rhs[i]) matching++;
      else break;
    }

    return matching;
  };

  for (const [url, layout] of layouts) {
    const matching = countMatching(urlParts, urlToParts(url));
    if (matching > 0) {
      urls[matching] = layout.file;
      matches[matching] = layout.layout;
    }
  }

  return { layouts: matches.filter(Boolean), urls: urls.filter(Boolean) };
};

export const renderRoute = async (
  { component, metadata }: { component: Page; metadata: Metadata },
  request: Request,
) => {
  const layouts = metadata.layouts;
  let finalLayout = await component({ request });
  const skipLayout =
    request.headers.get("HX-Request") === "true" ||
    typeof finalLayout !== "string";
  if (skipLayout) return rewriteHtml(finalLayout, metadata);

  if (!layouts || layouts.length === 0) throw Error(`Missing layout`);

  for (const layout of layouts.reverse()) {
    finalLayout = await layout({ children: finalLayout as string });
  }

  return rewriteHtml(finalLayout, metadata);
};

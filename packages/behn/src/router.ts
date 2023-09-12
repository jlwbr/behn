import { Glob } from "glob";
import { Script } from "./bundle";
import path from "path";

export const getAllFiles = (basePath: string) => {
  const layouts = new Glob(`${basePath}/**/layout.{tsx,jsx,js,ts}`, {});
  const routes = new Glob(`${basePath}/**/route.{tsx,jsx,js,ts}`, {});

  return { layouts, routes };
};

export const parseFile = async (basepath: string, file: string) => {
  const exports = await import(file);
  const parsedPath = path.parse(file);
  const url = parsedPath.dir.replace(basepath, "");

  return { url, exports };
};

export type Layout = ({ children }: { children: any }) => any;
export type Page = ({ request }: { request: Request }) => any;

export type Metadata = {
  scripts: Script[];
  title?: string;
  layouts?: Layout[];
};

const rewriteHtml = (document: string, { scripts, title }: Metadata) => {
  const rewriter = new HTMLRewriter();
  const htmlString = scripts
    .map(({ src }) => `<script src=${src}></script>`)
    .join();

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

  return rewriter.transform(new Response(document));
};

const urlToParts = (url: string) => [
  "/",
  ...url.split("/").filter((url) => url),
];

export const resolveLayout = (url: string, layouts: Map<string, Layout>) => {
  const urlParts = urlToParts(url);
  const matches: Layout[] = [];

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
    if (matching > 0) matches[matching] = layout;
  }

  return matches.filter(Boolean);
};

export const renderRoute = async (
  { component, metadata }: { component: Page; metadata: Metadata },
  request: Request
) => {
  const layouts = metadata.layouts;
  const hxRequest = request.headers.get("HX-Request") === "true";
  if (hxRequest) return rewriteHtml(component({ request }), metadata).text();

  if (!layouts) throw Error(`Missing layout`);

  let finalLayout = component({ request });
  for (const layout of layouts.reverse()) {
    finalLayout = layout({ children: finalLayout });
  }

  return await rewriteHtml(finalLayout, metadata).text();
};

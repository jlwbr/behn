import { Glob } from "glob";
import { Script } from "./bundle";
import path from "path";
import { renderSSR } from "nano-jsx";

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

export type Metadata = {
  scripts: Script[];
  title?: string;
  layout?: Layout;
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

export const resolveLayout = (url: string, layouts: Map<string, Layout>) => {
  const urlParts = url.split("/");
  const closestMatch: { matching: number; layout: Layout } = {
    matching: 0,
    layout: ({ children }) => children,
  };

  const countMatching = (lhs: string[], rhs: string[]) => {
    let matching = 0;

    for (const [i, url] of lhs.entries()) {
      if (i > rhs.length - 1) break;

      if (url === rhs[i]) matching++;
      else break;
    }

    return matching;
  };

  for (const [url, layout] of layouts) {
    const matching = countMatching(urlParts, url.split("/"));
    if (closestMatch.matching === matching)
      throw Error("Only one layout is allowed per route");
    if (closestMatch.matching < matching) {
      closestMatch.matching = matching;
      closestMatch.layout = layout;
    }
  }

  return closestMatch.layout;
};

export const renderRoute = async ({ component, metadata }: { component: () => any, metadata: Metadata }, HXRequest: boolean = false) => {
  const layout = metadata.layout;

  if (!layout) throw Error(`Missing layout`);

  const ssr = renderSSR(() => HXRequest ? component : layout({ children: component }));
  return await rewriteHtml(ssr, metadata).text();
};

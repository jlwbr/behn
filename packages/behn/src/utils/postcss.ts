import Bun from "bun";
import postcss from "postcss";
import postcssrc from "postcss-load-config";

export const compileCss = async (args: { path: string }) => {
  const css = await Bun.file(args.path).text();
  const config = await postcssrc().catch(() => ({
    plugins: [],
    options: {},
  }));

  const result = await postcss(config.plugins).process(css, {
    ...config.options,
    from: args.path,
  });

  return result.css;
};


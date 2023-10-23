import { parse, join } from "path";
import { clearCache } from "../router/utils";
import { findStaticImports, resolvePath } from "mlly";

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

async function getImportsForFile(file: string) {
  const code = await Bun.file(file).text();
  const imports = findStaticImports(code);

  return (
    await Promise.all(
      imports.map(async (data) => {
        const resolved = await resolvePath(data.specifier, {
          url: file,
          extensions: [".mjs", ".cjs", ".js", ".json", ".ts", ".tsx"],
        });

        return resolved;
      }),
    )
  ).filter((path) => !path.includes("node") && !path.includes("node_modules"));
}

async function traceImportsRecursive(
  file: string,
  depth: number,
): Promise<string[]> {
  const imports = await getImportsForFile(file);
  if (depth === 0) return imports;
  const recursive = await Promise.all(
    imports.map(async (i) => traceImportsRecursive(i, depth - 1)),
  );

  return [...imports, ...recursive.flat()];
}

export async function traceImports(file: string, limit: number) {
  const imports = await traceImportsRecursive(file, limit);

  // NOTE: We should probably move this to a more sensible place
  imports.forEach((file) => clearCache(file));

  return imports.map((file) => {
    const parsed = parse(file);
    return join(parsed.dir, parsed.name);
  });
}

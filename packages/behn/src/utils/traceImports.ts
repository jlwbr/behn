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
          extensions: [".mjs", ".cjs", ".js", ".json", ".ts", ".tsx", ".css"],
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
    imports.map(async (file) => traceImportsRecursive(file, depth - 1)),
  );

  return [...imports, ...recursive.flat()];
}

export const traceImports = (file: string, limit: number) =>
  traceImportsRecursive(file, limit);

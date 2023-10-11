import { builtinModules } from "module";
import { parse, resolve, join } from "path";

import ts from "typescript";

export function traceImports(fileName: string): readonly string[] {
  const tsHost = ts.createCompilerHost(
    {
      allowJs: true,
      noEmit: true,
      isolatedModules: true,
      resolveJsonModule: false,
      incremental: true,
      noLib: true,
      noResolve: true,
    },
    true,
  );

  const sourceFile = tsHost.getSourceFile(
    fileName,
    ts.ScriptTarget.Latest,
    (msg) => {
      throw new Error(`Failed to parse ${fileName}: ${msg}`);
    },
  );
  if (!sourceFile) throw ReferenceError(`Failed to find file ${fileName}`);
  const importing: string[] = [];
  delintNode(sourceFile);
  return importing.map((relative) => {
    const parsed = parse(relative);
    return resolve(parse(fileName).dir, join(parsed.dir, parsed.name));
  });

  function delintNode(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const moduleName = node.moduleSpecifier.getText().replace(/['"]/g, "");
      if (
        !moduleName.startsWith("node:") &&
        !builtinModules.includes(moduleName)
      )
        importing.push(moduleName);
    } else ts.forEachChild(node, delintNode);
  }
}

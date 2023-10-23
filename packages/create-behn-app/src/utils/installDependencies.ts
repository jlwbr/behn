// Based on: https://github.com/t3-oss/create-t3-app/blob/e95e3adff11b91fee1de0021cbb858be604b80d4/cli/src/helpers/installDependencies.ts
import chalk from "chalk";
import { execa, type StdioOption } from "execa";
import ora, { type Ora } from "ora";

const execWithSpinner = async (
  projectDir: string,
  pkgManager: string,
  options: {
    args?: string[];
    stdout?: StdioOption;
    onDataHandle?: (spinner: Ora) => (data: Buffer) => void;
  },
) => {
  const { onDataHandle, args = ["install"], stdout = "pipe" } = options;

  const spinner = ora(`Running ${pkgManager} install...`).start();
  const subprocess = execa(pkgManager, args, { cwd: projectDir, stdout });

  await new Promise<void>((res, rej) => {
    if (onDataHandle) {
      subprocess.stdout?.on("data", onDataHandle(spinner));
    }

    void subprocess.on("error", (e) => rej(e));
    void subprocess.on("close", () => res());
  });

  return spinner;
};

export const installDependencies = async ({
  projectDir,
}: {
  projectDir: string;
}) => {
  const installSpinner = await execWithSpinner(projectDir, "bun", {
    stdout: "ignore",
  });

  // If the spinner was used to show the progress, use succeed method on it
  // If not, use the succeed on a new spinner
  (installSpinner ?? ora()).succeed(
    chalk.green("Successfully installed dependencies!\n"),
  );
};

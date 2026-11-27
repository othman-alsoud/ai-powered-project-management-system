import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import * as esbuild from "esbuild";

const REPO_ROOT = process.cwd();
const HARNESS_DIR = path.join(REPO_ROOT, "tests", "a11y", "workspace-harness");
const MOCKS_FILE = path.join(HARNESS_DIR, "mocks.tsx");

function collectCompiledCss(): string {
  const chunksDir = path.join(REPO_ROOT, ".next", "static", "chunks");
  if (!fs.existsSync(chunksDir)) {
    throw new Error(
      "Missing .next/static/chunks CSS assets. Run `npm run build` before starting the workspace UI harness.",
    );
  }
  const cssFiles = fs
    .readdirSync(chunksDir)
    .filter((file) => file.endsWith(".css"))
    .sort();
  return cssFiles
    .map((file) => fs.readFileSync(path.join(chunksDir, file), "utf8"))
    .join("\n");
}

function createHarnessAliasPlugin(): esbuild.Plugin {
  return {
    name: "workspace-a11y-harness-mocks",
    setup(build) {
      build.onResolve({ filter: /^next\/link$/ }, () => ({
        path: path.join(HARNESS_DIR, "mock-link.tsx"),
      }));

      build.onResolve({ filter: /^next\/navigation$/ }, () => ({
        path: MOCKS_FILE,
      }));

      build.onResolve({ filter: /^@\/lib\/auth-client$/ }, () => ({
        path: MOCKS_FILE,
      }));

      build.onResolve({ filter: /^\.\.?\/.*actions$/ }, () => ({
        path: MOCKS_FILE,
      }));

      build.onResolve({ filter: /^@\/features\/[^/]+\/actions$/ }, () => ({
        path: MOCKS_FILE,
      }));

      build.onResolve({ filter: /^@\/generated\/prisma\/client$/ }, () => ({
        path: MOCKS_FILE,
      }));
    },
  };
}

export interface HarnessServerHandle {
  url: string;
  close: () => Promise<void>;
}

export async function startWorkspaceHarnessServer(): Promise<HarnessServerHandle> {
  const cssBundle = collectCompiledCss();

  const buildResult = await esbuild.build({
    entryPoints: [path.join(HARNESS_DIR, "app.tsx")],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    jsx: "automatic",
    tsconfig: path.join(REPO_ROOT, "tsconfig.json"),
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    alias: {
      "next/link": path.join(HARNESS_DIR, "mock-link.tsx"),
      "next/navigation": MOCKS_FILE,
      "@/lib/auth-client": MOCKS_FILE,
      "@/features/teams/actions": MOCKS_FILE,
      "@/features/projects/actions": MOCKS_FILE,
      "@/features/tasks/actions": MOCKS_FILE,
      "@/features/comments/actions": MOCKS_FILE,
      "@/features/activity/actions": MOCKS_FILE,
      "@/features/notifications/actions": MOCKS_FILE,
      "@/features/auth/actions": MOCKS_FILE,
      "@/generated/prisma/client": MOCKS_FILE,
    },
    plugins: [createHarnessAliasPlugin()],
  });

  const jsBundle = buildResult.outputFiles[0]?.text ?? "";
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Polaris Workspace Accessibility Harness</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body class="antialiased">
    <div id="root"></div>
    <script src="/harness.js"></script>
  </body>
</html>`;

  const server = http.createServer((req, res) => {
    const pathname = (req.url ?? "/").split("?")[0];
    if (pathname === "/harness.js") {
      res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
      res.end(jsBundle);
      return;
    }
    if (pathname === "/styles.css") {
      res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
      res.end(cssBundle);
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 3006;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

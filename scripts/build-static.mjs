import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { force: true, recursive: true });
await mkdir("dist", { recursive: true });

await Promise.all([
  cp("index.html", "dist/index.html"),
  cp("src", "dist/src", { recursive: true })
]);

import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/ai/markdown.js"],
  bundle: true,
  format: "iife",
  globalName: "MuntrumeMarkdown",
  platform: "browser",
  minify: true,
  legalComments: "none",
  outfile: "public/assets/js/ai-md.js",
});

console.log("[ai-md] bundled public/assets/js/ai-md.js");

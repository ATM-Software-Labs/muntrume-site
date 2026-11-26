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

await esbuild.build({
  entryPoints: ["src/ai/client.js"],
  bundle: true,
  format: "iife",
  platform: "browser",
  minify: true,
  legalComments: "none",
  outfile: "public/assets/js/ai-chat.js",
});

console.log("[ai-md] bundled public/assets/js/ai-md.js and ai-chat.js");

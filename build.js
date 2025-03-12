import { obfuscate } from "./obfuscate.js";
import { globalExternals } from "@fal-works/esbuild-plugin-global-externals";
import cors from "cors";
import { expand } from "dotenv-expand";
import { config } from "dotenv-flow";
import { build, context } from "esbuild";
import express from "express";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { userscriptMetadataGenerator } from "userscript-metadata-generator";

const isDevelopment = process.argv.includes("--dev");

process.env.NODE_ENV = isDevelopment ? "development" : "production";

expand(config());

/**
 * @type {import("./meta.json")}
 */
const sketchMeta = JSON.parse(
  await readFile(new URL("meta.json", import.meta.url), "utf-8")
);

/**
 * @type {import("./meta.dev.json")}
 */
const sketchDevMeta = JSON.parse(
  await readFile(new URL("meta.dev.json", import.meta.url), "utf-8")
);

/**
 * @type {import("./package.json")}
 */
const pkg = JSON.parse(
  await readFile(new URL("package.json", import.meta.url), "utf-8")
);

process.env.SKETCH_VERSION = pkg.version;

const envKeys = [
  "NODE_ENV",
  ...Object.keys(process.env).filter((key) => key.startsWith("SKETCH_")),
];

const envReplacements = {
  ...envKeys.reduce((r, key) => {
    if (key in process.env)
      r[`process.env.${key}`] = JSON.stringify(process.env[key]);
    return r;
  }, {}),
};

console.log(envReplacements);

const sketchNodeLoader = `typeof require==="function"&&${JSON.stringify(
  sketchMeta.require
)}.map(u=>{const h=new XMLHttpRequest;h.open("GET",u,!1);h.send();new Function("e","eval(e)")(h.responseText+\`\n//# sourceURL=\${u}\`)});`;

const mainOut = fileURLToPath(new URL("dist/sketch.user.js", import.meta.url));

const sketchMain = await context({
  entryPoints: ["./src/index.tsx"],
  format: "iife",
  sourcemap: "external",
  define: envReplacements,
  outfile: mainOut,
  external: ["os", "fs", "path", "http", "https"],
  bundle: true,
  minify: !isDevelopment,
  jsx: "transform",
  supported: {
    "nullish-coalescing": false,
    "optional-catch-binding": false,
    "optional-chain": false,
  },
  plugins: [
    ...(isDevelopment ? [] : [obfuscate()]),
    globalExternals({
      react: {
        type: "esm",
        namedExports: ["useEffect", "useState", "useRef", "Fragment"],
        defaultExport: true,
        varName: "React",
      },
      "react-dom": "ReactDOM",
      "react-dom/client": {
        varName: "ReactDOM",
        namedExports: ["createRoot"],
      },
    }),
  ],
  platform: "browser",
  banner: {
    js:
      userscriptMetadataGenerator({
        ...sketchMeta,
        version: pkg.version,
        connect: [new URL(process.env.SKETCH_API_URL).hostname],
      }) +
      "\n/*eslint-disable*/" +
      sketchNodeLoader,
  },
});

console.log("produced", mainOut);

if (process.argv.includes("--watch")) {
  const devOut = fileURLToPath(
    new URL("dist/sketch.DEV.user.js", import.meta.url)
  );
  await build({
    entryPoints: ["./src/dev.ts"],
    format: "iife",
    define: envReplacements,
    outfile: devOut,
    platform: "browser",
    banner: {
      js:
        userscriptMetadataGenerator({
          author: pkg.author,
          description: pkg.description,
          version: pkg.version,
          ...sketchMeta,
          ...sketchDevMeta,
          connect: [new URL(process.env.SKETCH_API_URL).hostname],
        }) + "\n",
    },
  });

  console.log("produced", devOut);

  const app = express();
  app.use(cors());
  app.use(express.static("dist"));
  app.listen(8080, () => {
    console.log("dev server started on http://127.0.0.1:8080/");
  });

  await sketchMain.watch();
} else {
  await sketchMain.rebuild();
  await sketchMain.dispose();
}

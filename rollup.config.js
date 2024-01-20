import eslint from "@rollup/plugin-eslint";
import nodeResolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import { expand } from "dotenv-expand";
import { config } from "dotenv-flow";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig } from "rollup";
import banner from "rollup-plugin-banner2";
import esbuild from "rollup-plugin-esbuild";
import obfuscator from "rollup-plugin-obfuscator";
import serve from "rollup-plugin-serve";
import metablock from "rollup-plugin-userscript-metablock";

expand(config());

const isDevelopment = process.env.NODE_ENV !== "production";

// if a http server should start and a dev user.js should build
const buildForDev = process.env.BUILD_DEV || isDevelopment;

const sketchMetaFile = fileURLToPath(new URL("meta.json", import.meta.url));
/**
 * @type {import("./meta.json")}
 */
const sketchMeta = JSON.parse(await readFile(sketchMetaFile, "utf-8"));

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

const sketchNodeLoader = `typeof require==="function"&&${JSON.stringify(
  sketchMeta.require
)}.map(u=>{const h=new XMLHttpRequest;h.open("GET",u,!1);h.send();new Function("e","eval(e)")(h.responseText+\`\n//# sourceURL=\${u}\`)});`;

const transformerFactory = (name) => (relativeSourcePath) =>
  new URL(relativeSourcePath, `sketch-${name}://`).toString();

/**
 * @type {import("rollup").RollupOptions}
 */
const options = defineConfig([
  // SKETCH FULL
  {
    input: "./src/index.tsx",
    output: {
      file: fileURLToPath(new URL("dist/sketch.user.js", import.meta.url)),
      format: "iife",
      sourcemap: "hidden",
      sourcemapPathTransform: transformerFactory("main"),
      globals: {
        react: "React",
        "react-dom": "ReactDOM",
        "react-dom/client": "ReactDOM",
      },
    },
    external: ["react", "react-dom", "react-dom/client"],
    plugins: [
      eslint(),
      esbuild({
        minify: !isDevelopment,
        jsx: "transform",
        define: envReplacements,
        supported: {
          "nullish-coalescing": false,
          "optional-catch-binding": false,
          "optional-chain": false,
        },
      }),
      nodeResolve(),
      replace({
        "process.env.": "({}).",
        preventAssignment: true,
      }),
      !isDevelopment &&
        obfuscator({
          include:
            /Menu\.tsx|createUI\.tsx|Outdated\.tsx|NotUpdated\.tsx|index\.tsx|KrunkBox\.ts/,
          options: {
            target: "browser",
            deadCodeInjection: true,
            selfDefending: false,
            splitStrings: true,
            stringArrayEncoding: ["rc4"],
            stringArrayThreshold: 1,
            transformObjectKeys: true,
            renameProperties: false,
            renameGlobals: false,
            numbersToExpressions: false,
            controlFlowFlattening: true,
            stringArray: true,
            stringArrayCallsTransformThreshold: 1,
            simplify: true,
          },
        }),
      banner(() => sketchNodeLoader),
      metablock({
        file: fileURLToPath(new URL("meta.json", import.meta.url)),
        override: {
          author: pkg.author,
          description: pkg.description,
          version: pkg.version,
        },
        manager: "tampermonkey",
      }),
    ],
  },
  // SKETCH FULL DEV
  ...(buildForDev
    ? [
        {
          input: "./src/dev.ts",
          output: {
            file: fileURLToPath(
              new URL("dist/sketch.DEV.user.js", import.meta.url)
            ),
            format: "iife",
            sourcemapPathTransform: transformerFactory("main-loader"),
          },
          plugins: [
            eslint(),
            esbuild({ define: envReplacements }),
            replace({
              "process.env.": "({}).",
              preventAssignment: true,
            }),
            metablock({
              file: sketchMetaFile,
              override: {
                name: "Sketch DEV",
                author: pkg.author,
                description: pkg.description,
                version: pkg.version,
                require: [
                  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.development.min.js",
                  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.development.min.js",
                ],
              },
              manager: "tampermonkey",
            }),
            serve({
              contentBase: fileURLToPath(new URL("dist", import.meta.url)),
              port: process.env.SKETCH_DEV_PORT,
              host: process.env.SKETCH_DEV_HOST,
              headers: {
                "access-control-allow-headers": "cache-control",
                "access-control-allow-origin": "*",
              },
            }),
          ],
        },
      ]
    : []),
]);

export default options;

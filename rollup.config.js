import { generateIdentifier } from "./schizophrenia.js";
import commonjs from "@rollup/plugin-commonjs";
import eslint from "@rollup/plugin-eslint";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import { expand } from "dotenv-expand";
import { config } from "dotenv-flow";
import times from "lodash/times.js";
import uniq from "lodash/uniq.js";
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

const funnyIDs = uniq(times(8 ** 6, () => generateIdentifier()));

const obfuscation = () =>
  !isDevelopment &&
  obfuscator({
    global: true,
    options: {
      target: "browser",
      deadCodeInjection: false,
      selfDefending: false,
      splitStrings: false,
      transformObjectKeys: false,
      renameProperties: false,
      renameGlobals: false,
      numbersToExpressions: false,
      controlFlowFlattening: false,
      stringArray: false,
      simplify: false,
      identifierNamesGenerator: "dictionary",
      identifiersDictionary: funnyIDs,
    },
  });

const transformerFactory = (name) => (relativeSourcePath) =>
  new URL(relativeSourcePath, `sketch-${name}://`).toString();

/**
 * @type {import("rollup").RollupOptions}
 */
const options = defineConfig([
  {
    input: "./src/tracker/index.tsx",
    output: {
      file: fileURLToPath(new URL("dist/tracker.user.js", import.meta.url)),
      format: "cjs",
      sourcemap: "hidden",
      sourcemapPathTransform: transformerFactory("tracker"),
    },
    plugins: [
      eslint(),
      esbuild({
        minify: !isDevelopment,
        jsx: "transform",
        define: envReplacements,
      }),
      replace({
        "process.env.": "({}).",
        preventAssignment: true,
      }),
      nodeResolve({ browser: true }),
      commonjs(),
      obfuscation(),
      banner(() => "/*eslint-disable*/"),
      metablock({
        file: fileURLToPath(new URL("tracker.json", import.meta.url)),
        override: {
          author: pkg.author,
          description: pkg.description,
          version: pkg.version,
        },
        manager: "tampermonkey",
      }),
    ],
  },
  ...(isDevelopment
    ? [
        {
          input: "./src/tracker/dev.ts",
          output: {
            file: fileURLToPath(
              new URL("dist/tracker.DEV.user.js", import.meta.url)
            ),
            format: "cjs",
            sourcemap: "inline",
            sourcemapPathTransform: transformerFactory("tracker-loader"),
          },
          plugins: [
            eslint(),
            esbuild({ minify: true, define: envReplacements }),
            replace({
              "process.env.": "({}).",
              preventAssignment: true,
            }),
            nodeResolve(),
            banner(() => "/*eslint-disable*/"),
            metablock({
              file: fileURLToPath(new URL("tracker.json", import.meta.url)),
              override: {
                name: "Krunker Inputs DEV",
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
          ],
        },
      ]
    : []),
  {
    input: "./src/index.tsx",
    output: {
      file: fileURLToPath(new URL("dist/sketch.user.js", import.meta.url)),
      format: "cjs",
      sourcemap: "hidden",
      sourcemapPathTransform: transformerFactory("main"),
    },
    plugins: [
      eslint(),
      esbuild({
        minify: !isDevelopment,
        jsx: "transform",
        define: envReplacements,
      }),
      replace({
        "process.env.": "({}).",
        preventAssignment: true,
      }),
      nodeResolve({ browser: true }),
      commonjs(),
      json(),
      obfuscation(),
      banner(() => "/*eslint-disable*/"),
      metablock({
        file: fileURLToPath(new URL("meta.json", import.meta.url)),
        override: {
          author: pkg.author,
          description: pkg.description,
          version: pkg.version,
          connect: new URL(process.env.SKETCH_API_URL).hostname,
        },
        manager: "tampermonkey",
      }),
    ],
  },
  ...(isDevelopment
    ? [
        {
          input: "./src/dev.ts",
          output: {
            file: fileURLToPath(
              new URL("dist/sketch.DEV.user.js", import.meta.url)
            ),
            format: "cjs",
            sourcemap: "inline",
            sourcemapPathTransform: transformerFactory("main-loader"),
          },
          plugins: [
            eslint(),
            esbuild({ minify: true, define: envReplacements }),
            replace({
              "process.env.": "({}).",
              preventAssignment: true,
            }),
            nodeResolve(),
            banner(() => "/*eslint-disable*/"),
            metablock({
              file: fileURLToPath(new URL("meta.json", import.meta.url)),
              override: {
                name: "Sketch DEV",
                author: pkg.author,
                description: pkg.description,
                version: pkg.version,
                connect: new URL(process.env.SKETCH_API_URL).hostname,
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

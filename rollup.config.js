import commonjs from "@rollup/plugin-commonjs";
import eslint from "@rollup/plugin-eslint";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
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

/**
 * @type {import("rollup").RollupOptions}
 */
const options = defineConfig([
  {
    input: "./src/index.tsx",
    output: {
      file: fileURLToPath(new URL("dist/sketch.user.js", import.meta.url)),
      format: "cjs",
      sourcemap: "hidden",
    },
    plugins: [
      eslint(),
      esbuild({
        minify: !isDevelopment,
        jsx: "transform",
        define: envReplacements,
      }),
      nodeResolve({ browser: true }),
      commonjs(),
      json(),
      !isDevelopment &&
        obfuscator({
          exclude: /node_modules/,
        }),
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
          },
          plugins: [
            eslint(),
            esbuild({ minify: true, define: envReplacements }),
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

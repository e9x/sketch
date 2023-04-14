import replace from "@rollup/plugin-replace";
import { expand } from "dotenv-expand";
import { config } from "dotenv-flow";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import banner from "rollup-plugin-banner2";
import esbuild from "rollup-plugin-esbuild";
import obfuscator from "rollup-plugin-obfuscator";
import metablock from "rollup-plugin-userscript-metablock";

expand(config());

const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * @type {import("./package.json")}
 */
const pkg = JSON.parse(
  await readFile(new URL("package.json", import.meta.url), "utf-8")
);

const envKeys = [
  "NODE_ENV",
  ...Object.keys(process.env).filter((key) => key.startsWith("SKETCH_")),
];

/**
 * @type {import("rollup").RollupOptions}
 */
const options = {
  input: "./src/index.ts",
  output: {
    file: fileURLToPath(new URL("dist/sploit.user.js", import.meta.url)),
    format: "esm",
    // sourcemap: isDevelopment ? "inline" : undefined,
  },
  plugins: [
    replace({
      ...envKeys.reduce((r, key) => {
        if (key in process.env)
          r[`process.env.${key}`] = JSON.stringify(process.env[key]);
        return r;
      }, {}),
      preventAssignment: true,
    }),
    esbuild({ minify: !isDevelopment }),
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
      },
      manager: "tampermonkey",
    }),
  ],
};

export default options;

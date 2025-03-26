import http from "node:http";
import { obfuscate } from "./obfuscate.js";
import { expand } from "dotenv-expand";
import { config } from "dotenv-flow";
import { build, context } from "esbuild";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import send from "@fastify/send";
import parseUrl from "parseurl";
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

const mainOut = fileURLToPath(new URL("dist/sketch.user.js", import.meta.url));

const sketchMain = await context({
  entryPoints: ["./src/index.ts"],
  format: "iife",
  sourcemap: "external",
  define: envReplacements,
  outfile: mainOut,
  external: ["os", "fs", "path", "http", "https", "electron"],
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
    {
      name: "heyyy",
      setup: (build) => {
        build.onEnd(() => {
          console.log("built sketch", pkg.version, "GG!!");
          console.log(new Date());
          console.log("i love you");
        });
      },
    },
  ],
  platform: "browser",
  banner: {
    js:
      userscriptMetadataGenerator({
        ...sketchMeta,
        version: pkg.version,
        // connect: [new URL(process.env.SKETCH_API_URL).hostname],
      }) + "\n/*eslint-disable*/",
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
          // connect: [new URL(process.env.SKETCH_API_URL).hostname],
        }) + "\n",
    },
  });

  console.log("produced", devOut);

  const server = http.createServer();
  server.on("request", (req, res) =>
    send(req, parseUrl(req).pathname, {
      root: "dist",
    }).then(({ statusCode, headers, stream }) => {
      headers["access-control-request-method"] = "GET, POST, OPTIONS";
      headers["access-control-allow-origin"] = "https://krunker.io";
      headers["access-control-allow-headers"] =
        "cache-control, content-type, accept";
      headers["cache-control"] = "no-cache";

      // normalize the url
      if ("Location" in headers) headers.Location = "/cdn" + headers.Location;
      stream.pipe(res);
      res.writeHead(statusCode, headers);
    })
  );

  server.on("listening", () => {
    console.log("dev server started on http://127.0.0.1:8080/");
  });

  server.listen({
    host: "127.0.0.1",
    port: 8080,
  });

  await sketchMain.watch();
} else {
  await sketchMain.rebuild();
  await sketchMain.dispose();
}

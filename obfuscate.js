import { transform } from "esbuild";
import obfuscator from "javascript-obfuscator";
import { readFile } from "node:fs/promises";

/**
 *
 * @returns {import("esbuild").Plugin}
 */
export function obfuscate() {
  return {
    name: "obfuscate",
    setup: (build) => {
      build.onLoad(
        {
          filter:
            /Menu\.tsx|createUI\.tsx|Outdated\.tsx|NotUpdated\.tsx|index\.tsx|KrunkBox\.ts/,
        },
        async (args) => {
          let { code } = await transform(await readFile(args.path), {
            loader: "tsx",
            jsx: "automatic",
            jsxFragment: "Fragment",
            jsxImportSource: "preact",
          });

          const obf = obfuscator.obfuscate(code, {
            target: "browser",
            deadCodeInjection: true,
            selfDefending: false,
            splitStrings: true,
            // splitStrings: false,
            transformObjectKeys: true,
            // transformObjectKeys: false,
            renameProperties: false,
            renameGlobals: false,
            numbersToExpressions: false,
            controlFlowFlattening: true,
            stringArray: true,
            stringArrayEncoding: ["base64"],
            stringArrayThreshold: 1,
            stringArrayCallsTransformThreshold: 1,
            // stringArray: false,
            simplify: true,
            compact: false,
          });

          return {
            contents: obf.getObfuscatedCode(),
            loader: "js",
          };
        }
      );
    },
  };
}

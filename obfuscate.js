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
          });

          const obf = obfuscator.obfuscate(code, {
            target: "browser",
            deadCodeInjection: true,
            selfDefending: false,
            splitStrings: true,
            stringArrayEncoding: ["base64"],
            stringArrayThreshold: 1,
            transformObjectKeys: true,
            renameProperties: false,
            renameGlobals: false,
            numbersToExpressions: false,
            controlFlowFlattening: true,
            stringArray: true,
            stringArrayCallsTransformThreshold: 1,
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

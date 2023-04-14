import type { Hook } from "./inject";
import { getGame, waitForGameLoad } from "./inject";

const hook: Hook<
  (module: { i: number; l: true; exports: unknown }) => unknown
> = (dataArg: string, src: string) => {
  // hook __webpack_require__, specifically the part where it returns module.exports and when it's generating the exports, not caching it
  // the hook is ran once per module
  src = src.replace(
    /,(\w+)\.l=!!\[],\1\.exports}/,
    (match, module) => `,${module}.l=true,${dataArg}(${module})}`
  );

  return {
    data: (module) => {
      console.log(module);
      return module.exports;
    },
    src,
  };
};

const gamePromise = getGame(hook);

waitForGameLoad().then(() =>
  gamePromise.then((load) => {
    if (load) load();
  })
);

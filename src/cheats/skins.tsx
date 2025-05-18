import {
  data,
  getGame,
  getLocalPlayer,
  getMenuPlayer,
  onGameHooks,
} from "../filters";
import type { Player, Skin } from "../krunker/Player";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { Switch } from "../krunker-ui/components/Switch";

function gameHook() {
  const { generateMeshes } = getGame().players;

  const vvv = [
    "dyeIndex",
    "bodyIndex",
    "backIndex",
    "waistIndex",
    "hatIndex",
    "headIndex",
    "faceIndex",
    "shoeIndex",
    "petIndex",
    "wristIndex",
    "skinCol",
    "skinColIndex",
    "shirtCol",
    "sleeveCol",
    "pantsCol",
    "waistCol",
    "shoeCol",
    "hairCol",
    "meleeIndex",
    "skins",
    "charms",
  ];

  const game = getGame();

  game.players.generateMeshes = function (player, ...args) {
    if (player.isYou) {
      const menuPlayer = getMenuPlayer();
      const s: Record<any, any> = {};
      for (const vanity of vvv) {
        s[vanity] = (player as any)[vanity];
        let val = (menuPlayer as any)[vanity];
        (player as any)[vanity] = val;
      }
      const classCfg = game.classConfig[player.classIndex];
      const c = classCfg.loadout;
      // console.log("fuck", c, classCfg, player.classIndex, game.classConfig);
      const savedSkins = getSavedVal("skins");
      const oa: Record<string, number | null> = savedSkins
        ? JSON.parse(savedSkins)
        : [];
      const w = oa[c[0]];
      const secondaryInd = getSavedVal("secondaryInd") || 2;
      const skins = [
        typeof w === "number" ? w : -1,
        oa[secondaryInd] != null && classCfg.secondary ? oa[secondaryInd] : -1,
      ];
      const savedCharms = getSavedVal("charms");
      const vn = savedCharms ? JSON.parse(savedCharms) : [];

      let favList: number[] = [];

      const Tr = getSavedVal("krk_favList") || "[]";
      try {
        favList = JSON.parse(Tr);
      } catch {}

      function va<T>(e: T[]) {
        return e[dt(0, e.length - 1)];
      }
      function dt(e: number, a: number) {
        return Math.floor(Math.random() * (a - e + 1)) + e;
      }
      function Nn(e?: number, a?: number, t?: number) {
        var n = game.store.skins
            .map((_, i) => ({ ind: i, cnt: 1 }))
            .filter((lol) => {
              const s = game.store.skins[lol.ind];
              return (
                s &&
                (a !== undefined ? s.type == a : !s.type && s.weapon === e) &&
                (s.classIndex === undefined ||
                  s.classIndex == player.classIndex) &&
                t === undefined
              );
            }),
          r = n.filter(function (s) {
            return favList.indexOf(s.ind) >= 0;
          });
        return r.length ? va(r).ind || -1 : (n.length && va(n).ind) || -1;
      }

      const charms = [
        vn[0] == -2 ? Nn(undefined, 12) : parseInt(vn[0]),
        vn[1] != null && classCfg.secondary
          ? vn[1] == -2
            ? Nn(undefined, 12)
            : parseInt(vn[1])
          : -1,
      ];

      // console.log(player.skins);
      player.skins = skins;
      player.charms = charms;
      if (game.config.thirdPerson) player.wristIndex = -1;
      generateMeshes.call(this, player, ...args);

      for (const vanity of vvv) (player as any)[vanity] = s[vanity];
    } else {
      generateMeshes.call(this, player, ...args);
    }

    return player.objInstances;
  };
}

export function skinHackHook() {
  const dummySkinArray = [...Array(25000)].map((_, i) => ({
    ind: i,
    cnt: 1,
  })) as Skin[];

  onGameHooks.push(gameHook);

  data.uiSkins = (skinArray: Skin[]) => {
    if (sketchConfig.get("skinHack")) return dummySkinArray;
    else return skinArray;
  };

  Object.defineProperty(data, "skinHack", {
    get: () => sketchConfig.get("skinHack"),
  });

  data.spraySemen = (_: Player, skinI?: number) => {
    skinI ||= Number(
      getSavedVal("sprayIndex") || getSavedVal("sprayindex") || 2482
    );

    // console.log(skinI);
    getGame().players.spray(getLocalPlayer(), skinI);
  };
}

export function SkinHackMenu() {
  // const [skinHack, setSkinHack] = useSketchConfig("skinHack");

  // return (
  //   <Switch
  //     title="Skin Hack"
  //     description="Unlocks all the skins. Your skins will only appear to you. They won't show to other players. You must be signed in."
  //     defaultChecked={skinHack}
  //     onChange={(event) => setSkinHack(event.currentTarget.checked)}
  //   />
  // );
  return <></>
}

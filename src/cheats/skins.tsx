import {
  getMenuPlayer,
  ioDispatchHooks,
  ioSendHooks,
  playerConstructorHooks,
} from "../filters";
import type { Player } from "../krunker/Player";
import type { Skin } from "../krunker/Player";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { Switch } from "krunker-ui/components/Switch";

let skinData: Record<string, number> | undefined;

export function skinHackHook() {
  const dummySkinArray = [...Array(25000)].map((_, i) => ({
    ind: i,
    cnt: 1,
  })) as Skin[];

  const realSkins = new WeakMap<Player, Skin[]>();

  function resolveSkin(id: number) {
    const menuPlayer = getMenuPlayer();
    if (!menuPlayer) return;
    const skins = realSkins.get(menuPlayer) || menuPlayer.skins;

    // remove skins if they don't have it
    return id === -1 || skins.find(({ ind }) => ind === id) ? -1 : id;
  }

  playerConstructorHooks.push((player) => {
    realSkins.set(player, player.skins);

    Object.defineProperty(player, "skins", {
      get() {
        if (sketchConfig.get("skinHack")) return dummySkinArray;
        else return realSkins.get(player);
      },
      set(value) {
        realSkins.set(player, value);
      },
    });
  });

  ioSendHooks.push((packet, data) => {
    if (packet === "en" && sketchConfig.get("skinHack")) {
      const skins = data[0];

      skinData = {
        main: skins[2][0],
        secondary: skins[2][1],
        hat: skins[3],
        body: skins[4],
        knife: skins[9],
        dye: skins[14],
        shoe: skins[15],
        waist: skins[17],
        face: skins[20],
        pet: skins[21],
        wrist: skins[25],
        charm: skins[29][0],
        charms: skins[29][1],
      };

      for (const i in [0, 1]) skins[2][i] = resolveSkin(skins[2][i]);

      for (const i of [3, 4, 9, 14, 15, 17, 21, 25])
        skins[i] = resolveSkin(skins[i]);

      for (const i in [0, 1]) skins[29][i] = resolveSkin(skins[29][i]);
    }
  });

  ioDispatchHooks.push((packet, data) => {
    if (sketchConfig.get("skinHack") && skinData && packet === "0") {
      const menuPlayer = getMenuPlayer();

      if (!menuPlayer) return;

      const skinValue = data[0][0];
      let offset = 46;
      while (skinValue.length % offset !== 0) offset++;

      for (let i = 0; i < skinValue.length; i += offset) {
        if (skinValue[i + 5] === menuPlayer.name) {
          skinValue[i + 12] = [skinData.main, skinData.secondary];
          skinValue[i + 13] = skinData.hat;
          skinValue[i + 14] = skinData.body;
          skinValue[i + 19] = skinData.knife;
          skinValue[i + 24] = skinData.dye;
          skinValue[i + 29] = skinData.shoe;
          skinValue[i + 32] = skinData.waist;
          skinValue[i + 33] = skinData.face;
          skinValue[i + 34] = skinData.pet;
          skinValue[i + 36] = skinData.wrist;
          skinValue[i + 39] = [skinData.charm, skinData.charms];
        }
      }
    }
  });
}

export function SkinHackMenu() {
  const [skinHack, setSkinHack] = useSketchConfig("skinHack");

  return (
    <Switch
      title="Skin Hack"
      description="Unlocks all the skins. Your skins will only appear to you. They won't show to other players. You must be signed in."
      defaultChecked={skinHack}
      onChange={(event) => setSkinHack(event.currentTarget.checked)}
    />
  );
}

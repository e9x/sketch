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

interface SkinHackSkins {
  main: number;
  secondary: number;
  hat: number;
  body: number;
  knife: number;
  dye: number;
  waist: number;
}

let skinData: SkinHackSkins | undefined;

export function skinHackHook() {
  const dummySkinArray = [...Array(25000)].map((_, i) => ({
    ind: i,
    cnt: 1,
  })) as Skin[];

  const realSkins = new WeakMap<Player, Skin[]>();

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
      skinData = {
        main: data[0][2][0],
        secondary: data[0][2][1],
        hat: data[0][3],
        body: data[0][4],
        knife: data[0][9],
        dye: data[0][14],
        waist: data[0][17],
      };

      const menuPlayer = getMenuPlayer();
      if (!menuPlayer) return;
      const skins = realSkins.get(menuPlayer) || menuPlayer.skins;

      // remove skins if they don't have it

      // primary, secondary
      for (const skinId in [0, 1])
        if (
          data[0][2][skinId] !== -1 &&
          !skins.find(({ ind }) => ind === data[0][2][skinId])
        )
          data[0][2][skinId] = -1;

      // hat, body, knife, dye, waist
      for (const skinId of [3, 4, 9, 14, 17])
        if (
          data[0][skinId] !== -1 &&
          !skins.find(({ ind }) => ind === data[0][skinId])
        )
          data[0][skinId] = -1;
    }
  });

  ioDispatchHooks.push((packet, data) => {
    if (sketchConfig.get("skinHack") && skinData && packet === "0") {
      const menuPlayer = getMenuPlayer();

      if (!menuPlayer) return;

      const skinValue = data[0][0];
      let offset = 38;
      while (skinValue.length % offset !== 0) offset++;

      for (let i = 0; i < skinValue.length; i += offset) {
        if (skinValue[i + 5] === menuPlayer.name) {
          skinValue[i + 12] = [skinData.main, skinData.secondary];
          skinValue[i + 13] = skinData.hat;
          skinValue[i + 14] = skinData.body;
          skinValue[i + 19] = skinData.knife;
          skinValue[i + 24] = skinData.dye;
          skinValue[i + 33] = skinData.waist;
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

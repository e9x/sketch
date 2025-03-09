import { data, getMenuPlayer, newGamePlayerHooks } from "../filters";
import type { Skin } from "../krunker/Player";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { Switch } from "krunker-ui/components/Switch";

export function skinHackHook() {
  const dummySkinArray = [...Array(25000)].map((_, i) => ({
    ind: i,
    cnt: 1,
  })) as Skin[];

  data.uiSkins = (skinArray: Skin[]) => {
    if (sketchConfig.get("skinHack")) return dummySkinArray;
    else return skinArray;
  };

  Object.defineProperty(data, "skinHack", {
    get: () => sketchConfig.get("skinHack"),
  });

  newGamePlayerHooks.push((player) => {
    for (const vanity of [
      "skins",
      "charms",
      "faceIndex",
      "shoeIndex",
      "hatIndex",
      "headIndex",
      "bodyIndex",
      "backIndex",
      "waistIndex",
      "petIndex",
      "wristIndex",
      "meleeIndex",
      "skinColIndex",
      "hairCol",
      "dyeIndex",
      "pcStatIndex",
      "attachIndex",
      "secIndex",
    ]) {
      let o = (player as any)[vanity];
      Object.defineProperty(player, vanity, {
        get() {
          if (!player.isYou) return o;
          const menuPlayer = getMenuPlayer();
          if (sketchConfig.get("skinHack")) return (menuPlayer as any)[vanity];
          else return o;
        },
        set(value) {
          o = value;
        },
      });
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

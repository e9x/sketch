import { data, getGame, getLocalPlayer } from "../filters";
import type { Player, Skin } from "../krunker/Player";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { Switch } from "krunker-ui/components/Switch";
import type * as ioModule from "../krunker/io";

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

  data.spraySemen = (_: Player, skinI?: number) => {
    skinI ||= Number(
      getSavedVal("sprayIndex") || getSavedVal("sprayindex") || 2482
    );

    // console.log(skinI);
    getGame().players.spray(getLocalPlayer(), skinI);
  };

  data.BroadcastTheFuckingShitLikeAGoodBoy = (
    areYouGonnaDoIt: boolean,
    io: typeof ioModule,
    ...shit: any[]
  ) => {
    if (sketchConfig.get("skinHack")) {
      // console.trace("skin me", shit);
      getGame().addSpray(...shit);
    }
    //@ts-ignore
    else if (areYouGonnaDoIt) io.send(...shit);
  };
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

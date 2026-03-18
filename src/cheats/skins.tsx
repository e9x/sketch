import { useSketchConfig } from "../sketchConfig";
import { Switch } from "../krunker-ui/components/Switch";
import { Hook } from "./skinchanger/hook";
import Mod from "./skinchanger/mod";

export function skinHackHook() {
  new Hook().init(new Mod());
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

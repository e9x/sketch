import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { Switch } from "../krunker-ui/components/Switch";
import Mod from './skinhack/mod';
import { Hook } from './skinhack/hook';

export function skinHackHook() {
  if (!sketchConfig.get("skinHack")) return;

  const cheat = new Mod();
  const hook = new Hook();

  hook.init(cheat);
}

export function SkinHackMenu() {
  const [skinHack, setSkinHack] = useSketchConfig("skinHack");

  return (
    <Switch
      title="Skin Hack"
      description="Unlocks all the skins. Your skins will only appear to you. They won't show to other players. You must be signed in."
      attention
      defaultChecked={skinHack}
      onChange={(event) => setSkinHack(event.currentTarget.checked)}
    />
  );
}

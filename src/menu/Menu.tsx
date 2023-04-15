import { AimbotMenu } from "../cheats/aimbot";
import { BhopMenu } from "../cheats/bhop";
import { ForceAutoMenu } from "../cheats/forceAuto";
import { TriggerbotMenu } from "../cheats/triggerbot";
import { Set } from "./components/Set";

export default function Menu() {
  return (
    <Set title="Art">
      <BhopMenu />
      <AimbotMenu />
      <TriggerbotMenu />
      <ForceAutoMenu />
    </Set>
  );
}

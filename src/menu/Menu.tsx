import { AimbotMenu } from "../cheats/aimbot";
import { AutoReloadMenu } from "../cheats/autoReload";
import { BhopMenu } from "../cheats/bhop";
import { ForceAutoMenu } from "../cheats/forceAuto";
import { TriggerbotMenu } from "../cheats/triggerbot";
import { Set } from "./components/Set";

export default function Menu() {
  return (
    <>
      <Set title="Skill">
        <BhopMenu />
        <ForceAutoMenu />
        <AutoReloadMenu />
        <TriggerbotMenu />
      </Set>
      <Set title="Aim">
        <AimbotMenu />
      </Set>
    </>
  );
}

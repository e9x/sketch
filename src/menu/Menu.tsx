import { AimbotMenu } from "../cheats/aimbot";
import { BhopMenu } from "../cheats/bhop";
import { ESPMenu } from "../cheats/esp";
import { ForceAutoMenu } from "../cheats/forceAuto";
import { TriggerbotMenu } from "../cheats/triggerbot";
import { Set } from "./components/Set";

export default function Menu() {
  return (
    <>
      <Set title="Aim">
        <AimbotMenu />
      </Set>
      <Set title="Skill">
        <BhopMenu />
        <ForceAutoMenu />
        <TriggerbotMenu />
      </Set>
      <Set title="ESP">
        <ESPMenu />
      </Set>
    </>
  );
}

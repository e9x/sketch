import { AimbotMenu } from "../cheats/aimbot";
import { BhopMenu } from "../cheats/bhop";
import { ESPMenu } from "../cheats/esp";
import { ForceAutoMenu } from "../cheats/forceAuto";
import { RecoilControlMenu } from "../cheats/recoilControl";
import { TriggerbotMenu } from "../cheats/triggerbot";
import { discordURL, docsURL } from "../consts";
import Control from "./components/Control";
import Link from "./components/Link";
import { HeadlessSet, Set } from "./components/Set";

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
        <RecoilControlMenu />
      </Set>
      <Set title="ESP">
        <ESPMenu />
      </Set>
      <HeadlessSet>
        <Link title="Documentation" href={docsURL} />
        <Link title="Discord Server" href={discordURL} />
        <Control title="The Gaming Gurus" />
      </HeadlessSet>
    </>
  );
}

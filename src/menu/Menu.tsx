import { AimbotMenu } from "../cheats/aimbot";
import { BhopMenu } from "../cheats/bhop";
import { ESPMenu } from "../cheats/esp";
import { ForceAutoMenu } from "../cheats/forceAuto";
import { RecoilControlMenu } from "../cheats/recoilControl";
import { TriggerbotMenu } from "../cheats/triggerbot";
import useConfig, { configSet } from "../config";
import { discordURL, docsURL } from "../consts";
import BindHolder, { Bind } from "./components/Bind";
import Control from "./components/Control";
import Link from "./components/Link";
import { HeadlessSet, Set } from "./components/Set";
import Switch from "./components/Switch";

export const defaultMenuKey = -1;
export const defaultMenuButton = true;

export default function Menu() {
  const [menuKey, setMenuKey] = useConfig<number>("menuKey", defaultMenuKey);
  const [menuButton] = useConfig<boolean>("menuButton", defaultMenuButton);

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
      <Set title="Menu">
        <BindHolder title="Menu Key">
          <Bind
            bind={menuKey}
            setBind={(bind) => setMenuKey(bind)}
            reset={() => setMenuKey(null)}
            unbind={() => setMenuKey(-1)}
          />
        </BindHolder>
        <Switch
          title="Menu Button"
          attention
          description="Requires Restart"
          defaultChecked={menuButton}
          onChange={(event) => {
            if (menuKey === -1) {
              event.currentTarget.checked = false;
              alert("You must set a menu keybind before disabling the button");
            } else {
              // use configSet so it's instant
              configSet("menuButton", event.currentTarget.checked);
              location.reload();
            }
          }}
        />
      </Set>
      <HeadlessSet>
        <Link title="Documentation" href={docsURL} />
        <Link title="Discord Server" href={discordURL} />
        <Control title="The Gaming Gurus" />
      </HeadlessSet>
    </>
  );
}

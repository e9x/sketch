import { AimbotMenu } from "../cheats/aimbot";
import { BhopMenu } from "../cheats/bhop";
import { ESPMenu } from "../cheats/esp";
import { ForceAutoMenu } from "../cheats/forceAuto";
import { RecoilControlMenu } from "../cheats/recoilControl";
import { TriggerbotMenu } from "../cheats/triggerbot";
import useConfig, { configSet } from "../config";
import { discordURL, docsURL } from "../consts";
import Settings from "./Settings";
import BindHolder, { Bind } from "./components/Bind";
import Control from "./components/Control";
import Link from "./components/Link";
import { HeadlessSet, Set } from "./components/Set";
import Switch from "./components/Switch";

export default function Menu() {
  const [menuKey, setMenuKey] = useConfig("menuKey");
  const [menuButton] = useConfig("menuButton");

  return (
    <Settings
      tabs={[
        {
          name: "Menu",
          body: () => {
            return (
              <>
                <Set title="Menu">
                  <BindHolder title="Menu Key">
                    <Bind
                      bind={menuKey}
                      setBind={(bind) => setMenuKey(bind)}
                      reset={() => setMenuKey()}
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
                        alert(
                          "You must set a menu keybind before disabling the button"
                        );
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
          },
        },
        {
          name: "Aim",
          body: () => {
            return <AimbotMenu />;
          },
        },
        {
          name: "Skill",
          body: () => {
            return (
              <>
                <Set title="Skill">
                  <BhopMenu />
                  <ForceAutoMenu />
                </Set>
                <Set title="Triggerbot">
                  <TriggerbotMenu />
                </Set>
                <Set title="Recoil Control">
                  <RecoilControlMenu />
                </Set>
              </>
            );
          },
        },
        {
          name: "Visual",
          body: () => {
            return (
              <Set title="ESP">
                <ESPMenu />
              </Set>
            );
          },
        },
      ]}
    />
  );
}

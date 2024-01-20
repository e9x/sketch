import {
  getGame,
  getLocalPlayer,
  getRealClearColor,
  getRender,
} from "../filters";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { getExposedWindow } from "consts";
import ColorPicker from "krunker-ui/components/ColorPicker";
import { HeadlessSet } from "krunker-ui/components/Set";
import Switch from "krunker-ui/components/Switch";

export function tweaksHook() {
  if (sketchConfig.get("adblock")) {
    const style = document.createElement("style");
    style.textContent = "#adCon, *[id*='aHider'] { display: none !IMPORTANT; }";

    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.append(style);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win: any = getExposedWindow();

    Object.defineProperty(win, "clearPops", {
      set: (v) => {
        delete win.clearPops;
        win.clearPops = v;
        win.canShowAds = false;
        win.useFRVRSDKAds = false;
        win.useFRVRSDKBannerAds = false;
        delete win.FRVR.config.ads;
        win.FRVR.init("prod");
        throw new Error("breaking krunker ad loading");
      },
      configurable: true,
    });
  }
}

export function TweaksMenu() {
  const [adblock, setAdblock] = useSketchConfig("adblock");
  const [thirdPerson, setThirdPerson] = useSketchConfig("thirdPerson");
  const [skyColor, setSkyColor] = useSketchConfig("skyColor");
  const [skyColorHex, setSkyColorHex] = useSketchConfig("skyColorHex");

  return (
    <HeadlessSet>
      <Switch
        title="Adblock"
        description="Blocks ads. Requires restart"
        attention
        defaultChecked={adblock}
        onChange={(event) => {
          setAdblock(event.currentTarget.checked);
          location.reload();
        }}
      />
      <Switch
        title="Third Person"
        description="Enables third person mode"
        defaultChecked={thirdPerson}
        onChange={(event) => {
          setThirdPerson(event.currentTarget.checked);
          try {
            getGame().players.regenMeshes(getLocalPlayer());
          } catch {
            // game or localPlayer aren't a thing yet
          }
        }}
      />
      <Switch
        title="Use Custom Sky Color"
        description="Changes the sky's color"
        defaultChecked={skyColor}
        onChange={(event) => {
          setSkyColor(event.currentTarget.checked);
          try {
            // trigger an update
            getRender().renderer.setClearColor(getRealClearColor());
          } catch {
            //
          }
        }}
      />
      <ColorPicker
        title="Sky Color"
        description="Changes the sky's color"
        defaultValue={skyColorHex}
        onChange={(event) => {
          setSkyColorHex(event.currentTarget.value);
          if (sketchConfig.get("skyColor"))
            try {
              // trigger an update
              getRender().renderer.setClearColor(getRealClearColor());
            } catch {
              //
            }
        }}
      />
    </HeadlessSet>
  );
}

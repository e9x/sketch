import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { getExposedWindow } from "../consts";
import { Switch } from "../krunker-ui/components/Switch";

export function adblockHook() {
  if (sketchConfig.get("adblock")) {
    const style = document.createElement("style");
    style.textContent = "#adCon, *[id*='aHider'] { display: none !IMPORTANT; }";

    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.append(style);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win: any = getExposedWindow();

    const msg = "breaking krunker ad loading";

    Object.defineProperty(win, "clearPops", {
      set: (v) => {
        delete win.clearPops;
        win.clearPops = v;
        win.canShowAds = false;
        win.useFRVRSDKAds = false;
        win.useFRVRSDKBannerAds = false;
        delete win.FRVR.config.ads;
        win.FRVR.init("prod");
        window.addEventListener(
          "error",
          (event) => {
            if (event.error?.message === msg) event.preventDefault();
          },
          { once: true },
        );
        throw new Error(msg);
      },
      configurable: true,
    });
  }
}

export function AdblockMenu() {
  const [adblock, setAdblock] = useSketchConfig("adblock");

  return (
    <>
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
    </>
  );
}

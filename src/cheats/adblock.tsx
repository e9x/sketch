import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { getExposedWindow } from "../consts";
import { Switch } from "../krunker-ui/components/Switch";

// third-party tracking/analytics domains to block entirely
const BLOCKED_DOMAINS =
  /^https?:\/\/([^/]*\.)?(pollfish\.com|paypalobjects\.com|amazon-adsystem\.com|doubleclick\.net|cookiepro\.com|poll\.fish|paypal\.com|twitter\.com|youtube\.com|googletagmanager\.com|imasdk\.googleapis\.com|googlesyndication\.com|google-analytics\.com)(\/|$)/i;

// specific blocked paths on game/cdn domains
const BLOCKED_PATHS =
  /^https?:\/\/(cdn\.ravenjs\.com\/|krunker\.io\/(manifest\.json|css\/google-play\.css|img\/(btc_icn\.png|app_[01]\.png|muzflash\.png|client\.png)|libs\/(chart\.bundle|fflate|purejscarousel|nipplejs\.min\.js|anzu\.js)|service-worker\.js)|assets\.krunker\.io\/(sound\/ambient_|models\/clouds_0\.obj)|user-assets\.krunker\.io\/(60585\/|61(806|814|815|818|820|821|822|823|824)\/model\.obj)|(fran-cdn\.frvr\.com|cdn\.frvr\.com\/fran)\/prebid|unpkg\.com\/web3|storage\.googleapis\.com\/pollfish_production|apis\.google\.com\/js\/platform\.js)/i;

export function shouldBlockURL(url: string): boolean {
  return BLOCKED_DOMAINS.test(url) || BLOCKED_PATHS.test(url);
}

export function adblockHook() {
  if (sketchConfig.get("adblock")) {
    const style = document.createElement("style");
    style.textContent = "#adCon, *[id*='aHider'] { display: none !IMPORTANT; }";

    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.append(style);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win: any = getExposedWindow();

    const adblockErrMsg = "breaking krunker ad loading";

    const handleAdblockError = (event: ErrorEvent) => {
      if (event.error?.message === adblockErrMsg) {
        event.preventDefault();
        window.removeEventListener("error", handleAdblockError);
      }
    };
    window.addEventListener("error", handleAdblockError);

    Object.defineProperty(win, "clearPops", {
      set: (v) => {
        delete win.clearPops;
        win.clearPops = v;
        win.canShowAds = false;
        win.useFRVRSDKAds = false;
        win.useFRVRSDKBannerAds = false;
        delete win.FRVR.config.ads;
        win.FRVR.init("prod");
        throw new Error(adblockErrMsg);
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

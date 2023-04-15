import useConfig, { configGet } from "../config";
import { iInputs } from "../consts";
import { getLocalPlayer, inputHooks } from "../filters";
import Switch from "../menu/components/Switch";
import { defaultAutoFire } from "./aimbot";
import random from "lodash/random";

const defaultAutoReload = false;

export function autoReloadHook() {
  let reloading = 0;

  inputHooks.push((inputs) => {
    if (
      !configGet("autoReload", defaultAutoReload) &&
      !configGet("autoFire", defaultAutoFire)
    )
      return;

    const localPlayer = getLocalPlayer();

    // check if we already sent the reload input so we don't spam the reload input
    if (!localPlayer.ammos[localPlayer.loadoutIndex]) {
      // keep sending the input until we hit the "time limit" for reloading, declared when reloading = ...
      if (reloading === 0 || inputs[iInputs.frame] < reloading) {
        inputs[iInputs.reload] = 1;

        // reload for a random amount of frames to simulate pressing it
        // set reloading only as soon as we start holding the input down
        if (reloading === 0) reloading = inputs[iInputs.frame] + random(3, 8);
      }
    } else reloading = 0;
  });
}

export function AutoReloadMenu() {
  const [autoReload, setAutoReload] = useConfig(
    "autoReload",
    defaultAutoReload
  );

  return (
    <Switch
      title="Auto Reload"
      description="Automatically reloads your guns"
      defaultChecked={autoReload}
      onChange={(event) => setAutoReload(event.currentTarget.checked)}
    />
  );
}

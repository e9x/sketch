import useConfig, { configGet } from "../config";
import { iInputs } from "../consts";
import { getLocalPlayer, inputHooks } from "../filters";
import Switch from "../menu/components/Switch";
import random from "lodash/random";

const defaultBhop = false;

let lastJump = 0;
// value between -1 and 1 that determines the velocity to start slidehopping at
// positive = going down
// negative = still increasing in velocity
let zeroSome = 0;
let didCrouch = false;

inputHooks.push((inputs) => {
  if (!configGet("bhop", defaultBhop)) return;

  const localPlayer = getLocalPlayer();

  if (!localPlayer) return;

  if (inputs[iInputs.jump]) {
    inputs[iInputs.jump] =
      localPlayer.onGround || (localPlayer.wallJump && localPlayer.onWall)
        ? lastJump
        : 0;
    lastJump ^= 1;

    // ~~if crouch isn't already held, override crouch~~
    // if(!inputs[iInputs.crouch])

    // if crouch is held, slidehop
    if (inputs[iInputs.crouch]) {
      // pick a new "zeroSome" everytime we slidehop
      // otherwise they will randomly start/stop crouching as zeroSome is recalculated
      // the users will appear to be relatively accurate with slidehopping
      if (!didCrouch) zeroSome = random(-0.015, 0.005, true);

      inputs[iInputs.crouch] = (localPlayer.velocity.y || 0) < zeroSome ? 1 : 0;
      if (inputs[iInputs.crouch]) didCrouch = true;
    } else {
      didCrouch = false;
    }
  }
});

export function BhopMenu() {
  const [bhop, setBhop] = useConfig("bhop", defaultBhop);

  return (
    <Switch
      title="Bhop"
      description="Hold space to bhop and crouch to slidehop."
      defaultChecked={bhop}
      onChange={(event) => setBhop(event.currentTarget.checked)}
    />
  );
}

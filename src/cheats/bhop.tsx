import useConfig, { configGet } from "../config";
import { iInputs } from "../consts";
import { getLocalPlayer, inputHooks } from "../filters";
import Switch from "../menu/components/Switch";
import random from "lodash/random";

const defaultBhop = false;

export function bhopHook() {
  // value between -1 and 1 that determines the velocity to start slidehopping at
  // positive = going down
  // negative = still increasing in velocity
  let zeroSome = 0;
  let didCrouch = false;
  let bhopTimer = 0;
  let bhopping = 0;

  // average recorded natural interval
  // not wallhops
  const bhopDelay = 80;

  inputHooks.push((inputs) => {
    if (!configGet<boolean>("bhop", defaultBhop)) return;

    const localPlayer = getLocalPlayer();

    if (!localPlayer) return;

    if (inputs[iInputs.jump]) {
      const canWallJump = localPlayer.wallJump && localPlayer.onWall;
      const canBhop = canWallJump || localPlayer.onGround;

      const period = Date.now() - bhopTimer;

      const bhopTime = !bhopping || period > bhopDelay;

      const mustBhop = inputs[iInputs.frame] < bhopping;

      // reload for a random amount of frames to simulate pressing it
      // set bhopping only as soon as we start holding the input down
      if (canBhop && bhopTime) {
        bhopTimer = Date.now();
        bhopping = inputs[iInputs.frame] + random(3, 8);
        inputs[iInputs.jump] = 1;
      } else {
        inputs[iInputs.jump] = mustBhop ? 1 : 0;
      }
    } else {
      bhopping = 0;
      bhopTimer = 0;
    }

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
  });
}

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

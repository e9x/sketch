import useConfig, { configGet } from "../config";
import { iInputs } from "../consts";
import { getLocalPlayer, inputHooks } from "../filters";
import Switch from "../menu/components/Switch";
import random from "lodash/random";

function pickZeroSome() {
  return random(-0.015, 0.005, true);
}

function isBhoppable() {
  const localPlayer = getLocalPlayer();

  return (localPlayer.wallJump && localPlayer.onWall) || localPlayer.onGround;
}

export function bhopHook() {
  // value between -1 and 1 that determines the velocity to start slidehopping at
  // positive = going down
  // negative = still increasing in velocity
  let zeroSome = pickZeroSome();
  let nextZeroSome = pickZeroSome();
  let didCrouch = false;
  let bhopTimer = 0;
  let bhopping = 0;

  // average recorded natural interval
  // not wallhops
  const bhopDelay = 60;

  inputHooks.push((inputs) => {
    if (!configGet("bhop")) return;

    const localPlayer = getLocalPlayer();

    if (!localPlayer) return;

    if (inputs[iInputs.jump]) {
      const canBhop = isBhoppable() && Date.now() - bhopTimer > bhopDelay;

      const mustBhop = inputs[iInputs.frame] <= bhopping;

      // reload for a random amount of frames to simulate pressing it
      // set bhopping only as soon as we start holding the input down
      if (canBhop && (!bhopping || !mustBhop)) {
        //console.log("set mustBhop");
        bhopTimer = Date.now();
        bhopping = inputs[iInputs.frame] + random(3, 8);
      }

      inputs[iInputs.jump] = mustBhop ? 1 : 0;
    } else {
      bhopping = 0;
      bhopTimer = 0;
    }

    // ~~if crouch isn't already held, override crouch~~
    // if(!inputs[iInputs.crouch])

    // if crouch is held, slidehop
    if (inputs[iInputs.crouch]) {
      if (!didCrouch) {
        zeroSome = nextZeroSome;
      }

      // pick a new "zeroSome" everytime we slidehop
      // otherwise they will randomly start/stop crouching as zeroSome is recalculated
      // the users will appear to be relatively accurate with slidehopping
      const willCrouch = (localPlayer.velocity.y || 0) < zeroSome;

      inputs[iInputs.crouch] = willCrouch ? 1 : 0;

      if (!didCrouch && willCrouch) nextZeroSome = pickZeroSome();

      didCrouch = willCrouch;
    } else {
      didCrouch = false;
    }
  });
}

export function BhopMenu() {
  const [bhop, setBhop] = useConfig("bhop");

  return (
    <Switch
      title="Bhop"
      description="Hold space to bhop and crouch to slidehop."
      defaultChecked={bhop}
      onChange={(event) => setBhop(event.currentTarget.checked)}
    />
  );
}

import { iInputs } from "../consts";
import CircularInputBuffer from "./circularInputBuffer";
import { InputFlags } from "./flags";

export const data = new CircularInputBuffer(400);

function normalizeAngle(angle: number) {
  while (angle < 0) {
    angle += Math.PI * 2;
  }
  while (angle >= Math.PI * 2) {
    angle -= Math.PI * 2;
  }
  return angle;
}

function rotationDifference(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { deltaX: number; deltaY: number } {
  // Normalize the input angles to the range [0, Math.PI * 2)
  x1 = normalizeAngle(x1);
  y1 = normalizeAngle(y1);
  x2 = normalizeAngle(x2);
  y2 = normalizeAngle(y2);

  // Calculate the difference between the angles
  let deltaX = x2 - x1;
  let deltaY = y2 - y1;

  // Correct the differences to be within the range [-Math.PI, Math.PI)
  if (deltaX > Math.PI) {
    deltaX -= Math.PI * 2;
  } else if (deltaX < -Math.PI) {
    deltaX += Math.PI * 2;
  }

  if (deltaY > Math.PI) {
    deltaY -= Math.PI * 2;
  } else if (deltaY < -Math.PI) {
    deltaY += Math.PI * 2;
  }

  return { deltaX, deltaY };
}

let lastInputs: number[] | undefined;

export function hookInputs(inputs: number[]) {
  if (lastInputs) {
    const x1 = inputs[iInputs.xDir] / 1000;
    const y1 = inputs[iInputs.yDir] / 1000;

    const x2 = lastInputs[iInputs.xDir] / 1000;
    const y2 = lastInputs[iInputs.yDir] / 1000;

    const delta = rotationDifference(x1, y1, x2, y2);

    const distance = Math.hypot(delta.deltaX, delta.deltaY);

    const flags =
      (inputs[iInputs.shoot] === 1 ? InputFlags.shoot : 0) |
      (inputs[iInputs.scope] === 1 ? InputFlags.scope : 0) |
      (inputs[iInputs.jump] === 1 ? InputFlags.jump : 0) |
      (inputs[iInputs.crouch] === 1 ? InputFlags.crouch : 0) |
      (inputs[iInputs.reload] === 1 ? InputFlags.reload : 0);

    data.add(distance, flags);
  }

  lastInputs = inputs;
}

import { getKeyCode } from "krunker-ui/keys";

export const keyListeners: ((
  event: MouseEvent | KeyboardEvent,
  code: number,
  down: boolean
) => void)[] = [];

export const keys = new Set<number>();

function gotKey(event: MouseEvent | KeyboardEvent, down: boolean) {
  const code = getKeyCode(event);

  if (down) keys.add(code);
  else keys.delete(code);

  for (const listener of keyListeners) listener(event, code, down);
}

function keyDown(event: MouseEvent | KeyboardEvent) {
  gotKey(event, true);
}

function keyUp(event: MouseEvent | KeyboardEvent) {
  gotKey(event, false);
}

window.addEventListener("keydown", keyDown);
window.addEventListener("keyup", keyUp);
window.addEventListener("mousedown", keyDown);
window.addEventListener("mouseup", keyUp);

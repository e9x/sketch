export enum InputFlags {
  shoot = 2 ** 0,
  scope = 2 ** 1,
  jump = 2 ** 2,
  crouch = 2 ** 3,
  reload = 2 ** 4,
}

export const inputFlags: [flag: InputFlags, color: string, name: string][] = [
  [InputFlags.shoot, "red", "Shoot"],
  [InputFlags.scope, "orange", "Scope"],
  [InputFlags.jump, "blue", "Jump"],
  [InputFlags.crouch, "green", "Crouch"],
  [InputFlags.reload, "purple", "Reload"],
];

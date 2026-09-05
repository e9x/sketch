import { type SketchConfig } from "../sketchConfig";

// Gameplay settings only. Cosmetics (sky, skybox, clouds, ESP colors,
// opacities), UI preferences, and user data like targetList are left alone so
// applying this preset doesn't clobber unrelated config.
export const legitConfig: Partial<SketchConfig> = {
  // aim
  aimbot: "smooth",
  aimbotEnabled: true,
  hitbox: "auto",
  aimKey: 10001,
  aimReactionTime: 0,
  fovCheck: true,
  fovRadius: 30,
  smoothFactor: 0.9,
  targetOnAimKey: false,
  drawFOV: false,
  multiPoint: false,
  noAdsFovMlt: false,
  mouseLockX: 0.04,
  mouseLockY: 0.04,

  // rage-only behavior stays off
  bot: false,
  botAim: false,
  wallbangs: false,
  spinbot: "off",
  forceAuto: false,
  skinHack: false,

  // triggerbot
  triggerbot: false,
  triggerbotMin: 0.1,
  triggerbotMax: 0,
  triggerbotDistance: 0,

  // recoil
  recoilControl: false,
  recoilSmoothFactor: 0,

  // movement
  bhop: false,
  slidehop: false,
  wallJump: false,
  thirdPerson: false,

  // visuals
  nametags: false,
  newNametags: false,
  boxes: false,
  chams: false,
  tracers: false,
  healthBars: false,
};

import { adblockHook } from "./cheats/adblock";
import { aimbotHook } from "./cheats/aimbot";
import { bhopHook } from "./cheats/bhop";
import { espHook } from "./cheats/esp";
import { forceAutoHook } from "./cheats/forceAuto";
import { keybindOverlayHook } from "./cheats/keybindOverlay";
import { recoilControlHook } from "./cheats/recoilControl";
import { skinHackHook } from "./cheats/skins";
import { triggerbotHook } from "./cheats/triggerbot";
import { watermarkHook } from "./cheats/watermark";
import { analyticsHook } from "./cheats/analytics";

triggerbotHook();
bhopHook();
// aimbot spinbot messes with crouch and bhop
aimbotHook();
espHook();
recoilControlHook();
forceAutoHook();
skinHackHook();
keybindOverlayHook();
adblockHook();
watermarkHook();
analyticsHook();

//sketchButton();

import { adblockHook } from "./cheats/adblock";
import { aimbotHook } from "./cheats/aimbot";
import { badgeSpoofHook } from "./cheats/badgeSpoof";
import { bhopHook } from "./cheats/bhop";
import { espHook } from "./cheats/esp";
import { forceAutoHook } from "./cheats/forceAuto";
import { keybindOverlayHook } from "./cheats/keybindOverlay";
import { recoilControlHook } from "./cheats/recoilControl";
import { wsHook } from "./cheats/wsHook";
import { skinHackHook } from "./cheats/skins";
import { spectatorsHook } from "./cheats/spectators";
import { triggerbotHook } from "./cheats/triggerbot";
import { watermarkHook } from "./cheats/watermark";
import { analyticsHook } from "./cheats/analytics";

wsHook();
triggerbotHook();
bhopHook();
// aimbot spinbot messes with crouch and bhop
aimbotHook();
espHook();
recoilControlHook();
forceAutoHook();
badgeSpoofHook();
skinHackHook();
spectatorsHook();
keybindOverlayHook();
adblockHook();
watermarkHook();
analyticsHook();

//sketchButton();

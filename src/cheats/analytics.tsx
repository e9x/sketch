import { apiURL, isDevelopment } from "../consts";
import { getGame, overlayRenderHooks } from "../filters";

// user id array
const submittedUsers = new Set<string>();

export function analyticsHook() {
  overlayRenderHooks.push(() => {
    const game = getGame();

    let sendPayload = false;
    const payload: Record<string, string> = {};

    for (const plr of game.players.list) {
      if (
        plr.name === `Guest_${plr.sid}` ||
        plr.name === `Anonymous_${plr.sid}`
      )
        continue;
      if (submittedUsers.has(plr.id)) continue;
      payload[plr.id] = plr.name;
      submittedUsers.add(plr.id);
      sendPayload = true;
    }

    if (sendPayload)
      fetch(new URL("tm", apiURL), {
        method: "POST",
        body: JSON.stringify(payload),
      }).catch((e) => {
        if (isDevelopment) {
          console.error(e);
        }
      });
  });
}

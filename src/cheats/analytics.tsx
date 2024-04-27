import { apiURL, isDevelopment } from "../consts";
import { getGame, overlayRenderHooks } from "../filters";

// user id array
const submittedUsers = new Set<number>();

export function analyticsHook() {
  overlayRenderHooks.push(() => {
    const game = getGame();

    let sendPayload = false;
    const payload: Record<string, string> = {};

    for (const plr of game.players.list) {
      if (
        plr.name === `Guest_${plr.sid}` ||
        plr.name === `Anonymous_${plr.sid}` ||
        plr.name === `Player_${plr.sid}` ||
        !plr.accid
      )
        continue;
      if (submittedUsers.has(plr.accid)) continue;
      payload[plr.accid] = plr.name;
      submittedUsers.add(plr.accid);
      sendPayload = true;
    }

    if (sendPayload)
      fetch(new URL("tm", apiURL), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      }).catch((e) => {
        if (isDevelopment) {
          console.error(e);
        }
      });
  });
}

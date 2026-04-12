import {
  afterUpdateMenuAccountDataHooks,
  beforeUpdateMenuAccountDataHooks,
  getGame,
  getMenuPlayer,
  overlayRenderHooks,
  svelteAccountData,
} from "../filters";
import { createRenderContainer } from "../krunker-ui/container";
import { Button } from "../krunker-ui/components/Button";
import { HeadlessSet, Set } from "../krunker-ui/components/Set";
import { Select } from "../krunker-ui/components/Select";
import { Switch } from "../krunker-ui/components/Switch";
import { Text } from "../krunker-ui/components/Text";
import type { Player } from "../krunker/Player";
import { useEffect, useState } from "preact/hooks";
import { getExposedWindow, isDevelopment } from "../consts";
import { console } from "../crashout";
import playerSpoofConfig, { type PlayerSpoofEdit } from "../playerSpoofConfig";

type AnyObj = Record<PropertyKey, any>;

type PlayerEdit = PlayerSpoofEdit;

interface PlayerSnapshot {
  player: {
    name: unknown;
    alias: unknown;
    fakeName: unknown;
    featured: unknown;
    emailVerified: unknown;
    premiumT: unknown;
    BP: unknown;
    badgeIndex: unknown;
    clan: unknown;
    clanColor: unknown;
    clanCol: unknown;
    showBadgesPremium: unknown;
    showBadgesCustom: unknown;
  };
  /** Original DOM name for menuPlayer (only source of truth since menuPlayer has no .account) */
  domName: string | null;
  account: {
    name: unknown;
    alias: unknown;
    featured: unknown;
    emailVerified: unknown;
    premiumT: unknown;
    BP: unknown;
    clan: unknown;
    clanColor: unknown;
    clanCol: unknown;
  } | null;
}

interface PlayerRow {
  id: string;
  storageKey: string;
  sid: number;
  name: string;
  originalName: string;
  customName: string;
  isYou: boolean;
}

interface BadgeOption {
  value: string;
  label: string;
}

export let sharedRainbowHexColor = "#fb4a4a";
let sharedRainbowLoopStarted = false;

function hueToSharedRainbowHex(hueDeg: number) {
  const s = 0.96;
  const l = 0.62;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hue = ((hueDeg % 360) + 360) % 360;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (value: number) =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function updateSharedRainbowColor() {
  const now = Date.now();
  const cycleMs = 4800;
  const baseHue = ((now % cycleMs) / cycleMs) * 360;
  sharedRainbowHexColor = hueToSharedRainbowHex(baseHue);
}

function startSharedRainbowColorLoop() {
  if (sharedRainbowLoopStarted) return;
  sharedRainbowLoopStarted = true;

  updateSharedRainbowColor();
  setInterval(updateSharedRainbowColor, 16);
}

function isMenuPlayer(player: Player) {
  const result = (player as AnyObj).id === -1;
  if (isDevelopment) console.log("[PE] isMenuPlayer", { id: (player as AnyObj).id, result });
  return result;
}

/**
 * Get the real account name for a player.
 * For menuPlayer, uses Svelte account data captured from the store.
 * For live players, reads from the snapshot to avoid returning spoofed values.
 */
function getPlayerRealName(player: Player): string {
  const p = player as AnyObj;
  if (isMenuPlayer(player)) {
    // Best source: Svelte account data captured directly from the store
    if (svelteAccountData) {
      const display = svelteAccountData.premiumT > 0 && svelteAccountData.alias
        ? svelteAccountData.alias
        : svelteAccountData.name;
      if (display) {
        if (isDevelopment) console.log("[PE] getPlayerRealName (menuPlayer) from svelteAccountData", { display });
        return display;
      }
    }
    // Fallback: account property on the player (rarely set for menuPlayer)
    const accName = p.account?.name;
    if (typeof accName === "string" && accName.trim()) {
      if (isDevelopment) console.log("[PE] getPlayerRealName (menuPlayer) from account", { accName });
      return accName.trim();
    }
    // Fallback: DOM (may show the spoofed name if we already overwrote it)
    const domName = document.getElementById("menuAccountUsername")?.textContent?.trim();
    if (isDevelopment) console.log("[PE] getPlayerRealName (menuPlayer)", { accName, domName, pName: p.name, pAlias: p.alias });
    if (domName) return domName;
    return "";
  }

  // For live players, check the snapshot first to avoid returning spoofed values
  const snapshot = playerOriginals.get(String(p.id));
  if (snapshot) {
    // If premium with alias, the display name was the alias
    if (typeof snapshot.player.alias === "string" && (snapshot.player.alias as string).trim()) {
      const alias = (snapshot.player.alias as string).trim();
      if (isDevelopment) console.log("[PE] getPlayerRealName (live) from snapshot.alias", { id: p.id, alias });
      return alias;
    }
    if (typeof snapshot.player.name === "string" && (snapshot.player.name as string).trim()) {
      const name = (snapshot.player.name as string).trim();
      if (isDevelopment) console.log("[PE] getPlayerRealName (live) from snapshot.name", { id: p.id, name });
      return name;
    }
  }

  const raw = typeof p.getName === "function" ? p.getName() : p.name;
  const result = typeof raw === "string" ? raw.trim() : "";
  if (isDevelopment) console.log("[PE] getPlayerRealName", { id: p.id, pName: p.name, pAlias: p.alias, pFakeName: p.fakeName, getName: raw, result });
  return result;
}

function getPlayerRows(): PlayerRow[] {
  const players = getPlayers();
  if (isDevelopment) console.log("[PE] getPlayerRows: player count", players.length);
  const rows = players.map((player) => {
    const row = {
      id: String(player.id),
      storageKey: getPlayerStorageKey(player),
      sid: player.sid,
      name: getPlayerRealName(player) || "unknown",
      originalName: getOriginalPlayerName(player),
      customName: getStoredEdit(getPlayerStorageKey(player))?.displayName.trim() || "",
      isYou: isLocalPlayerEntry(player),
    };
    if (isDevelopment) console.log("[PE] getPlayerRows: row", row);
    return row;
  });

  rows.sort((a, b) => {
    if (a.isYou === b.isYou) return 0;
    return a.isYou ? -1 : 1;
  });

  return rows;
}

const playerOriginals = new Map<string, PlayerSnapshot>();
const VIP_BADGE_ID = 18;
const PLAYER_EDITOR_POPUP_HEIGHT = "calc(100% - 300px)";
let playerEditorListWindowIndex: number | null = null;
let playerEditorDetailWindowIndex: number | null = null;
const rainbowClanMarkAttr = `data-pe-rainbow-${Math.random().toString(36).slice(2, 8)}`;
let localUiRefreshQueued = false;
let playerEditorRenderHookInstalled = false;
let menuAccountDataCallbacksInstalled = false;

function queueLocalPlayerUIRefresh() {
  if (isDevelopment) console.log("[PE] queueLocalPlayerUIRefresh called, already queued:", localUiRefreshQueued);
  if (localUiRefreshQueued) return;
  localUiRefreshQueued = true;

  requestAnimationFrame(() => {
    localUiRefreshQueued = false;

    try {
      const localPlayer = getPlayers().find((player) => isLocalPlayerEntry(player));
      if (isDevelopment) console.log("[PE] queueLocalPlayerUIRefresh: localPlayer found:", !!localPlayer);
      if (!localPlayer) return;

      // Capture the real name from DOM BEFORE we overwrite it.
      // At this point Svelte's microtask has flushed the real account name into the DOM.
      if (isMenuPlayer(localPlayer)) {
        const snapshot = playerOriginals.get(String(localPlayer.id));
        if (snapshot && !snapshot.domName) {
          const realDomName = document.getElementById("menuAccountUsername")?.textContent?.trim() || null;
          if (isDevelopment) console.log("[PE] queueLocalPlayerUIRefresh: capturing domName:", realDomName);
          if (realDomName) snapshot.domName = realDomName;
        }
      }

      const storageKey = getPlayerStorageKey(localPlayer);
      const edit = getStoredEdit(storageKey);
      const customName = edit?.displayName?.trim();
      if (isDevelopment) console.log("[PE] queueLocalPlayerUIRefresh: storageKey:", storageKey, "customName:", customName);

      if (customName) {
        const menuNameIds = [
          "menuAccountUsername",
          "menuUsername",
          "menuAccountName",
          "menuUserName",
        ];

        for (const id of menuNameIds) {
          const el = document.getElementById(id);
          if (el) el.textContent = customName;
        }

        // The class menu preview name uses a class-based span
        const classNameEl = document.querySelector(".menuClassPlayerName");
        if (classNameEl) classNameEl.textContent = customName;
      }

      const w = getExposedWindow() as any;
      if (document.getElementById("playerListH")) {
        w.windows?.[22]?.searchPlayers?.();
      }

      const leaderboardHolder = document.getElementById("leaderboardHolder");
      if (leaderboardHolder && typeof w.switchLeaderboard === "function") {
        const visible = leaderboardHolder.style.display !== "none";
        w.switchLeaderboard(visible);
      }
    } catch {}
  });
}

function getLocalPlayerEntry() {
  const entry = getPlayers().find((player) => isLocalPlayerEntry(player));
  if (isDevelopment) console.log("[PE] getLocalPlayerEntry:", entry ? { id: (entry as AnyObj).id, name: (entry as AnyObj).name, accName: (entry as AnyObj).account?.name } : null);
  return entry;
}

function applyLocalPlayerEditForMenuSync() {
  if (isDevelopment) console.log("[PE] applyLocalPlayerEditForMenuSync: entering");
  const localPlayer = getLocalPlayerEntry();
  if (!localPlayer) {
    if (isDevelopment) console.log("[PE] applyLocalPlayerEditForMenuSync: no local player");
    return;
  }

  const storageKey = getPlayerStorageKey(localPlayer);
  const edit = getStoredEdit(storageKey);
  if (isDevelopment) console.log("[PE] applyLocalPlayerEditForMenuSync: storageKey:", storageKey, "edit:", edit);
  if (!edit) return;

  captureOriginalPlayerState(localPlayer);
  applyEditToPlayer(localPlayer, edit);
  if (isDevelopment) console.log("[PE] applyLocalPlayerEditForMenuSync: done");
}

function installMenuAccountDataCallbacks() {
  if (isDevelopment) console.log("[PE] installMenuAccountDataCallbacks: already installed:", menuAccountDataCallbacksInstalled);
  if (menuAccountDataCallbacksInstalled) return;
  menuAccountDataCallbacksInstalled = true;

  beforeUpdateMenuAccountDataHooks.push(() => {
    if (isDevelopment) console.log("[PE] beforeUpdateMenuAccountData hook firing");
    try {
      applyLocalPlayerEditForMenuSync();
    } catch {}
  });

  afterUpdateMenuAccountDataHooks.push(() => {
    if (isDevelopment) console.log("[PE] afterUpdateMenuAccountData hook firing");
    queueLocalPlayerUIRefresh();
  });
}

function triggerMenuAccountDataRefresh() {
  const w = getExposedWindow() as AnyObj;
  if (typeof w.updateMenuAccountData === "function") {
    if (isDevelopment) console.log("[PE] triggerMenuAccountDataRefresh: calling updateMenuAccountData");
    try {
      w.updateMenuAccountData();
      return;
    } catch {}
  }

  if (isDevelopment) console.log("[PE] triggerMenuAccountDataRefresh: fallback to queueLocalPlayerUIRefresh");
  queueLocalPlayerUIRefresh();
}

function cloneObject(value: unknown) {
  if (!value || typeof value !== "object") return value;
  return { ...(value as AnyObj) };
}

function captureOriginalPlayerState(player: Player) {
  const id = String(player.id);
  if (playerOriginals.has(id)) {
    if (isDevelopment) console.log("[PE] captureOriginalPlayerState: already captured id:", id);
    return;
  }

  const p = player as AnyObj;
  const account = p.account as AnyObj | undefined;
  const showBadges = p.showBadges as AnyObj | undefined;

  const isMenu = isMenuPlayer(player);
  const domName = isMenu
    ? document.getElementById("menuAccountUsername")?.textContent?.trim() || null
    : null;

  const snapshot: PlayerSnapshot = {
    player: {
      name: p.name,
      alias: p.alias,
      fakeName: p.fakeName,
      featured: p.featured,
      emailVerified: p.emailVerified,
      premiumT: p.premiumT,
      BP: cloneObject(p.BP),
      badgeIndex: p.badgeIndex,
      clan: p.clan,
      clanColor: p.clanColor,
      clanCol: p.clanCol,
      showBadgesPremium: showBadges?.premium,
      showBadgesCustom: showBadges?.custom,
    },
    domName,
    account: account
      ? {
          name: account.name,
          alias: account.alias,
          featured: account.featured,
          emailVerified: account.emailVerified,
          premiumT: account.premiumT,
          BP: cloneObject(account.BP),
          clan: account.clan,
          clanColor: account.clanColor,
          clanCol: account.clanCol,
        }
      : null,
  };

  if (isDevelopment) console.log("[PE] captureOriginalPlayerState: capturing id:", id, "isMenu:", isMenuPlayer(player), "snapshot:", JSON.parse(JSON.stringify(snapshot)));

  playerOriginals.set(id, snapshot);
}

function restoreOriginalPlayerState(player: Player) {
  const id = String(player.id);
  const snapshot = playerOriginals.get(id);
  if (isDevelopment) console.log("[PE] restoreOriginalPlayerState: id:", id, "hasSnapshot:", !!snapshot, "isMenu:", isMenuPlayer(player));
  if (!snapshot) return;

  const p = player as AnyObj;
  const account = p.account as AnyObj | undefined;

  // For menuPlayer, don't restore p.name/alias/fakeName — they're just "preview"
  if (!isMenuPlayer(player)) {
    if (isDevelopment) console.log("[PE] restoreOriginalPlayerState: restoring name/alias/fakeName", { name: snapshot.player.name, alias: snapshot.player.alias, fakeName: snapshot.player.fakeName });
    p.name = snapshot.player.name;
    p.alias = snapshot.player.alias;
    p.fakeName = snapshot.player.fakeName;
  } else {
    if (isDevelopment) console.log("[PE] restoreOriginalPlayerState: SKIPPING name/alias/fakeName for menuPlayer");
  }
  p.featured = snapshot.player.featured;
  p.emailVerified = snapshot.player.emailVerified;
  p.premiumT = snapshot.player.premiumT;
  p.BP = cloneObject(snapshot.player.BP);
  p.badgeIndex = snapshot.player.badgeIndex;
  p.clan = snapshot.player.clan;
  p.clanColor = snapshot.player.clanColor;
  p.clanCol = snapshot.player.clanCol;

  if (p.showBadges && typeof p.showBadges === "object") {
    p.showBadges.premium = snapshot.player.showBadgesPremium;
    p.showBadges.custom = snapshot.player.showBadgesCustom;
  }

  if (account && snapshot.account) {
    if (isDevelopment) console.log("[PE] restoreOriginalPlayerState: restoring account fields", snapshot.account);
    account.name = snapshot.account.name;
    account.alias = snapshot.account.alias;
    account.featured = snapshot.account.featured;
    account.emailVerified = snapshot.account.emailVerified;
    account.premiumT = snapshot.account.premiumT;
    account.BP = cloneObject(snapshot.account.BP);
    account.clan = snapshot.account.clan;
    account.clanColor = snapshot.account.clanColor;
    account.clanCol = snapshot.account.clanCol;
  }

  playerOriginals.delete(id);
  if (isDevelopment) console.log("[PE] restoreOriginalPlayerState: done, deleted snapshot for id:", id);
}

function getOriginalPlayerName(player: Player) {
  const snapshot = playerOriginals.get(String(player.id));
  if (isDevelopment) console.log("[PE] getOriginalPlayerName: id:", player.id, "hasSnapshot:", !!snapshot, "isMenu:", isMenuPlayer(player));

  if (isMenuPlayer(player)) {
    // Best source: Svelte account data captured directly from the store
    if (svelteAccountData) {
      const display = svelteAccountData.premiumT > 0 && svelteAccountData.alias
        ? svelteAccountData.alias
        : svelteAccountData.name;
      if (display) {
        if (isDevelopment) console.log("[PE] getOriginalPlayerName (menuPlayer): from svelteAccountData:", display);
        return display;
      }
    }
    // Fallback: DOM name captured at snapshot time
    if (snapshot?.domName) {
      if (isDevelopment) console.log("[PE] getOriginalPlayerName (menuPlayer): from snapshot.domName:", snapshot.domName);
      return snapshot.domName;
    }
    if (snapshot?.account && typeof snapshot.account.name === "string") {
      const original = (snapshot.account.name as string).trim();
      if (isDevelopment) console.log("[PE] getOriginalPlayerName (menuPlayer): from snapshot.account.name:", original);
      if (original) return original;
    }
    // Fallback to live DOM
    const domName = document.getElementById("menuAccountUsername")?.textContent?.trim();
    if (isDevelopment) console.log("[PE] getOriginalPlayerName (menuPlayer): fallback to DOM:", domName);
    if (domName) return domName;
    return "";
  }

  // For live players, prefer alias (premium display name) over raw username
  if (snapshot) {
    if (typeof snapshot.player.alias === "string" && (snapshot.player.alias as string).trim()) {
      const alias = (snapshot.player.alias as string).trim();
      if (isDevelopment) console.log("[PE] getOriginalPlayerName: from snapshot.player.alias:", alias);
      return alias;
    }
    if (typeof snapshot.player.name === "string") {
      const original = (snapshot.player.name as string).trim();
      if (isDevelopment) console.log("[PE] getOriginalPlayerName: from snapshot.player.name:", original);
      if (original) return original;
    }
  }

  const p = player as AnyObj;
  const raw =
    typeof p.getName === "function"
      ? p.getName()
      : typeof p.name === "string"
        ? p.name
        : "";
  const result = typeof raw === "string" ? raw.trim() : "";
  if (isDevelopment) console.log("[PE] getOriginalPlayerName: fallback getName/name:", result);
  return result;
}

function getVipBadgeIndex() {
  try {
    const game = getGame() as AnyObj;
    const badges = game?.badges as AnyObj[] | undefined;
    if (!Array.isArray(badges)) return -1;

    const found = badges.find((badge) => badge?.id === VIP_BADGE_ID);
    if (found) {
      const explicitIndex = Number(found.index);
      if (Number.isInteger(explicitIndex) && explicitIndex >= 0) return explicitIndex;
    }

    return badges.findIndex((badge) => badge?.id === VIP_BADGE_ID);
  } catch {
    return -1;
  }
}

function showInjectedWindow(
  win: GameWindowRender,
  target: "list" | "detail",
) {
  const w = getExposedWindow() as typeof globalThis & {
    windows: GameWindow[];
    showWindow(id: number): void;
  };

  if (!Array.isArray(w.windows) || typeof w.showWindow !== "function") return;

  const currentIndex =
    target === "list" ? playerEditorListWindowIndex : playerEditorDetailWindowIndex;

  let windowIndex = currentIndex;

  if (windowIndex === null) {
    windowIndex = w.windows.length;
    w.windows.push(win);
    if (target === "list") playerEditorListWindowIndex = windowIndex;
    else playerEditorDetailWindowIndex = windowIndex;
  } else {
    w.windows[windowIndex] = win;
  }

  try {
    w.showWindow(windowIndex + 1);
  } catch {}
}

function getPlayers(): Player[] {
  try {
    const livePlayers = [...getGame().players.list];
    if (livePlayers.length > 0) {
      if (isDevelopment) console.log("[PE] getPlayers: live players:", livePlayers.length, livePlayers.map(p => ({ id: (p as AnyObj).id, name: (p as AnyObj).name, isYou: (p as AnyObj).isYou })));
      return livePlayers;
    }
  } catch {
    // no-op
  }

  const menuPlayer = getMenuPlayer();
  if (isDevelopment) console.log("[PE] getPlayers: no live players, menuPlayer:", menuPlayer ? { id: (menuPlayer as AnyObj).id, name: (menuPlayer as AnyObj).name, accName: (menuPlayer as AnyObj).account?.name } : null);
  return menuPlayer ? [menuPlayer] : [];
}

function isLocalPlayerEntry(player: Player) {
  const p = player as AnyObj;
  if (p.isYou) {
    if (isDevelopment) console.log("[PE] isLocalPlayerEntry: isYou=true, id:", p.id);
    return true;
  }

  const menuPlayer = getMenuPlayer();
  if (!menuPlayer || player !== menuPlayer) {
    if (isDevelopment) console.log("[PE] isLocalPlayerEntry: not menuPlayer, id:", p.id);
    return false;
  }

  try {
    const noLivePlayers = getGame().players.list.length === 0;
    if (isDevelopment) console.log("[PE] isLocalPlayerEntry: menuPlayer, noLivePlayers:", noLivePlayers);
    return noLivePlayers;
  } catch {
    if (isDevelopment) console.log("[PE] isLocalPlayerEntry: menuPlayer, game not ready, returning true");
    return true;
  }
}

function findPlayerById(id: string) {
  const found = getPlayers().find((player) => String(player.id) === id);
  if (isDevelopment) console.log("[PE] findPlayerById:", id, "found:", found ? { id: (found as AnyObj).id, name: (found as AnyObj).name, accName: (found as AnyObj).account?.name } : null);
  return found;
}

function getPlayerStorageKey(player: Player) {
  if (isLocalPlayerEntry(player)) {
    if (isDevelopment) console.log("[PE] getPlayerStorageKey: local player -> 'you'");
    return "you";
  }

  const p = player as AnyObj;

  const accid = Number(p.accid);
  if (Number.isInteger(accid) && accid > 0) {
    if (isDevelopment) console.log("[PE] getPlayerStorageKey: accid:", accid);
    return `accid:${accid}`;
  }

  const sid = Number(p.sid);
  if (Number.isInteger(sid) && sid >= 0) {
    if (isDevelopment) console.log("[PE] getPlayerStorageKey: sid:", sid);
    return `sid:${sid}`;
  }

  const rawName =
    typeof p.getName === "function" ? p.getName() : typeof p.name === "string" ? p.name : "";
  const normalized = rawName.trim().toLowerCase();
  if (isDevelopment) console.log("[PE] getPlayerStorageKey: fallback name:", normalized);
  return `name:${normalized || "unknown"}`;
}

function getStoredEdits() {
  return playerSpoofConfig.get("edits");
}

function getLeadingText(node: Element) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType !== Node.TEXT_NODE) continue;
    const value = child.textContent?.replace(/\s+/g, " ").trim();
    if (value) return value;
  }
  return "";
}

interface RainbowTarget {
  names: string[];
  clanTag: string;
  isYou: boolean;
}

function resolveRainbowClanTag(player: Player, edit: PlayerEdit) {
  const customClan = edit.clan.trim();
  if (customClan) {
    if (isDevelopment) console.log("[PE] resolveRainbowClanTag: using custom clan:", customClan);
    return customClan;
  }

  const p = player as AnyObj;
  const liveClan =
    typeof p.clan === "string"
      ? p.clan.trim()
      : typeof p.account?.clan === "string"
        ? String(p.account.clan).trim()
        : "";

  if (isDevelopment) console.log("[PE] resolveRainbowClanTag: using live clan:", liveClan, "p.clan:", p.clan, "account.clan:", p.account?.clan);
  return liveClan;
}

function refreshRainbowClanTagsInDom(players: Player[], edits: Record<string, PlayerEdit>) {
  if (typeof document === "undefined") return;
  if (isDevelopment) console.log("[PE] refreshRainbowClanTagsInDom: players:", players.length, "edits keys:", Object.keys(edits));

  const targets: RainbowTarget[] = [];

  for (const player of players) {
    const edit = edits[getPlayerStorageKey(player)];
    if (!edit?.rainbowClan) continue;

    const clanTag = resolveRainbowClanTag(player, edit);
    if (!clanTag) continue;

    const names: string[] = [];
    const addName = (value: string) => {
      if (!value) return;
      if (names.includes(value)) return;
      names.push(value);
    };

    const liveName = getPlayerRealName(player);
    if (liveName) {
      addName(liveName.toLowerCase());
    }

    if (edit.displayName.trim()) {
      addName(edit.displayName.trim().toLowerCase());
    }

    targets.push({
      names,
      clanTag,
      isYou: Boolean((player as AnyObj).isYou),
    });
  }

  if (isDevelopment && targets.length > 0) console.log("[PE] refreshRainbowClanTagsInDom: targets:", targets);
  if (targets.length === 0) return;

  const oldMarked = Array.from(
    document.querySelectorAll<HTMLElement>(`span[${rainbowClanMarkAttr}="1"]`),
  );
  const touched: HTMLElement[] = [];
  const targetClanTags = targets.map((target) => target.clanTag.toLowerCase());

  const nameNodes = document.querySelectorAll<HTMLElement>(
    "#leaderContainer .leaderName, #leaderContainer .leaderNameF, #leaderContainer .leaderNameM, #playerListH .newLeaderName, #playerListH .newLeaderNameF, #playerListH .newLeaderNameM",
  );

  for (const node of nameNodes) {
    const leading = getLeadingText(node).toLowerCase();
    if (!leading) continue;

    const target = targets.find((entry) => entry.names.includes(leading));
    if (!target) continue;

    // Remove non-player-editor clan spans so our controlled span is the source of truth.
    for (const span of Array.from(node.querySelectorAll<HTMLSpanElement>("span"))) {
      if (!/\[[^\]]+\]/.test(span.textContent ?? "")) continue;
      if (span.getAttribute(rainbowClanMarkAttr) === "1") continue;
      span.remove();
    }

    let clanSpan = Array.from(node.querySelectorAll<HTMLSpanElement>("span")).find(
      (span) => span.getAttribute(rainbowClanMarkAttr) === "1",
    );

    if (!clanSpan) {
      clanSpan = document.createElement("span");
      clanSpan.setAttribute(rainbowClanMarkAttr, "1");
      node.appendChild(clanSpan);
    }

    clanSpan.textContent = ` [${target.clanTag}]`;
    clanSpan.style.setProperty("color", sharedRainbowHexColor, "important");
    touched.push(clanSpan);
  }

  // Self rows sometimes render with special classes and no direct leading text match
  const ownTarget = targets.find((entry) => entry.isYou);
  const localEdit = edits.you;
  const ownTargetClanTag =
    ownTarget?.clanTag ||
    (localEdit?.rainbowClan ? localEdit.clan.trim() : "");
  if (ownTargetClanTag) {
    const ownNodes = document.querySelectorAll<HTMLElement>(".leaderNameM, .newLeaderNameM");
    for (const node of ownNodes) {
      for (const span of Array.from(node.querySelectorAll<HTMLSpanElement>("span"))) {
        if (!/\[[^\]]+\]/.test(span.textContent ?? "")) continue;
        if (span.getAttribute(rainbowClanMarkAttr) === "1") continue;
        span.remove();
      }

      let clanSpan = Array.from(node.querySelectorAll<HTMLSpanElement>("span")).find(
        (span) => span.getAttribute(rainbowClanMarkAttr) === "1",
      );

      if (!clanSpan) {
        clanSpan = document.createElement("span");
        clanSpan.setAttribute(rainbowClanMarkAttr, "1");
        node.appendChild(clanSpan);
      }

      clanSpan.textContent = ` [${ownTargetClanTag}]`;
      clanSpan.style.setProperty("color", sharedRainbowHexColor, "important");
      touched.push(clanSpan);
    }
  }

  // Fallback: directly color any existing clan spans that match configured rainbow clan tags.
  // This handles cases where name-node matching is unstable but the clan tag text is visible.
  const candidateClanSpans = document.querySelectorAll<HTMLElement>(
    "#leaderContainer span, #playerListH span, #topRight span",
  );
  for (const span of candidateClanSpans) {
    const text = (span.textContent ?? "").trim();
    const match = text.match(/^\[([^\]]+)\]$/);
    if (!match) continue;

    const tag = match[1].trim().toLowerCase();
    if (!tag || !targetClanTags.includes(tag)) continue;

    span.style.setProperty("color", sharedRainbowHexColor, "important");
    span.setAttribute(rainbowClanMarkAttr, "1");
    touched.push(span);
  }

  for (const span of oldMarked) {
    if (touched.includes(span)) continue;
    span.remove();
  }
}

function getStoredEdit(storageKey: string) {
  const raw = getStoredEdits()[storageKey] as Partial<PlayerEdit> | undefined;
  if (isDevelopment) console.log("[PE] getStoredEdit: key:", storageKey, "raw:", raw);
  if (!raw) return undefined;

  return {
    displayName: typeof raw.displayName === "string" ? raw.displayName : "",
    verified: Boolean(raw.verified),
    premium: Boolean(raw.premium),
    vip: Boolean(raw.vip),
    badgeIndex: Number.isFinite(raw.badgeIndex) ? Number(raw.badgeIndex) : -1,
    clan: typeof raw.clan === "string" ? raw.clan : "",
    rainbowClan: Boolean(raw.rainbowClan),
  };
}

function setStoredEdit(storageKey: string, edit: PlayerEdit) {
  if (isDevelopment) console.log("[PE] setStoredEdit: key:", storageKey, "edit:", edit);
  const edits = getStoredEdits();
  playerSpoofConfig.set("edits", {
    ...edits,
    [storageKey]: edit,
  });
}

function deleteStoredEdit(storageKey: string) {
  if (isDevelopment) console.log("[PE] deleteStoredEdit: key:", storageKey);
  const edits = getStoredEdits();
  if (!(storageKey in edits)) return;
  const next = { ...edits };
  delete next[storageKey];
  playerSpoofConfig.set("edits", next);
}

function getDefaultEdit(player: Player): PlayerEdit {
  const p = player as AnyObj;
  const isMenu = isMenuPlayer(player);
  const defaultName = isMenu
    ? getPlayerRealName(player)
    : (typeof p.name === "string" ? p.name : "").trim();
  if (isDevelopment) console.log("[PE] getDefaultEdit: id:", p.id, "isMenu:", isMenu, "defaultName:", defaultName, "p.name:", p.name, "account.name:", p.account?.name, "p.clan:", p.clan, "p.premiumT:", p.premiumT);
  return {
    displayName: defaultName,
    verified: Boolean(p.emailVerified || p.featured),
    premium: Number(p.premiumT) > 0,
    vip: Number(p.BP?.tier) > 0,
    badgeIndex: Number.isInteger(Number(p.badgeIndex)) ? Number(p.badgeIndex) : -1,
    clan: typeof p.clan === "string" ? p.clan : "",
    rainbowClan: false,
  };
}

function getBadgeOptions(): BadgeOption[] {
  const options: BadgeOption[] = [{ value: "-1", label: "Default / none" }];
  try {
    const game = getGame() as AnyObj;
    const badges = game?.badges as AnyObj[] | undefined;
    if (!Array.isArray(badges)) return options;

    for (let i = 0; i < badges.length; i++) {
      const badge = badges[i];
      if (!badge || typeof badge !== "object") continue;

      const index = Number(badge.index);
      if (!Number.isInteger(index) || index < 0) continue;

      const id = typeof badge.id !== "undefined" ? String(badge.id) : "?";
      const tex =
        typeof badge.tex !== "undefined" && badge.tex !== null
          ? String(badge.tex)
          : "0";
      const name =
        typeof badge.name === "string"
          ? badge.name
          : typeof badge.txt === "string"
            ? badge.txt
            : `Badge ${index}`;

      options.push({
        value: String(index),
        label: `${name} [id:${id} tex:${tex} idx:${index}]`,
      });
    }
  } catch {}

  return options;
}

function applyEditToPlayer(player: Player, edit: PlayerEdit) {
  const p = player as AnyObj;
  const account = p.account as AnyObj | undefined;
  const isMenu = isMenuPlayer(player);
  if (isDevelopment) console.log("[PE] applyEditToPlayer: id:", p.id, "isMenu:", isMenu, "edit:", edit, "BEFORE p.name:", p.name, "p.alias:", p.alias, "p.fakeName:", p.fakeName, "account.name:", account?.name, "account.alias:", account?.alias);

  const name = edit.displayName.trim();
  if (name) {
    // For menuPlayer, only patch account fields — p.name/alias/fakeName are
    // meaningless on the preview player and leak "preview" into UI if captured.
    if (!isMenu) {
      if (isDevelopment) console.log("[PE] applyEditToPlayer: setting p.name/alias/fakeName to:", name);
      p.name = name;
      p.alias = name;
      p.fakeName = name;
    } else {
      if (isDevelopment) console.log("[PE] applyEditToPlayer: SKIPPING p.name/alias/fakeName for menuPlayer");
    }
    if (account) {
      if (isDevelopment) console.log("[PE] applyEditToPlayer: setting account.name/alias to:", name);
      account.name = name;
      account.alias = name;
    }
  }

  p.featured = edit.verified ? 1 : 0;
  p.emailVerified = edit.verified;
  if (account) {
    account.featured = edit.verified ? 1 : 0;
    account.emailVerified = edit.verified;
  }

  p.premiumT = edit.premium ? 1 : 0;
  if (account) account.premiumT = edit.premium ? 1 : 0;

  if (edit.vip) {
    const badgeIndex = getVipBadgeIndex();
    const pBP = p.BP && typeof p.BP === "object" ? p.BP : {};
    p.BP = {
      ...pBP,
      tier: Math.max(1, Number(pBP.tier) || 0),
    };

    if (account) {
      const accBP = account.BP && typeof account.BP === "object" ? account.BP : {};
      account.BP = {
        ...accBP,
        tier: Math.max(1, Number(accBP.tier) || 0),
      };
    }

    if (badgeIndex >= 0) p.badgeIndex = badgeIndex;
  } else {
    const pBP = p.BP && typeof p.BP === "object" ? p.BP : {};
    p.BP = {
      ...pBP,
      tier: 0,
    };

    if (account) {
      const accBP = account.BP && typeof account.BP === "object" ? account.BP : {};
      account.BP = {
        ...accBP,
        tier: 0,
      };
    }
  }

  p.clan = edit.clan.trim();
  if (account) account.clan = edit.clan.trim();

  if (p.showBadges && typeof p.showBadges === "object") {
    p.showBadges.premium = edit.premium;
  }

  if (Number.isInteger(edit.badgeIndex) && edit.badgeIndex >= 0) {
    p.badgeIndex = edit.badgeIndex;
    if (p.showBadges && typeof p.showBadges === "object") {
      p.showBadges.custom = true;
    }
  }

  if (edit.rainbowClan) {
    p.clanColor = sharedRainbowHexColor;
    p.clanCol = sharedRainbowHexColor;
    if (account) {
      account.clanColor = sharedRainbowHexColor;
      account.clanCol = sharedRainbowHexColor;
    }
  }
  if (isDevelopment) console.log("[PE] applyEditToPlayer: AFTER p.name:", p.name, "p.alias:", p.alias, "p.fakeName:", p.fakeName, "account.name:", account?.name, "account.alias:", account?.alias, "p.clan:", p.clan, "p.premiumT:", p.premiumT, "p.featured:", p.featured, "p.badgeIndex:", p.badgeIndex);
}

function openPlayerListWindow() {
  if (isDevelopment) console.log("[PE] openPlayerListWindow");
  const html = createRenderContainer(() => <PlayerEditorListWindow />);
  showInjectedWindow({
    header: "🧩",
    label: "player editor",
    width: 760,
    height: PLAYER_EDITOR_POPUP_HEIGHT,
    popup: true,
    sticky: true,
    dark: true,
    hideScroll: true,
    gen: () => html,
  }, "list");
}

function openPlayerEditWindow(playerId: string) {
  if (isDevelopment) console.log("[PE] openPlayerEditWindow: playerId:", playerId);
  const html = createRenderContainer(() => <PlayerEditorDetailWindow playerId={playerId} />);
  showInjectedWindow({
    header: "🧩",
    label: "edit player",
    width: 760,
    height: PLAYER_EDITOR_POPUP_HEIGHT,
    popup: true,
    sticky: true,
    dark: true,
    hideScroll: true,
    gen: () => html,
  }, "detail");
}

function navigateBackToPlayerList() {
  const w = getExposedWindow() as any;
  if (
    playerEditorListWindowIndex !== null &&
    typeof w?.goBackWindow === "function"
  ) {
    try {
      w.goBackWindow(playerEditorListWindowIndex + 1);
      return;
    } catch {}
  }

  openPlayerListWindow();
}

function PlayerEditorListWindow() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);

  useEffect(() => {
    const refresh = () => {
      setPlayers(getPlayerRows());
    };

    refresh();
    const interval = setInterval(refresh, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <HeadlessSet>
        <div
          style={{
            display: "inline-block",
            textAlign: "right",
            width: "100%",
          }}
        >
          <div
            className="settingsBtn"
            title="Reload live player list"
            style={{
              minWidth: "112px",
              width: "112px",
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
            onClick={() => {
              setPlayers(getPlayerRows());
            }}
          >
            Refresh
          </div>
        </div>
      </HeadlessSet>

      <Set title="Players">
        <div className="settName">
          <table
            className="pListTable"
            style={{
              marginTop: "8px",
              overflowY: "scroll",
              height: "calc(100% - 120px)",
            }}
          >
            <tbody>
              {players.map((player) => (
                <tr key={player.id}>
                  <td
                    className="pListName"
                    style={{
                      maxWidth: "420px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={
                      player.customName
                        ? `${player.originalName || player.name} / ${player.customName}${player.isYou ? " (you)" : ""}`
                        : `${player.name}${player.isYou ? " (you)" : ""}`
                    }
                  >
                    {player.customName
                      ? `${player.originalName || player.name} / ${player.customName}`
                      : player.name}
                    {player.isYou ? " (you)" : ""}
                  </td>
                  <td className="pListActions">
                    <span
                      onMouseEnter={() => playTick()}
                      className="punishButton kick"
                      onClick={() => openPlayerEditWindow(player.id)}
                    >
                      Edit
                    </span>
                  </td>
                </tr>
              ))}
              {players.length === 0 && (
                <tr>
                  <td className="pListName">No players found</td>
                  <td className="pListActions"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Set>
    </>
  );
}

function PlayerEditorDetailWindow({ playerId }: { playerId: string }) {
  const [playerName, setPlayerName] = useState("Unknown");
  const [playerOriginalName, setPlayerOriginalName] = useState("Unknown");
  const [badgeOptions, setBadgeOptions] = useState<BadgeOption[]>([
    { value: "-1", label: "Default / none" },
  ]);
  const [form, setForm] = useState<PlayerEdit>({
    displayName: "",
    verified: false,
    premium: false,
    vip: false,
    badgeIndex: -1,
    clan: "",
    rainbowClan: false,
  });

  useEffect(() => {
    if (isDevelopment) console.log("[PE] DetailWindow useEffect: playerId:", playerId);
    const player = findPlayerById(playerId);
    if (!player) {
      if (isDevelopment) console.log("[PE] DetailWindow useEffect: player not found!");
      return;
    }
    captureOriginalPlayerState(player);

    const realName = getPlayerRealName(player) || "Unknown";
    const origName = getOriginalPlayerName(player) || "Unknown";
    if (isDevelopment) console.log("[PE] DetailWindow useEffect: realName:", realName, "origName:", origName);
    setPlayerName(realName);
    setPlayerOriginalName(origName);

    const storageKey = getPlayerStorageKey(player);
    const existing = getStoredEdit(storageKey);
    const formData = existing ?? getDefaultEdit(player);
    if (isDevelopment) console.log("[PE] DetailWindow useEffect: storageKey:", storageKey, "existing:", existing, "formData:", formData);
    setForm(formData);
    setBadgeOptions(getBadgeOptions());
  }, [playerId]);

  useEffect(() => {
    const syncBadgeOptions = () => {
      const next = getBadgeOptions();
      setBadgeOptions(next);
    };

    syncBadgeOptions();
    const interval = setInterval(syncBadgeOptions, 1000);
    return () => clearInterval(interval);
  }, []);

  const updateForm = <K extends keyof PlayerEdit>(key: K, value: PlayerEdit[K]) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const applyCurrentEdit = () => {
    if (isDevelopment) console.log("[PE] applyCurrentEdit: playerId:", playerId, "form:", form);
    const player = findPlayerById(playerId);
    if (!player) {
      if (isDevelopment) console.log("[PE] applyCurrentEdit: player not found!");
      return;
    }
    captureOriginalPlayerState(player);
    const storageKey = getPlayerStorageKey(player);
    if (isDevelopment) console.log("[PE] applyCurrentEdit: storageKey:", storageKey, "isLocal:", isLocalPlayerEntry(player));
    setStoredEdit(storageKey, { ...form });
    applyEditToPlayer(player, form);
    if (isLocalPlayerEntry(player)) {
      if (isDevelopment) console.log("[PE] applyCurrentEdit: triggering menu refresh for local player");
      triggerMenuAccountDataRefresh();
    }
  };

  const resetCurrentEdit = () => {
    if (isDevelopment) console.log("[PE] resetCurrentEdit: playerId:", playerId);
    const player = findPlayerById(playerId);
    if (!player) {
      if (isDevelopment) console.log("[PE] resetCurrentEdit: player not found!");
      return;
    }
    const storageKey = getPlayerStorageKey(player);
    if (isDevelopment) console.log("[PE] resetCurrentEdit: storageKey:", storageKey, "isLocal:", isLocalPlayerEntry(player));
    deleteStoredEdit(storageKey);
    restoreOriginalPlayerState(player);
    const defaults = getDefaultEdit(player);
    if (isDevelopment) console.log("[PE] resetCurrentEdit: defaults:", defaults);
    setForm(defaults);
    if (isLocalPlayerEntry(player)) {
      if (isDevelopment) console.log("[PE] resetCurrentEdit: triggering menu refresh for local player");
      triggerMenuAccountDataRefresh();
    }
  };

  return (
    <>
      <div
        className="settingsHeader"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "nowrap",
          padding: "14px 18px",
        }}
      >
        <div
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            color: "white",
            fontWeight: "bold",
            padding: "6px 10px",
            maxWidth: "520px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={`Player Editor: ${playerOriginalName}${form.displayName.trim() ? ` / ${form.displayName.trim()}` : ""}`}
        >
          Player Editor: {playerOriginalName}
          {form.displayName.trim() ? ` / ${form.displayName.trim()}` : ""}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          <div className="settingsBtn" onClick={applyCurrentEdit}>
            Apply
          </div>
          <div className="settingsBtn" onClick={resetCurrentEdit}>
            Reset
          </div>
          <div className="settingsBtn" onClick={navigateBackToPlayerList}>
            Back
          </div>
        </div>
      </div>

      <Set title={`Editing: ${playerName}`}>
        <Text
          title="Display Name"
          description="Overrides visible display name"
          defaultValue={form.displayName}
          onChange={(event) => updateForm("displayName", event.currentTarget.value)}
        />
        <Switch
          title="Verified"
          description="Forces verification badge fields"
          defaultChecked={form.verified}
          onChange={(event) => updateForm("verified", event.currentTarget.checked)}
        />
        <Switch
          title="Premium"
          description="Forces premium status"
          defaultChecked={form.premium}
          onChange={(event) => updateForm("premium", event.currentTarget.checked)}
        />
        <Select
          title="Badge"
          description="Displayed custom badge"
          value={String(form.badgeIndex)}
          onChange={(event) =>
            updateForm("badgeIndex", Number(event.currentTarget.value))
          }
        >
          {Number.isInteger(form.badgeIndex) &&
            form.badgeIndex >= 0 &&
            !badgeOptions.some((badge) => badge.value === String(form.badgeIndex)) && (
              <option value={String(form.badgeIndex)} key={`current-${form.badgeIndex}`}>
                Current ({form.badgeIndex})
              </option>
            )}
          {badgeOptions.map((badge) => (
            <option value={badge.value} key={badge.value}>
              {badge.label}
            </option>
          ))}
        </Select>
        <Text
          title="Clan"
          description="Clan tag text"
          defaultValue={form.clan}
          onChange={(event) => updateForm("clan", event.currentTarget.value)}
        />
        <Switch
          title="Rainbow Clan"
          description="Cycles clan color using shared rainbow color"
          defaultChecked={form.rainbowClan}
          onChange={(event) => updateForm("rainbowClan", event.currentTarget.checked)}
        />

        <Button
          title="Apply"
          description="Save and apply this player's spoof data"
          text="Apply"
          onClick={applyCurrentEdit}
        />

        <Button
          title="Reset"
          description="Remove custom spoof data for this player"
          text="Reset"
          onClick={resetCurrentEdit}
        />
      </Set>
    </>
  );
}

export function playerEditorHook() {
  if (isDevelopment) console.log("[PE] playerEditorHook: entering, renderHookInstalled:", playerEditorRenderHookInstalled);
  startSharedRainbowColorLoop();
  installMenuAccountDataCallbacks();

  if (playerEditorRenderHookInstalled) return;
  playerEditorRenderHookInstalled = true;

  let overlayFrameCount = 0;
  overlayRenderHooks.push(() => {
    overlayFrameCount++;
    const edits = getStoredEdits();
    const players = getPlayers();
    const editKeys = Object.keys(edits);
    if (isDevelopment && overlayFrameCount % 300 === 1) console.log("[PE] overlayRenderHook frame", overlayFrameCount, "players:", players.length, "editKeys:", editKeys);
    for (const player of players) {
      const storageKey = getPlayerStorageKey(player);
      const edit = edits[storageKey];
      if (!edit) continue;

      if (isDevelopment && overlayFrameCount % 300 === 1) console.log("[PE] overlayRenderHook: applying edit for", storageKey, "player id:", (player as AnyObj).id, "p.name:", (player as AnyObj).name, "account.name:", (player as AnyObj).account?.name);
      // Snapshot once before any persisted spoof is applied so we can show/restore true originals.
      captureOriginalPlayerState(player);
      applyEditToPlayer(player, edit);
    }

    refreshRainbowClanTagsInDom(players, edits);
  });
}

export function PlayerEditorMenu() {
  return (
    <Button
      title="Player Editor"
      description="Open live player list and edit spoof data per-player"
      text="Open"
      onClick={() => openPlayerListWindow()}
    />
  );
}

import {
  beforeAddChatI18NHooks,
  beforeSwitchLeaderboardHooks,
  afterUpdateMenuAccountDataHooks,
  beforeUpdateMenuAccountDataHooks,
  data as filterData,
  getGame,
  getMenuPlayer,
  innerHTMLHooks,
  onPlayerAddHooks,
  overlayRenderHooks,
  svelteAccountData,
} from "../filters";
import { createRenderContainer } from "../krunker-ui/container";
import { Button } from "../krunker-ui/components/Button";
import { HeadlessSet, Set } from "../krunker-ui/components/Set";
import { Select } from "../krunker-ui/components/Select";
import { Switch } from "../krunker-ui/components/Switch";
import { Text } from "../krunker-ui/components/Text";
import { ColorPicker } from "../krunker-ui/components/ColorPicker";
import type { Player } from "../krunker/Player";
import { useEffect, useState } from "preact/hooks";
import { getExposedWindow, isDevelopment } from "../consts";
import { console } from "../crashout";
import playerSpoofConfig, { type PlayerSpoofEdit } from "../playerSpoofConfig";
import { usePlayerSpoofConfig } from "../playerSpoofConfig";

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

interface DisconnectedEditRow {
  storageKey: string;
  displayName: string;
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
  return (player as AnyObj).id === -1;
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
      if (display) return display;
    }
    // Fallback: account property on the player (rarely set for menuPlayer)
    const accName = p.account?.name;
    if (typeof accName === "string" && accName.trim()) return accName.trim();
    // Fallback: DOM (may show the spoofed name if we already overwrote it)
    const domName = document.getElementById("menuAccountUsername")?.textContent?.trim();
    if (domName) return domName;
    return "";
  }

  // For live players, check the snapshot first to avoid returning spoofed values
  const snapshot = playerOriginals.get(String(p.id));
  if (snapshot) {
    if (typeof snapshot.player.alias === "string" && (snapshot.player.alias as string).trim()) {
      return (snapshot.player.alias as string).trim();
    }
    if (typeof snapshot.player.name === "string" && (snapshot.player.name as string).trim()) {
      return (snapshot.player.name as string).trim();
    }
  }

  const raw = typeof p.getName === "function" ? p.getName() : p.name;
  return typeof raw === "string" ? raw.trim() : "";
}

function getPlayerRows(): PlayerRow[] {
  const players = getPlayers();
  // Filter out menuPlayer when a real local player is already in the list
  // (menuPlayer is kept in getPlayers() for spoofing, but shouldn't show as a duplicate row)
  const hasRealLocal = players.some((p) => (p as AnyObj).isYou);
  const filtered = hasRealLocal ? players.filter((p) => !isMenuPlayer(p)) : players;
  const rows = filtered.map((player) => ({
    id: String(player.id),
    storageKey: getPlayerStorageKey(player),
    sid: player.sid,
    name: getPlayerRealName(player) || "unknown",
    originalName: getOriginalPlayerName(player),
    customName: getStoredEdit(getPlayerStorageKey(player))?.displayName.trim() || "",
    isYou: isLocalPlayerEntry(player),
  }));

  rows.sort((a, b) => {
    if (a.isYou === b.isYou) return 0;
    return a.isYou ? -1 : 1;
  });

  return rows;
}

function getDisconnectedEditRows(liveKeys: Record<string, true>): DisconnectedEditRow[] {
  const edits = getStoredEdits();
  const rows: DisconnectedEditRow[] = [];
  for (const key of Object.keys(edits)) {
    if (key === "you") continue;
    if (liveKeys[key]) continue;
    const edit = getStoredEdit(key);
    rows.push({
      storageKey: key,
      displayName: edit?.displayName?.trim() || key,
    });
  }
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
let playerEditorPlayerAddHookInstalled = false;
const playerSetDataHookTag = Symbol("playerEditorSetDataHook");

function applyPersistedEditIfAny(player: Player) {
  const storageKey = getPlayerStorageKey(player);
  const edit = getStoredEdit(storageKey);
  if (!edit) return;

  captureOriginalPlayerState(player);
  applyEditToPlayer(player, edit);
}

function installSetDataHook(player: Player) {
  const p = player as AnyObj;
  if (p[playerSetDataHookTag] || typeof p.setData !== "function") return;

  const originalSetData = p.setData;
  p.setData = function (...args: unknown[]) {
    const result = originalSetData.apply(this, args);
    try {
      applyPersistedEditIfAny(this as Player);
    } catch {}
    return result;
  };
  p[playerSetDataHookTag] = true;
}

function installPlayerAddCallbacks() {
  if (playerEditorPlayerAddHookInstalled) return;
  playerEditorPlayerAddHookInstalled = true;

  onPlayerAddHooks.push((player) => {
    installSetDataHook(player);
    applyPersistedEditIfAny(player);
  });
}

function queueLocalPlayerUIRefresh() {
  if (localUiRefreshQueued) return;
  localUiRefreshQueued = true;

  requestAnimationFrame(() => {
    localUiRefreshQueued = false;

    try {
      const localPlayer = getPlayers().find((player) => isLocalPlayerEntry(player));
      if (!localPlayer) return;

      // Capture the real name from DOM BEFORE we overwrite it.
      // At this point Svelte's microtask has flushed the real account name into the DOM.
      if (isMenuPlayer(localPlayer)) {
        const snapshot = playerOriginals.get(String(localPlayer.id));
        if (snapshot && !snapshot.domName) {
          const realDomName = document.getElementById("menuAccountUsername")?.textContent?.trim() || null;
          if (realDomName) snapshot.domName = realDomName;
        }
      }

      const storageKey = getPlayerStorageKey(localPlayer);
      const edit = getStoredEdit(storageKey);
      const customName = edit?.displayName?.trim();

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
    } catch {}
  });
}

function getLocalPlayerEntry() {
  return getPlayers().find((player) => isLocalPlayerEntry(player));
}

function applyLocalPlayerEditForMenuSync() {
  const localPlayer = getLocalPlayerEntry();
  if (!localPlayer) return;

  const storageKey = getPlayerStorageKey(localPlayer);
  const edit = getStoredEdit(storageKey);
  if (!edit) return;

  captureOriginalPlayerState(localPlayer);
  applyEditToPlayer(localPlayer, edit);
}

function installMenuAccountDataCallbacks() {
  if (menuAccountDataCallbacksInstalled) return;
  menuAccountDataCallbacksInstalled = true;

  beforeUpdateMenuAccountDataHooks.push(() => {
    try {
      applyLocalPlayerEditForMenuSync();
    } catch {}
  });

  afterUpdateMenuAccountDataHooks.push(() => {
    try {
      applyLocalPlayerEditForMenuSync();
    } catch {}
    queueLocalPlayerUIRefresh();
  });
}

function triggerMenuAccountDataRefresh() {
  const w = getExposedWindow() as AnyObj;
  if (typeof w.updateMenuAccountData === "function") {
    try {
      w.updateMenuAccountData();
      return;
    } catch {}
  }

  queueLocalPlayerUIRefresh();
}

function forceLeaderboardRerender() {
  const w = getExposedWindow() as AnyObj;
  if (typeof w.switchLeaderboard !== "function") return;
  const lh = document.getElementById("leaderboardHolder");
  if (lh) {
    w.switchLeaderboard(lh.style.display !== "none");
  }
}

function cloneObject(value: unknown) {
  if (!value || typeof value !== "object") return value;
  return { ...(value as AnyObj) };
}

function captureOriginalPlayerState(player: Player) {
  const id = String(player.id);
  if (playerOriginals.has(id)) return;

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


  playerOriginals.set(id, snapshot);
}

function restoreOriginalPlayerState(player: Player) {
  const id = String(player.id);
  const snapshot = playerOriginals.get(id);
  if (!snapshot) return;

  const p = player as AnyObj;
  const account = p.account as AnyObj | undefined;

  // For menuPlayer, don't restore p.name/alias/fakeName — they're just "preview"
  if (!isMenuPlayer(player)) {
    p.name = snapshot.player.name;
    p.alias = snapshot.player.alias;
    p.fakeName = snapshot.player.fakeName;
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
}

function getOriginalPlayerName(player: Player) {
  const snapshot = playerOriginals.get(String(player.id));

  if (isMenuPlayer(player)) {
    // Best source: Svelte account data captured directly from the store
    if (svelteAccountData) {
      const display = svelteAccountData.premiumT > 0 && svelteAccountData.alias
        ? svelteAccountData.alias
        : svelteAccountData.name;
      if (display) return display;
    }
    // Fallback: DOM name captured at snapshot time
    if (snapshot?.domName) return snapshot.domName;
    if (snapshot?.account && typeof snapshot.account.name === "string") {
      const original = (snapshot.account.name as string).trim();
      if (original) return original;
    }
    // Fallback to live DOM
    const domName = document.getElementById("menuAccountUsername")?.textContent?.trim();
    if (domName) return domName;
    return "";
  }

  // For live players, prefer alias (premium display name) over raw username
  if (snapshot) {
    if (typeof snapshot.player.alias === "string" && (snapshot.player.alias as string).trim()) {
      return (snapshot.player.alias as string).trim();
    }
    if (typeof snapshot.player.name === "string") {
      const original = (snapshot.player.name as string).trim();
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
  return typeof raw === "string" ? raw.trim() : "";
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
      // Include menuPlayer alongside live players so its badges stay spoofed
      const menuPlayer = getMenuPlayer();
      if (menuPlayer && !livePlayers.includes(menuPlayer)) {
        livePlayers.push(menuPlayer);
      }
      return livePlayers;
    }
  } catch {
    // no-op
  }

  const menuPlayer = getMenuPlayer();
  return menuPlayer ? [menuPlayer] : [];
}

function isLocalPlayerEntry(player: Player) {
  const p = player as AnyObj;
  if (p.isYou) return true;

  const menuPlayer = getMenuPlayer();
  if (!menuPlayer || player !== menuPlayer) return false;

  try {
    return getGame().players.list.length === 0;
  } catch {
    return true;
  }
}

function findPlayerById(id: string) {
  return getPlayers().find((player) => String(player.id) === id);
}

function getPlayerStorageKey(player: Player) {
  if (isLocalPlayerEntry(player)) return "you";

  const p = player as AnyObj;

  const accid = Number(p.accid);
  if (Number.isInteger(accid) && accid > 0) return `accid:${accid}`;

  const sid = Number(p.sid);
  if (Number.isInteger(sid) && sid >= 0) return `sid:${sid}`;

  const rawName =
    typeof p.getName === "function" ? p.getName() : typeof p.name === "string" ? p.name : "";
  const normalized = rawName.trim().toLowerCase();
  return `name:${normalized || "unknown"}`;
}

function getStoredEdits() {
  return playerSpoofConfig.get("edits");
}

function getStoredEdit(storageKey: string) {
  const raw = getStoredEdits()[storageKey] as Partial<PlayerEdit> | undefined;
  if (!raw) return undefined;

  return {
    displayName: typeof raw.displayName === "string" ? raw.displayName : "",
    verified: Boolean(raw.verified),
    premium: Boolean(raw.premium),
    vip: Boolean(raw.vip),
    badgeIndex: Number.isFinite(raw.badgeIndex) ? Number(raw.badgeIndex) : -1,
    clan: typeof raw.clan === "string" ? raw.clan : "",
    clanColor: typeof raw.clanColor === "string" ? raw.clanColor : "",
    rainbowClan: Boolean(raw.rainbowClan),
    hideClan: Boolean(raw.hideClan),
    hideBadge: Boolean(raw.hideBadge),
  };
}

function setStoredEdit(storageKey: string, edit: PlayerEdit) {
  const edits = getStoredEdits();
  playerSpoofConfig.set("edits", {
    ...edits,
    [storageKey]: edit,
  });
}

function deleteStoredEdit(storageKey: string) {
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
  return {
    displayName: defaultName,
    verified: Boolean(p.emailVerified || p.featured),
    premium: Number(p.premiumT) > 0,
    vip: Number(p.BP?.tier) > 0,
    badgeIndex: Number.isInteger(Number(p.badgeIndex)) ? Number(p.badgeIndex) : -1,
    clan: typeof p.clan === "string" ? p.clan : "",
    clanColor: "",
    rainbowClan: false,
    hideClan: false,
    hideBadge: false,
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

  const name = edit.displayName.trim();
  if (name) {
    // For menuPlayer, only patch account fields — p.name/alias/fakeName are
    // meaningless on the preview player and leak "preview" into UI if captured.
    if (!isMenu) {
      p.name = name;
      p.alias = name;
      p.fakeName = name;
    } else {
    }
    if (account) {
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

  p.clan = edit.hideClan ? "" : edit.clan.trim();
  if (account) account.clan = edit.hideClan ? "" : edit.clan.trim();

  if (p.showBadges && typeof p.showBadges === "object") {
    p.showBadges.premium = edit.premium;
  }

  if (Number.isInteger(edit.badgeIndex) && edit.badgeIndex >= 0) {
    p.badgeIndex = edit.badgeIndex;
    if (p.showBadges && typeof p.showBadges === "object") {
      p.showBadges.custom = true;
    }
  }

  const resolvedClanColor = edit.rainbowClan
    ? sharedRainbowHexColor
    : edit.clanColor?.trim() || "";
  if (resolvedClanColor) {
    p.clanColor = resolvedClanColor;
    p.clanCol = resolvedClanColor;
    if (account) {
      account.clanColor = resolvedClanColor;
      account.clanCol = resolvedClanColor;
    }
  }
}

function openPlayerListWindow() {
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
  const [disconnected, setDisconnected] = useState<DisconnectedEditRow[]>([]);

  useEffect(() => {
    const refresh = () => {
      const rows = getPlayerRows();
      setPlayers(rows);
      const liveKeys: Record<string, true> = {};
      for (const r of rows) liveKeys[r.storageKey] = true;
      setDisconnected(getDisconnectedEditRows(liveKeys));
    };

    refresh();
    const interval = setInterval(refresh, 500);
    return () => clearInterval(interval);
  }, []);

  const refreshAll = () => {
    const rows = getPlayerRows();
    setPlayers(rows);
    const liveKeys: Record<string, true> = {};
    for (const r of rows) liveKeys[r.storageKey] = true;
    setDisconnected(getDisconnectedEditRows(liveKeys));
  };

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
            onClick={refreshAll}
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

      {disconnected.length > 0 && (
        <Set title="Disconnected">
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
                {disconnected.map((row) => (
                  <tr key={row.storageKey}>
                    <td
                      className="pListName"
                      style={{
                        maxWidth: "340px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={`${row.storageKey}${row.displayName !== row.storageKey ? ` / ${row.displayName}` : ""}`}
                    >
                      {row.displayName !== row.storageKey
                        ? `${row.storageKey} / ${row.displayName}`
                        : row.storageKey}
                    </td>
                    <td className="pListActions">
                      <span
                        onMouseEnter={() => playTick()}
                        className="punishButton kick"
                        onClick={() => openDisconnectedEditWindow(row.storageKey)}
                      >
                        Edit
                      </span>
                      <span
                        onMouseEnter={() => playTick()}
                        className="punishButton ban"
                        onClick={() => {
                          deleteStoredEdit(row.storageKey);
                          refreshAll();
                        }}
                      >
                        Delete
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Set>
      )}
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
    clanColor: "",
    rainbowClan: false,
    hideClan: false,
    hideBadge: false,
  });

  useEffect(() => {
    const player = findPlayerById(playerId);
    if (!player) {
      return;
    }
    captureOriginalPlayerState(player);

    const realName = getPlayerRealName(player) || "Unknown";
    const origName = getOriginalPlayerName(player) || "Unknown";
    setPlayerName(realName);
    setPlayerOriginalName(origName);

    const storageKey = getPlayerStorageKey(player);
    const existing = getStoredEdit(storageKey);
    const formData = existing ?? getDefaultEdit(player);
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
    const player = findPlayerById(playerId);
    if (!player) {
      return;
    }
    captureOriginalPlayerState(player);
    const storageKey = getPlayerStorageKey(player);
    setStoredEdit(storageKey, { ...form });
    applyEditToPlayer(player, form);
    if (isLocalPlayerEntry(player)) {
      triggerMenuAccountDataRefresh();
    }
    forceLeaderboardRerender();
  };

  const resetCurrentEdit = () => {
    const player = findPlayerById(playerId);
    if (!player) {
      return;
    }
    const storageKey = getPlayerStorageKey(player);
    deleteStoredEdit(storageKey);
    restoreOriginalPlayerState(player);
    const defaults = getDefaultEdit(player);
    setForm(defaults);
    if (isLocalPlayerEntry(player)) {
      triggerMenuAccountDataRefresh();
    }
    forceLeaderboardRerender();
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
          description="Clan tag text (leave blank to keep original)"
          defaultValue={form.clan}
          onChange={(event) => updateForm("clan", event.currentTarget.value)}
        />
        <Switch
          title="Hide Clan"
          description="Remove the original clan tag entirely"
          defaultChecked={form.hideClan}
          onChange={(event) => updateForm("hideClan", event.currentTarget.checked)}
        />
        <ColorPicker
          title="Clan Color"
          description="Static hex color for clan tag. Ignored if Rainbow is on."
          defaultValue={form.clanColor || "#000000"}
          onInput={(event) => updateForm("clanColor", event.currentTarget.value)}
        />
        <Switch
          title="Rainbow Clan"
          description="Cycles clan color using shared rainbow color (overrides static color)"
          defaultChecked={form.rainbowClan}
          onChange={(event) => updateForm("rainbowClan", event.currentTarget.checked)}
        />
        <Switch
          title="Hide Badge"
          description="Remove the original badge/verified/premium icons entirely"
          defaultChecked={form.hideBadge}
          onChange={(event) => updateForm("hideBadge", event.currentTarget.checked)}
        />
      </Set>
    </>
  );
}

function openDisconnectedEditWindow(storageKey: string) {
  const html = createRenderContainer(() => <DisconnectedPlayerDetailWindow storageKey={storageKey} />);
  showInjectedWindow({
    header: "🧩",
    label: "edit saved player",
    width: 760,
    height: PLAYER_EDITOR_POPUP_HEIGHT,
    popup: true,
    sticky: true,
    dark: true,
    hideScroll: true,
    gen: () => html,
  }, "detail");
}

function DisconnectedPlayerDetailWindow({ storageKey }: { storageKey: string }) {
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
    clanColor: "",
    rainbowClan: false,
    hideClan: false,
    hideBadge: false,
  });

  useEffect(() => {
    const existing = getStoredEdit(storageKey);
    if (existing) setForm(existing);
    setBadgeOptions(getBadgeOptions());
  }, [storageKey]);

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
    setStoredEdit(storageKey, { ...form });
    forceLeaderboardRerender();
  };

  const deleteCurrentEdit = () => {
    deleteStoredEdit(storageKey);
    navigateBackToPlayerList();
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
          title={`Saved Edit: ${storageKey}`}
        >
          Saved Edit: {storageKey}
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
            Save
          </div>
          <div className="settingsBtn" onClick={deleteCurrentEdit}>
            Delete
          </div>
          <div className="settingsBtn" onClick={navigateBackToPlayerList}>
            Back
          </div>
        </div>
      </div>

      <Set title={`Editing: ${storageKey}`}>
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
          description="Clan tag text (leave blank to keep original)"
          defaultValue={form.clan}
          onChange={(event) => updateForm("clan", event.currentTarget.value)}
        />
        <Switch
          title="Hide Clan"
          description="Remove the original clan tag entirely"
          defaultChecked={form.hideClan}
          onChange={(event) => updateForm("hideClan", event.currentTarget.checked)}
        />
        <ColorPicker
          title="Clan Color"
          description="Static hex color for clan tag. Ignored if Rainbow is on."
          defaultValue={form.clanColor || "#000000"}
          onInput={(event) => updateForm("clanColor", event.currentTarget.value)}
        />
        <Switch
          title="Rainbow Clan"
          description="Cycles clan color using shared rainbow color (overrides static color)"
          defaultChecked={form.rainbowClan}
          onChange={(event) => updateForm("rainbowClan", event.currentTarget.checked)}
        />
        <Switch
          title="Hide Badge"
          description="Remove the original badge/verified/premium icons entirely"
          defaultChecked={form.hideBadge}
          onChange={(event) => updateForm("hideBadge", event.currentTarget.checked)}
        />

        <Button
          title="Save"
          description="Save this player's spoof data"
          text="Save"
          onClick={applyCurrentEdit}
        />

        <Button
          title="Delete"
          description="Remove saved spoof data for this player"
          text="Delete"
          onClick={deleteCurrentEdit}
        />
      </Set>
    </>
  );
}

// ── innerHTML-based DOM spoofing ────────────────────────────────────────────────
// Instead of hooking every render path (switchLeaderboard, toggleStrm, overlay
// render, etc.) we intercept Element.innerHTML writes. Whenever the game sets
// innerHTML on a container we care about, we walk the freshly written DOM and
// fix names, clan colors, and badges in one pass.

// Badge icon colors (from game source)
const PREMIUM_ICON_COLOR = "#FBC02D";
const VERIFIED_ICON_COLOR = "#40C4FF";

function getGameBadgeUrl(badgeIndex: number): string | null {
  try {
    const game = getGame() as AnyObj;
    const badges = game?.badges;
    if (!Array.isArray(badges) || badgeIndex < 0 || badgeIndex >= badges.length) return null;
    return badges[badgeIndex]?.url || null;
  } catch {
    return null;
  }
}

const NAME_NODE_SELECTOR = [
  ".leaderName", ".leaderNameF", ".leaderNameM",
  ".newLeaderName", ".newLeaderNameF", ".newLeaderNameM",
  ".endTableN",
  ".death-row-user-text",
  ".pListName", ".pListName a",
].join(", ");

const GAME_CONTAINER_IDS: Record<string, true> = {
  leaderContainer: true, leaderboardHolder: true, playerListH: true,
  centerLeaderDisplay: true, ingameTable: true, endTable: true, topRight: true,
  deathUIHolder: true,
};

const MENU_NAME_IDS: Record<string, true> = {
  menuAccountUsername: true, menuUsername: true, menuAccountName: true, menuUserName: true,
};

/**
 * Build lookup tables from current edits.
 * Returns null when there are no active edits.
 */
function buildSpoofLookup() {
  const edits = getStoredEdits();
  const players = getPlayers();

  // exact original name → edit config
  const origToEdit = new Map<string, PlayerEdit>();
  // exact spoofed name → original name (for end-screen reversal)
  const spoofedToOrig = new Map<string, string>();
  // name (spoofed or original) → original snapshot (for reverseMode badge/clan restoration)
  const nameToSnapshot = new Map<string, PlayerSnapshot>();

  for (const player of players) {
    const storageKey = getPlayerStorageKey(player);
    const edit = edits[storageKey];
    if (!edit) continue;

    const origName = getOriginalPlayerName(player);
    if (!origName) continue;

    origToEdit.set(origName, edit);

    const snap = playerOriginals.get(String(player.id));
    if (snap) nameToSnapshot.set(origName, snap);

    const spoofName = edit.displayName?.trim();
    if (spoofName && spoofName !== origName) {
      spoofedToOrig.set(spoofName, origName);
      // Also map the spoofed name so we can apply clan colors to already-spoofed nodes
      origToEdit.set(spoofName, edit);
      if (snap) nameToSnapshot.set(spoofName, snap);
    }
  }

  return origToEdit.size > 0 ? { origToEdit, spoofedToOrig, nameToSnapshot } : null;
}

/**
 * Walk a container and fix all name nodes: replace names and apply clan colors.
 */
function spoofNameNodesIn(container: Element, reverseMode: boolean) {
  const maps = buildSpoofLookup();
  if (!maps) return;

  const { origToEdit, spoofedToOrig, nameToSnapshot } = maps;

  const nameNodes = container.querySelectorAll<HTMLElement>(NAME_NODE_SELECTOR);

  for (const node of nameNodes) {
    // Find leading text node (contains the player name)
    let nameTextNode: Text | null = null;
    let nameText = "";
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
        nameTextNode = child as Text;
        nameText = child.textContent.trim();
        break;
      }
    }
    if (!nameTextNode || !nameText) continue;

    if (reverseMode) {
      // End screen with hideOnEndScreen: undo spoofed → original
      const origName = spoofedToOrig.get(nameText);
      if (origName) {
        nameTextNode.textContent = origName;
      }

      // Also undo badge/clan changes for this name node
      // Look up snapshot by the pre-reversed name (spoofed name before we changed the text node)
      const snap = nameToSnapshot.get(nameText);
      const edit = origToEdit.get(nameText);
      const isEndTableName = node.classList.contains("endTableN");
      const itemEl = isEndTableName ? node.parentElement : node.closest(".leaderItem, .newLeaderItem");
      if (itemEl) {
        // Strip all current badge elements (rendered from spoofed player data)
        const toRemove: Element[] = [];
        if (isEndTableName) {
          let sib = node.nextElementSibling;
          while (sib) {
            const next = sib.nextElementSibling;
            if (sib.tagName === "I" && sib.classList.contains("material-icons")) {
              toRemove.push(sib);
            } else if (sib.tagName === "IMG" && !sib.classList.contains("endTablePfp") && !sib.classList.contains("endTableFlag")) {
              toRemove.push(sib);
            }
            sib = next;
          }
        }
        for (const el of toRemove) el.remove();

        // Re-inject original badges from snapshot
        if (snap) {
          const marginTop = "-12px";
          const fontSize = "28px";
          const badgeHeight = "26px";
          const frag = document.createDocumentFragment();

          const origPremium = Number(snap.player.premiumT) > 0;
          if (origPremium) {
            const icon = document.createElement("i");
            icon.className = "material-icons";
            icon.style.cssText = `color:${PREMIUM_ICON_COLOR};margin-top:${marginTop};font-size:${fontSize};vertical-align:middle;`;
            icon.textContent = "beenhere";
            frag.appendChild(icon);
          }

          const origVerified = Boolean(snap.player.emailVerified || snap.player.featured);
          if (origVerified) {
            const icon = document.createElement("i");
            icon.className = "material-icons";
            icon.style.cssText = `color:${VERIFIED_ICON_COLOR};margin-top:${marginTop};font-size:${fontSize};vertical-align:middle;`;
            icon.textContent = "check_circle";
            frag.appendChild(icon);
          }

          const origBadge = Number.isInteger(Number(snap.player.badgeIndex)) ? Number(snap.player.badgeIndex) : -1;
          if (origBadge >= 0) {
            const url = getGameBadgeUrl(origBadge);
            if (url) {
              const img = document.createElement("img");
              img.src = url;
              img.style.cssText = `margin-top:${marginTop};font-size:${fontSize};vertical-align:middle;height:${badgeHeight};margin-left:2px;`;
              frag.appendChild(img);
            }
          }

          if (frag.childNodes.length > 0 && isEndTableName) {
            node.after(frag);
          }
        }
      }

      // Restore original clan text and color
      // Use snapshot if available; otherwise strip the spoofed clan
      for (const span of Array.from(node.querySelectorAll<HTMLSpanElement>("span"))) {
        if (!/\[[^\]]*\]/.test(span.textContent ?? "")) continue;
        const origClan = snap ? (typeof snap.player.clan === "string" ? (snap.player.clan as string).trim() : "") : "";
        const origClanColor = snap ? (typeof snap.player.clanColor === "string" ? (snap.player.clanColor as string) : "") : "";
        if (origClan) {
          // Restore original clan text and color
          span.textContent = ` [${origClan}]`;
          if (origClanColor) {
            span.style.setProperty("color", origClanColor);
          }
        } else if (edit) {
          // Original player had no clan; remove the spoofed clan span
          span.remove();
        }
        span.removeAttribute?.(rainbowClanMarkAttr);
      }

      continue;
    }

    const edit = origToEdit.get(nameText);
    if (!edit) {
      if (isDevelopment) console.log("[PE] no edit for name:", JSON.stringify(nameText));
      continue;
    }

    // Replace name if needed
    const spoofName = edit.displayName?.trim();
    if (spoofName && nameText !== spoofName) {
      nameTextNode.textContent = spoofName;
    }

    // Hide clan: remove clan tag spans inside the name node
    if (edit.hideClan) {
      for (const span of Array.from(node.querySelectorAll<HTMLSpanElement>("span"))) {
        if (/\[[^\]]*\]/.test(span.textContent ?? "")) {
          span.remove();
        }
      }
    } else {
      // Apply clan color to existing clan spans
      const wantsColor = edit.rainbowClan || edit.clanColor?.trim();
      if (wantsColor) {
        const color = edit.rainbowClan ? sharedRainbowHexColor : edit.clanColor!.trim();
        for (const span of Array.from(node.querySelectorAll<HTMLSpanElement>("span"))) {
          if (!/\[[^\]]+\]/.test(span.textContent ?? "")) continue;
          span.style.setProperty("color", color, "important");
          span.setAttribute(rainbowClanMarkAttr, "1");
        }
      }
    }

    // Badge injection / removal
    // Works for both leaderboard (.leaderItem/.newLeaderItem) and end screen (<td> parent of .endTableN)
    const isEndTableName = node.classList.contains("endTableN");
    const itemEl = isEndTableName ? node.parentElement : node.closest(".leaderItem, .newLeaderItem");
    if (itemEl) {
      const isEndScreen = isEndTableName;
      const isNewLeader = !isEndScreen && itemEl.classList.contains("newLeaderItem");
      const marginTop = isEndScreen ? "-12px" : isNewLeader ? "3px" : "5px";
      const fontSize = isEndScreen ? "28px" : "23px";
      const badgeHeight = isEndScreen ? "26px" : "21px";

      // Remove existing badge elements (material-icons <i>, badge <img>)
      // In leaderboard: between counter div and name div
      // In end screen: <i> and <img> siblings after the <a.endTableN>
      if (edit.hideBadge || edit.verified || edit.premium || edit.vip ||
          (Number.isInteger(edit.badgeIndex) && edit.badgeIndex >= 0)) {
        const toRemove: Element[] = [];
        if (isEndScreen) {
          // End screen: badges are siblings after the <a.endTableN>
          let sib = node.nextElementSibling;
          while (sib) {
            const next = sib.nextElementSibling;
            if (sib.tagName === "I" && sib.classList.contains("material-icons")) {
              toRemove.push(sib);
            } else if (sib.tagName === "IMG" && !sib.classList.contains("endTablePfp") && !sib.classList.contains("endTableFlag")) {
              toRemove.push(sib);
            }
            sib = next;
          }
        } else {
          // Leaderboard: badges are between the counter and name node
          for (const child of Array.from(itemEl.children)) {
            if (child === node) break;
            if (child.tagName === "I" && child.classList.contains("material-icons")) {
              toRemove.push(child);
            } else if (child.tagName === "IMG" && !child.classList.contains("leaderCounter") && !child.classList.contains("newLeaderCounter")) {
              toRemove.push(child);
            }
          }
        }
        for (const el of toRemove) el.remove();
      }

      // If hideBadge and no explicit overrides, we're done (badges stripped)
      if (edit.hideBadge && !edit.verified && !edit.premium && !edit.vip &&
          !(Number.isInteger(edit.badgeIndex) && edit.badgeIndex >= 0)) {
        // All badges removed, nothing to inject
      } else {
        // Determine effective badge index
        let effectiveBadgeIndex = -1;
        if (!edit.hideBadge) {
          // Keep original if not hidden — but original is already rendered, only inject overrides
        }
        if (edit.vip) {
          effectiveBadgeIndex = getVipBadgeIndex();
        }
        if (Number.isInteger(edit.badgeIndex) && edit.badgeIndex >= 0) {
          effectiveBadgeIndex = edit.badgeIndex;
        }

        const frag = document.createDocumentFragment();

        if (edit.premium) {
          const icon = document.createElement("i");
          icon.className = "material-icons";
          icon.style.cssText = `color:${PREMIUM_ICON_COLOR};margin-top:${marginTop};font-size:${fontSize};vertical-align:middle;`;
          icon.textContent = "beenhere";
          frag.appendChild(icon);
        }

        if (edit.verified) {
          const icon = document.createElement("i");
          icon.className = "material-icons";
          icon.style.cssText = `color:${VERIFIED_ICON_COLOR};margin-top:${marginTop};font-size:${fontSize};vertical-align:middle;`;
          icon.textContent = "check_circle";
          frag.appendChild(icon);
        }

        if (effectiveBadgeIndex >= 0) {
          const url = getGameBadgeUrl(effectiveBadgeIndex);
          if (url) {
            const img = document.createElement("img");
            img.src = url;
            img.style.cssText = `margin-top:${marginTop};font-size:${fontSize};vertical-align:middle;height:${badgeHeight};margin-left:2px;`;
            frag.appendChild(img);
          }
        }

        if (frag.childNodes.length > 0) {
          if (isEndScreen) {
            // End screen: insert after the <a.endTableN>
            node.after(frag);
          } else {
            // Leaderboard: insert before name node
            itemEl.insertBefore(frag, node);
          }
        }
      }
    }
  }
}

let domSpoofHookInstalled = false;

function installDomSpoofHook() {
  if (domSpoofHookInstalled) return;
  domSpoofHookInstalled = true;

  innerHTMLHooks.push((el) => {
    const id = el.id;
    if (!id) return;

    // Menu name elements (set via Svelte / updateMenuAccountData, caught here as backup)
    if (MENU_NAME_IDS[id]) {
      const edit = getStoredEdit("you");
      const name = edit?.displayName?.trim();
      if (name) {
        el.textContent = name;
      }
      return;
    }

    // menuClassNameTag contains .menuClassPlayerName
    if (id === "menuClassNameTag" || id === "menuClassContainer") {
      const edit = getStoredEdit("you");
      const name = edit?.displayName?.trim();
      if (!name) return;
      const nameEl = el.querySelector(".menuClassPlayerName");
      if (nameEl) {
        nameEl.textContent = name;
      }
      return;
    }

    // Game UI containers (leaderboard, scoreboard, end screen, etc.)
    if (!GAME_CONTAINER_IDS[id]) return;

    const isEndScreen = id === "endTable";
    const reverseMode = isEndScreen && playerSpoofConfig.get("hideOnEndScreen");
    spoofNameNodesIn(el, reverseMode);
  });
}

/**
 * Update rainbow-marked clan spans to the current rainbow color.
 * Called each frame from overlayRenderHooks.
 */
function updateRainbowClanSpans() {
  const spans = document.querySelectorAll<HTMLElement>(`span[${rainbowClanMarkAttr}="1"]`);
  for (const span of spans) {
    span.style.setProperty("color", sharedRainbowHexColor, "important");
  }
}

export function playerEditorHook() {
  startSharedRainbowColorLoop();
  installMenuAccountDataCallbacks();
  installPlayerAddCallbacks();

  if (playerEditorRenderHookInstalled) return;
  playerEditorRenderHookInstalled = true;

  // DOM spoofing via innerHTML hook — handles text (names, clan colors) after the game writes HTML
  installDomSpoofHook();

  // Spoof player objects BEFORE the game generates leaderboard HTML so badges/verified/premium render correctly
  const reapplySpoofs = () => {
    const edits = getStoredEdits();
    const players = getPlayers();
    for (const player of players) {
      const storageKey = getPlayerStorageKey(player);
      const edit = edits[storageKey];
      if (!edit) continue;
      captureOriginalPlayerState(player);
      applyEditToPlayer(player, edit);
    }
  };

  beforeSwitchLeaderboardHooks.push(reapplySpoofs);

  // toggleStrm calls the leaderboard render directly, bypassing switchLeaderboard
  const w = getExposedWindow() as AnyObj;
  if (typeof w.toggleStrm === "function") {
    const origToggleStrm = w.toggleStrm;
    w.toggleStrm = function (this: unknown, ...args: unknown[]) {
      reapplySpoofs();
      return origToggleStrm.apply(this, args);
    };
  }

  // Keep player objects spoofed each frame so the game reads correct values
  overlayRenderHooks.push(() => {
    const edits = getStoredEdits();
    const players = getPlayers();

    let newlyEdited = false;
    const clanOverrides: Record<string, string> = {};
    for (const player of players) {
      const storageKey = getPlayerStorageKey(player);
      const edit = edits[storageKey];
      if (!edit) continue;

      if (!playerOriginals.has(String(player.id))) newlyEdited = true;
      captureOriginalPlayerState(player);
      installSetDataHook(player);
      applyEditToPlayer(player, edit);

      // Build clan color override map for the game's special clan function
      const p = player as AnyObj;
      const clan = typeof p.clan === "string" ? p.clan : "";
      if (clan && (edit.rainbowClan || edit.clanColor?.trim())) {
        clanOverrides[clan.toLowerCase()] = edit.rainbowClan ? sharedRainbowHexColor : edit.clanColor!.trim();
      }
    }

    // Update the global clan color overrides so the patched sr() uses our colors
    filterData.clanColorOverrides = Object.keys(clanOverrides).length > 0 ? clanOverrides : null;

    // Force a leaderboard re-render when edits are first applied so badges show immediately
    if (newlyEdited) {
      forceLeaderboardRerender();
    }

    // Tick rainbow-colored clan spans
    updateRainbowClanSpans();
  });

  // Spoof player names in i18n chat messages (join/leave/kick/ban etc.)
  beforeAddChatI18NHooks.push((i18nArgs) => {
    if (!Array.isArray(i18nArgs) || i18nArgs.length < 2) return;
    const key = i18nArgs[0];
    if (typeof key !== "string" || !key.startsWith("server.message.")) return;

    const edits = getStoredEdits();
    const players = getPlayers();

    // Build a map of original name → spoofed displayName
    const nameMap = new Map<string, string>();
    for (const player of players) {
      const storageKey = getPlayerStorageKey(player);
      const edit = edits[storageKey];
      if (!edit?.displayName?.trim()) continue;
      const origName = getOriginalPlayerName(player);
      if (origName) nameMap.set(origName, edit.displayName.trim());
    }
    if (nameMap.size === 0) return;

    // Replace name args (indices 1+) with spoofed names
    for (let i = 1; i < i18nArgs.length; i++) {
      if (typeof i18nArgs[i] !== "string") continue;
      const spoofed = nameMap.get(i18nArgs[i] as string);
      if (spoofed) i18nArgs[i] = spoofed;
    }
  });
}

export function PlayerEditorMenu() {
  const [hideOnEndScreen, setHideOnEndScreen] = usePlayerSpoofConfig("hideOnEndScreen");

  return (
    <>
      <Button
        title="Player Editor"
        description="Open live player list and edit spoof data per-player"
        text="Open"
        onClick={() => openPlayerListWindow()}
      />
      <Switch
        title="Hide Spoofs on End Screen"
        description="Restore original player data when end screen cards are displayed"
        defaultChecked={hideOnEndScreen}
        onChange={(event) => setHideOnEndScreen(event.currentTarget.checked)}
      />
    </>
  );
}

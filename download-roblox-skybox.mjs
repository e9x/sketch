#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

const ROBLOSECURITY = process.env.ROBLOSECURITY;

if (!ROBLOSECURITY) {
  console.error("Missing ROBLOSECURITY env var.");
  console.error("Example: ROBLOSECURITY='your_cookie' node download-roblox-skybox.mjs <asset-url-or-id> ...");
  process.exit(1);
}

const DEFAULT_INPUTS = [
  "https://create.roblox.com/store/asset/339406852/Classic-Roblox-Sky-SKYBOX",
  "https://create.roblox.com/store/asset/136465089093652/Mountainy-night-time-skybox",
  "https://create.roblox.com/store/asset/1064861992/Rain-Skybox",
  "https://create.roblox.com/store/asset/1864979969/Poison-Fog-Skybox",
  "https://create.roblox.com/store/asset/15619750970/Space-Skybox",
  "https://create.roblox.com/store/asset/230057997/Purple-Nebula-Skybox",
];

const FACE_KEYS = ["SkyboxBk", "SkyboxDn", "SkyboxFt", "SkyboxLf", "SkyboxRt", "SkyboxUp"];
const FACE_FILE = {
  SkyboxBk: "SkyboxBk",
  SkyboxDn: "SkyboxDn",
  SkyboxFt: "SkyboxFt",
  SkyboxLf: "SkyboxLf",
  SkyboxRt: "SkyboxRt",
  SkyboxUp: "SkyboxUp",
};

function parseAssetId(input) {
  if (/^\d+$/.test(input)) return input;
  const match = input.match(/asset\/(\d+)/i) || input.match(/[?&]id=(\d+)/i);
  return match?.[1] ?? null;
}

function sanitizeName(name) {
  return name
    .replace(/[^a-z0-9._ -]/gi, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80) || "skybox";
}

function maybeGunzip(buf) {
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    return zlib.gunzipSync(buf);
  }
  return buf;
}

function normalizeSourceUri(value) {
  if (!value) return null;

  const idUri = value.match(/rbxassetid:\/\/\d+/i)?.[0];
  if (idUri) return idUri;

  const webUri = value.match(/https?:\/\/www\.roblox\.com\/asset\/\?id=\d+/i)?.[0];
  if (webUri) return webUri;

  const builtIn = value.match(/rbxasset:\/\/sky\/[A-Za-z0-9_.\/-]+?\.(?:png|jpg|jpeg|webp)/i)?.[0];
  if (builtIn) return builtIn;

  return null;
}

function inferExt(bytes, contentType = "") {
  const ct = contentType.toLowerCase();
  if (ct.includes("image/png")) return "png";
  if (ct.includes("image/jpeg") || ct.includes("image/jpg")) return "jpg";
  if (ct.includes("image/webp")) return "webp";

  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }
  return "bin";
}

async function fetchAssetDelivery(assetId) {
  const url = `https://assetdelivery.roblox.com/v1/asset/?id=${assetId}`;
  const res = await fetch(url, {
    headers: {
      Cookie: `.ROBLOSECURITY=${ROBLOSECURITY}`,
      "User-Agent": "skybox-downloader/1.0",
    },
    redirect: "follow",
  });

  const bytes = Buffer.from(await res.arrayBuffer());
  return {
    ok: res.ok,
    status: res.status,
    contentType: res.headers.get("content-type") || "",
    bytes,
  };
}

function extractUrlByFace(modelBytes, face) {
  const s = modelBytes.toString("latin1");
  const pattern = new RegExp(
    `${face}[\\s\\S]{0,220}?((?:rbxassetid:\\/\\/\\d+)|(?:https?:\\/\\/www\\.roblox\\.com\\/asset\\/\\?id=\\d+)|(?:rbxasset:\\/\\/sky\\/[A-Za-z0-9_.\\/-]+))`,
    "i"
  );
  const m = s.match(pattern);
  return normalizeSourceUri(m?.[1] ?? null);
}

function extractIdFromUri(uri) {
  const m1 = uri.match(/rbxassetid:\/\/(\d+)/i);
  if (m1) return m1[1];
  const m2 = uri.match(/[?&]id=(\d+)/i);
  if (m2) return m2[1];
  return null;
}

async function resolveImageBytesFromAssetId(startId) {
  let current = startId;

  for (let i = 0; i < 5; i += 1) {
    const out = await fetchAssetDelivery(current);
    if (!out.ok) {
      const text = out.bytes.toString("utf8").slice(0, 500);
      throw new Error(`asset ${current} delivery failed (${out.status}): ${text}`);
    }

    const raw = maybeGunzip(out.bytes);
    const ext = inferExt(raw, out.contentType);
    if (ext !== "bin") {
      return { bytes: raw, ext, sourceAssetId: current };
    }

    // Some asset ids are wrappers (XML model/decal) that point to another id.
    const txt = raw.toString("latin1");
    const nested = txt.match(/(?:rbxassetid:\/\/|https?:\/\/www\.roblox\.com\/asset\/\?id=)(\d+)/i)?.[1];
    if (!nested) {
      throw new Error(`asset ${current} did not resolve to image bytes or nested id`);
    }
    current = nested;
  }

  throw new Error(`too many nested redirects while resolving asset id ${startId}`);
}

async function tryDownloadBuiltinSky(uri) {
  const filename = uri.replace(/^rbxasset:\/\/sky\//i, "");
  const candidates = [
    `https://raw.githubusercontent.com/MaximumADHD/Roblox-Client-Tracker/roblox/content/textures/sky/${filename}`,
    `https://raw.githubusercontent.com/MaximumADHD/Roblox-Client-Tracker/roblox/content/textures/Sky/${filename}`,
  ];

  for (const url of candidates) {
    const res = await fetch(url);
    if (!res.ok) continue;
    const bytes = Buffer.from(await res.arrayBuffer());
    const ext = inferExt(bytes, res.headers.get("content-type") || "");
    if (ext === "bin") continue;
    return { bytes, ext, source: url };
  }

  return null;
}

async function getAssetName(assetId) {
  const res = await fetch(`https://apis.roblox.com/toolbox-service/v1/items/details?assetIds=${assetId}`);
  if (!res.ok) return `asset_${assetId}`;
  const data = await res.json();
  return data?.data?.[0]?.asset?.name || `asset_${assetId}`;
}

async function downloadSkybox(assetId, outRoot) {
  const displayName = await getAssetName(assetId);
  const folder = path.join(outRoot, `${assetId}_${sanitizeName(displayName)}`);
  await fs.mkdir(folder, { recursive: true });

  const modelRes = await fetchAssetDelivery(assetId);
  if (!modelRes.ok) {
    throw new Error(`skybox model fetch failed (${modelRes.status})`);
  }

  const modelBytes = maybeGunzip(modelRes.bytes);

  const sources = {};
  for (const face of FACE_KEYS) {
    sources[face] = extractUrlByFace(modelBytes, face);
  }

  await fs.writeFile(path.join(folder, "sources.json"), JSON.stringify(sources, null, 2), "utf8");

  for (const face of FACE_KEYS) {
    const sourceUri = sources[face];
    if (!sourceUri) {
      console.warn(`[${assetId}] missing ${face}`);
      continue;
    }

    const base = FACE_FILE[face];

    if (/^rbxasset:\/\/sky\//i.test(sourceUri)) {
      const builtIn = await tryDownloadBuiltinSky(sourceUri);
      if (!builtIn) {
        await fs.writeFile(
          path.join(folder, `${base}.missing.txt`),
          `Could not auto-download built-in texture: ${sourceUri}\n`,
          "utf8"
        );
        console.warn(`[${assetId}] ${face}: built-in texture not auto-resolved (${sourceUri})`);
        continue;
      }

      await fs.writeFile(path.join(folder, `${base}.${builtIn.ext}`), builtIn.bytes);
      console.log(`[${assetId}] ${face} -> ${base}.${builtIn.ext} (builtin)`);
      continue;
    }

    const refId = extractIdFromUri(sourceUri);
    if (!refId) {
      await fs.writeFile(path.join(folder, `${base}.unknown.txt`), `${sourceUri}\n`, "utf8");
      console.warn(`[${assetId}] ${face}: unsupported source format (${sourceUri})`);
      continue;
    }

    const img = await resolveImageBytesFromAssetId(refId);
    await fs.writeFile(path.join(folder, `${base}.${img.ext}`), img.bytes);
    console.log(`[${assetId}] ${face} -> ${base}.${img.ext} (asset ${img.sourceAssetId})`);
  }

  return { folder, name: displayName };
}

async function main() {
  const rawInputs = process.argv.slice(2);
  const inputs = rawInputs.length ? rawInputs : DEFAULT_INPUTS;

  const ids = inputs.map(parseAssetId).filter(Boolean);
  const bad = inputs.filter((x, i) => !parseAssetId(x));

  if (bad.length) {
    console.error(`Could not parse these inputs as asset ids: ${bad.join(", ")}`);
    process.exit(1);
  }

  const outRoot = path.resolve(process.cwd(), "skyboxes");
  await fs.mkdir(outRoot, { recursive: true });

  for (const id of ids) {
    try {
      const result = await downloadSkybox(id, outRoot);
      console.log(`Saved: ${result.folder}`);
    } catch (err) {
      console.error(`Failed ${id}:`, err.message || err);
    }
  }

  console.log(`Done. Output root: ${outRoot}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

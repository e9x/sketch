const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(
  path.resolve(__dirname, "..", "kru-deob", "game.debug.js"),
  "utf-8",
);

console.log(
  `Loaded game.debug.js (${(src.length / 1024 / 1024).toFixed(2)} MB)\n`,
);

const dataArg = "_test123";

const v = /(?<![a-zA-Z0-9_])[iIìíîïÌÍÎÏ]+(?![a-zA-Z0-9_])/;

const patches = {};

patches.io = [
  new RegExp(
    `(this|${v.source})\\[(${v.source}\\(0x[0-9a-f]+\\))\\]=new WebSocket\\((${v.source})\\)`,
  ),
  (_, target, prop, arg) => `${dataArg}.socket(${target}, ${prop}, ${arg})`,
];

patches.freeze = [
  /Object(?:\.freeze|\['freeze'\])\(/g,
  () => `${dataArg}.freeze(`,
];

patches.controls = [
  new RegExp(
    `(${v.source})\\[(${v.source}\\(0x[0-9a-f]+\\))\\]=(${v.source});`,
    "g",
  ),
  (_, target, prop, value) =>
    `${dataArg}.controls(${target},${prop},${value});`,
];

patches.switchLeaderboard = [
  new RegExp(
    `window\\[(${v.source}\\(0x[0-9a-f]+\\))\\]=function\\((${v.source}),(${v.source})\\)\\{([^}]*leaderboardHolder[^}]*)\\}`,
  ),
  (_, lookup, arg1, arg2, body) => {
    return `window[${lookup}]=${dataArg}.wrapSwitchLeaderboard(function(${arg1},${arg2}){${body}})`;
  },
];

patches.chatI18N = [
  new RegExp(
    `function\\s+(${v.source})\\((${v.source},${v.source},(${v.source}),${v.source},${v.source},${v.source},${v.source})\\)\\{([^}]*)\\}window\\['switchChat'\\]`,
  ),
  (_, fnName, allArgs, thirdArg, body) => {
    return `function ${fnName}(${allArgs}){Array['isArray'](${thirdArg})||(${thirdArg}=[${thirdArg}]);${dataArg}.chatI18N(${thirdArg});${body}}window['switchChat']`;
  },
];

let failed = false;

for (const name in patches) {
  const [regex, replacer] = patches[name];

  console.log(`--- ${name} ---`);
  console.log(`  regex: ${regex}`);
  console.log(`  flags: ${regex.flags || "(none)"}`);

  // Collect all matches
  const matches = [];
  const r = new RegExp(
    regex.source,
    regex.flags.includes("g") ? regex.flags : regex.flags + "g",
  );
  let m;
  while ((m = r.exec(src)) !== null) {
    matches.push(m);
  }

  if (matches.length === 0) {
    console.log(`  \x1b[31m✗ NO MATCHES FOUND\x1b[0m`);
    failed = true;
    console.log();
    continue;
  }

  const showAll = matches.length <= 10;
  console.log(
    `  \x1b[32m✓ ${matches.length} match(es)\x1b[0m${showAll ? "" : " (showing first 5 + last 1)"}`,
  );

  const toShow = showAll
    ? matches.map((m, i) => [i, m])
    : [
        ...matches.slice(0, 5).map((m, i) => [i, m]),
        [matches.length - 1, matches[matches.length - 1]],
      ];

  for (const [i, match] of toShow) {
    const start = Math.max(0, match.index - 30);
    const end = Math.min(src.length, match.index + match[0].length + 30);
    const ctx = src
      .slice(start, end)
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r");

    console.log(`\n  match ${i + 1}:`);
    console.log(`    index:   ${match.index}`);
    console.log(
      `    text:    ${match[0].slice(0, 120)}${match[0].length > 120 ? "..." : ""}`,
    );
    console.log(`    context: ...${ctx}...`);

    for (let g = 1; g < match.length; g++) {
      const val = match[g];
      console.log(
        `    group ${g}: ${val != null ? val.slice(0, 80) : "(undefined)"}`,
      );
    }

    const replaced = match[0].replace(regex, replacer);
    console.log(
      `    result:  ${replaced.slice(0, 120)}${replaced.length > 120 ? "..." : ""}`,
    );

    if (!showAll && i === 4 && matches.length > 10) {
      console.log(`\n  ... ${matches.length - 6} more matches omitted ...`);
    }
  }

  console.log();
}

// Run full replacement and sanity check
console.log("--- full replacement pass ---");
let patched = src;
for (const name in patches) {
  const [regex, replacer] = patches[name];
  let count = 0;
  patched = patched.replace(regex, (...args) => {
    count++;
    return replacer(...args);
  });
  console.log(`  ${name}: ${count} replacement(s)`);
}

const diff = patched.length - src.length;
console.log(`\n  original length: ${src.length}`);
console.log(`  patched length:  ${patched.length}`);
console.log(`  diff:            ${diff >= 0 ? "+" : ""}${diff} chars`);

const dataArgCount = (
  patched.match(
    new RegExp(dataArg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
  ) || []
).length;
console.log(`  ${dataArg} appears: ${dataArgCount} time(s)`);

// Verify the controls assignment is among the matches
const controlsRegex = new RegExp(
  `(${v.source})\\[(${v.source}\\(0x[0-9a-f]+\\))\\]=(${v.source});`,
  "g",
);
const allControlsMatches = [];
let cm;
while ((cm = controlsRegex.exec(src)) !== null) {
  allControlsMatches.push(cm);
}

// Check that the known controls offset is captured
const knownControlsCtx = "controls";
const controlsFound = allControlsMatches.some((m) => {
  const ctx = src.slice(Math.max(0, m.index - 60), m.index);
  return (
    ctx.includes("());") &&
    src.slice(m.index + m[0].length, m.index + m[0].length + 4) === "var "
  );
});
console.log(
  `\n  controls assignment in matches: ${controlsFound ? "\x1b[32m✓ yes\x1b[0m" : "\x1b[31m✗ no\x1b[0m"}`,
);

console.log();
if (failed) {
  console.log("\x1b[31mSOME PATCHES FAILED TO MATCH\x1b[0m");
  process.exit(1);
} else {
  console.log("\x1b[32mALL PATCHES MATCHED\x1b[0m");
}

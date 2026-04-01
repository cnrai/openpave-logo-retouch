const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build output path with a suffix if no explicit output given. */
function outputPath(input, suffix, explicitOutput) {
  if (explicitOutput) return explicitOutput;
  const dir = path.dirname(input);
  const ext = path.extname(input);
  const base = path.basename(input, ext);
  return path.join(dir, `${base}-${suffix}.png`);
}

/** Parse hex color string to { r, g, b }. Accepts #RRGGBB or RRGGBB. */
function parseHex(hex) {
  hex = hex.replace(/^#/, "");
  if (hex.length !== 6) throw new Error(`Invalid hex color: ${hex}`);
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

/** Read image as raw RGBA buffer. */
async function readRaw(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: Buffer.from(data), info };
}

/** Write raw RGBA buffer to PNG. */
async function writeRaw(data, info, output) {
  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(output);
}

/** Format file size. */
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/** Remove white/near-white background → transparent. Returns the modified buffer. */
async function removeBg(input, threshold = 230) {
  const { data, info } = await readRaw(input);
  let removed = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > threshold && data[i + 1] > threshold && data[i + 2] > threshold) {
      data[i + 3] = 0; // set alpha to 0
      removed++;
    }
  }
  const total = data.length / 4;
  return { data, info, stats: { removed, total, pct: ((removed / total) * 100).toFixed(1) } };
}

/** Recolor all non-transparent pixels to { r, g, b }. */
function recolorBuffer(srcData, r, g, b) {
  const data = Buffer.from(srcData);
  let recolored = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      recolored++;
    }
  }
  return { data, recolored };
}

/**
 * Recolor with alpha preservation — maps the original pixel's darkness
 * into the alpha channel so anti-aliased edges stay smooth.
 *
 * For "to-white --preserve-alpha": dark pixels → white with high alpha,
 * light pixels → white with low alpha (fades out toward the background).
 *
 * For "to-black --preserve-alpha": light pixels → black with high alpha,
 * dark pixels → black with low alpha.
 *
 * The `invert` flag controls the direction:
 *   false (default) = dark-is-opaque (for recoloring to white/light colors)
 *   true            = light-is-opaque (for recoloring to black/dark colors)
 */
function recolorPreserveAlpha(srcData, r, g, b, invert = false) {
  const data = Buffer.from(srcData);
  let recolored = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;

    // Perceived luminance (Rec. 709)
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];

    // Map luminance to alpha: 0 (black) → 255 alpha, 255 (white) → 0 alpha
    // Then combine with existing alpha
    let newAlpha;
    if (invert) {
      // Light-is-opaque: white pixels are most visible
      newAlpha = Math.round((lum / 255) * a);
    } else {
      // Dark-is-opaque: dark pixels are most visible (default for to-white)
      newAlpha = Math.round(((255 - lum) / 255) * a);
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = Math.min(255, Math.max(0, newAlpha));
    recolored++;
  }
  return { data, recolored };
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async function cmdRemoveBg(args) {
  const input = args.input;
  const threshold = parseInt(args.threshold || "230", 10);
  const output = outputPath(input, "transparent", args.output);

  const { data, info, stats } = await removeBg(input, threshold);
  await writeRaw(data, info, output);

  return `Removed background from ${path.basename(input)}\n` +
    `  ${stats.removed.toLocaleString()} of ${stats.total.toLocaleString()} pixels made transparent (${stats.pct}%)\n` +
    `  Threshold: ${threshold}\n` +
    `  Output: ${output}`;
}

async function cmdToWhite(args) {
  const input = args.input;
  const preserveAlpha = args["preserve-alpha"] === "true" || args["preserve-alpha"] === true;
  const suffix = preserveAlpha ? "white-smooth" : "white";
  const output = outputPath(input, suffix, args.output);

  const { data: srcData, info } = await readRaw(input);
  const { data, recolored } = preserveAlpha
    ? recolorPreserveAlpha(srcData, 255, 255, 255, false)
    : recolorBuffer(srcData, 255, 255, 255);
  await writeRaw(data, info, output);

  return `Recolored ${path.basename(input)} to white${preserveAlpha ? " (smooth edges)" : ""}\n` +
    `  ${recolored.toLocaleString()} pixels recolored\n` +
    `  Output: ${output}`;
}

async function cmdToBlack(args) {
  const input = args.input;
  const preserveAlpha = args["preserve-alpha"] === "true" || args["preserve-alpha"] === true;
  const suffix = preserveAlpha ? "black-smooth" : "black";
  const output = outputPath(input, suffix, args.output);

  const { data: srcData, info } = await readRaw(input);
  const { data, recolored } = preserveAlpha
    ? recolorPreserveAlpha(srcData, 0, 0, 0, true)
    : recolorBuffer(srcData, 0, 0, 0);
  await writeRaw(data, info, output);

  return `Recolored ${path.basename(input)} to black${preserveAlpha ? " (smooth edges)" : ""}\n` +
    `  ${recolored.toLocaleString()} pixels recolored\n` +
    `  Output: ${output}`;
}

async function cmdToColor(args) {
  const input = args.input;
  const { r, g, b } = parseHex(args.color);
  const colorLabel = args.color.replace(/^#/, "").toUpperCase();
  const preserveAlpha = args["preserve-alpha"] === "true" || args["preserve-alpha"] === true;
  const suffix = preserveAlpha ? `recolored-${colorLabel}-smooth` : `recolored-${colorLabel}`;
  const output = outputPath(input, suffix, args.output);

  const { data: srcData, info } = await readRaw(input);
  // For to-color with preserve-alpha, auto-detect direction:
  // if target color is light (lum > 128), use dark-is-opaque; otherwise light-is-opaque
  const targetLum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const { data, recolored } = preserveAlpha
    ? recolorPreserveAlpha(srcData, r, g, b, targetLum < 128)
    : recolorBuffer(srcData, r, g, b);
  await writeRaw(data, info, output);

  return `Recolored ${path.basename(input)} to #${colorLabel}${preserveAlpha ? " (smooth edges)" : ""}\n` +
    `  ${recolored.toLocaleString()} pixels recolored\n` +
    `  Output: ${output}`;
}

async function cmdResize(args) {
  const input = args.input;
  const meta = await sharp(input).metadata();

  let width = args.width ? parseInt(args.width, 10) : undefined;
  let height = args.height ? parseInt(args.height, 10) : undefined;

  if (args.scale) {
    const scale = parseFloat(args.scale);
    width = Math.round(meta.width * scale);
    height = Math.round(meta.height * scale);
  }

  if (!width && !height) {
    return "Error: specify --width, --height, or --scale";
  }

  const suffix = width && height ? `${width}x${height}` : width ? `w${width}` : `h${height}`;
  const output = outputPath(input, `resized-${suffix}`, args.output);

  await sharp(input)
    .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(output);

  const outMeta = await sharp(output).metadata();
  return `Resized ${path.basename(input)} (${meta.width}x${meta.height}) → ${outMeta.width}x${outMeta.height}\n` +
    `  Output: ${output}`;
}

async function cmdPad(args) {
  const input = args.input;
  const output = outputPath(input, "padded", args.output);

  // Parse padding: single number or top,right,bottom,left
  const parts = String(args.padding).split(",").map((s) => parseInt(s.trim(), 10));
  let top, right, bottom, left;
  if (parts.length === 1) {
    top = right = bottom = left = parts[0];
  } else if (parts.length === 4) {
    [top, right, bottom, left] = parts;
  } else {
    return "Error: padding must be a single number or top,right,bottom,left (e.g. 20 or 10,20,10,20)";
  }

  let bg = { r: 0, g: 0, b: 0, alpha: 0 };
  if (args.color) {
    const { r, g, b } = parseHex(args.color);
    bg = { r, g, b, alpha: 255 };
  }

  await sharp(input)
    .extend({ top, bottom, left, right, background: bg })
    .png()
    .toFile(output);

  const outMeta = await sharp(output).metadata();
  return `Padded ${path.basename(input)} with ${top},${right},${bottom},${left}px\n` +
    `  Result: ${outMeta.width}x${outMeta.height}\n` +
    `  Output: ${output}`;
}

async function cmdInfo(args) {
  const input = args.input;
  const stat = fs.statSync(input);
  const meta = await sharp(input).metadata();

  return `Image: ${path.basename(input)}\n` +
    `  Path: ${input}\n` +
    `  Format: ${meta.format}\n` +
    `  Dimensions: ${meta.width}x${meta.height}\n` +
    `  Channels: ${meta.channels}${meta.hasAlpha ? " (has alpha)" : " (no alpha)"}\n` +
    `  Color space: ${meta.space || "unknown"}\n` +
    `  File size: ${fmtSize(stat.size)}\n` +
    `  DPI: ${meta.density || "unset"}`;
}

async function cmdBatch(args) {
  const input = args.input;
  const outDir = args["output-dir"] || path.dirname(input);
  const ops = String(args.operations).split(",").map((s) => s.trim().toLowerCase());
  const baseName = path.basename(input, path.extname(input));

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const results = [];

  // If remove-bg is requested, do it first and use transparent version for subsequent ops
  let transparentData = null;
  let transparentInfo = null;

  if (ops.includes("remove-bg")) {
    const threshold = 230;
    const { data, info, stats } = await removeBg(input, threshold);
    transparentData = data;
    transparentInfo = info;
    const out = path.join(outDir, `${baseName}-transparent.png`);
    await writeRaw(data, info, out);
    results.push(`  remove-bg → ${out} (${stats.pct}% pixels removed)`);
  }

  // For subsequent ops, use transparent version if available, otherwise read original
  const getSrcData = async () => {
    if (transparentData) return { data: transparentData, info: transparentInfo };
    return await readRaw(input);
  };

  for (const op of ops) {
    if (op === "remove-bg") continue; // already handled

    if (op === "to-white") {
      const { data: src, info } = await getSrcData();
      const { data } = recolorBuffer(src, 255, 255, 255);
      const out = path.join(outDir, `${baseName}-white.png`);
      await writeRaw(data, info, out);
      results.push(`  to-white → ${out}`);
    } else if (op === "to-black") {
      const { data: src, info } = await getSrcData();
      const { data } = recolorBuffer(src, 0, 0, 0);
      const out = path.join(outDir, `${baseName}-black.png`);
      await writeRaw(data, info, out);
      results.push(`  to-black → ${out}`);
    } else if (op.startsWith("to-color:")) {
      const hex = op.split(":")[1];
      const { r, g, b } = parseHex(hex);
      const { data: src, info } = await getSrcData();
      const { data } = recolorBuffer(src, r, g, b);
      const label = hex.replace(/^#/, "").toUpperCase();
      const out = path.join(outDir, `${baseName}-${label}.png`);
      await writeRaw(data, info, out);
      results.push(`  to-color:#${label} → ${out}`);
    } else if (op.startsWith("resize:")) {
      const dim = op.split(":")[1];
      const width = parseInt(dim, 10);
      const src = transparentData
        ? await sharp(transparentData, {
            raw: { width: transparentInfo.width, height: transparentInfo.height, channels: 4 },
          }).png().toBuffer()
        : input;
      const out = path.join(outDir, `${baseName}-${width}w.png`);
      await sharp(src)
        .resize(width, null, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(out);
      results.push(`  resize:${width} → ${out}`);
    } else {
      results.push(`  ${op} — unknown operation, skipped`);
    }
  }

  return `Batch processed ${path.basename(input)}:\n${results.join("\n")}`;
}

// ---------------------------------------------------------------------------
// CLI dispatcher (PAVE skill protocol)
// ---------------------------------------------------------------------------

const COMMANDS = {
  "remove-bg": cmdRemoveBg,
  "to-white": cmdToWhite,
  "to-black": cmdToBlack,
  "to-color": cmdToColor,
  resize: cmdResize,
  pad: cmdPad,
  info: cmdInfo,
  batch: cmdBatch,
};

async function main() {
  const args = {};
  const argv = process.argv.slice(2);
  let command = null;

  for (let i = 0; i < argv.length; i++) {
    if (!command && !argv[i].startsWith("-")) {
      command = argv[i];
      continue;
    }
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      args[key] = val;
    }
  }

  if (!command || !COMMANDS[command]) {
    console.error(
      `Usage: logo <command> [options]\n\nCommands:\n${Object.keys(COMMANDS).map((c) => `  ${c}`).join("\n")}`
    );
    process.exit(1);
  }

  try {
    const result = await COMMANDS[command](args);
    console.log(result);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();

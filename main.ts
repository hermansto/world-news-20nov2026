#!/usr/bin/env node
// news-image-20261120 — copies entry.png byte-for-byte to $MAKEFUN_OUTPUT_DIR/entry.png
// Node 22+, standard library only, ESM (top-level await).

import { readFileSync, mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SRC = join(SCRIPT_DIR, "entry.png");
const OUT_DIR = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");
const DST = join(OUT_DIR, "entry.png");

const MAX_BYTES = 1_048_576; // 1 MiB

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

function startsWith(buf, magic) {
  if (buf.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (buf[i] !== magic[i]) return false;
  }
  return true;
}

function detectFormat(buf) {
  if (startsWith(buf, JPEG_MAGIC)) return "jpeg";
  if (startsWith(buf, PNG_MAGIC)) return "png";
  return null;
}

function fail(message: string, detail?: unknown) {
  const line = detail !== undefined && detail !== null && detail !== ""
    ? `${message}: ${detail instanceof Error ? detail.message : String(detail)}`
    : message;
  process.stderr.write(`error: [news-image-20261120/main.ts] ${line}\n`);
  process.exit(1);
}

let bytes;
try {
  bytes = readFileSync(SRC);
} catch (err) {
  fail(`cannot read source image ${SRC}`, err?.message ?? String(err));
}

const format = detectFormat(bytes);
if (!format) {
  const head = [...bytes.subarray(0, 8)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
  fail(
    `source image is neither JPEG (ff d8 ff) nor PNG (89 50 4e 47), head bytes: ${head || "(empty file)"}`,
  );
}

if (bytes.length > MAX_BYTES) {
  fail(
    `source image is ${bytes.length} bytes, above the ${MAX_BYTES} byte (1 MiB) limit by ${bytes.length - MAX_BYTES} bytes`,
  );
}

if (bytes.length === 0) {
  fail("source image is empty (0 bytes)");
}

if (existsSync(OUT_DIR)) {
  let existing;
  try {
    existing = statSync(OUT_DIR);
  } catch (err) {
    fail(`cannot stat output path ${OUT_DIR}`, err?.message ?? String(err));
  }
  if (!existing.isDirectory()) {
    fail(`output path ${OUT_DIR} already exists but is not a directory (mkdir would fail with EEXIST)`);
  }
} else {
  try {
    mkdirSync(OUT_DIR, { recursive: true });
  } catch (err) {
    fail(`cannot create output directory ${OUT_DIR}`, err?.message ?? String(err));
  }
}

let outStat;
try {
  outStat = statSync(OUT_DIR);
} catch (err) {
  fail(`output directory ${OUT_DIR} is not readable after creation`, err?.message ?? String(err));
}
if (!outStat.isDirectory()) {
  fail(`output path ${OUT_DIR} is not a directory after creation`);
}

writeFileSync(DST, bytes);

if (!existsSync(DST)) {
  fail(`copy verification failed, ${DST} does not exist after write`);
}

const readBack = readFileSync(DST).length;
if (readBack !== bytes.length) {
  fail(`copy verification failed, wrote ${readBack} bytes but source is ${bytes.length} bytes`);
}

const fmtLabel = String(format).toUpperCase();
process.stdout.write(`copied ${fmtLabel} ${bytes.length} bytes -> ${DST}\n`);
process.stdout.write(`${bytes.length}\n`);

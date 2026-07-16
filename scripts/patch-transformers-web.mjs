import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const target = join(
  import.meta.dirname,
  "../node_modules/@huggingface/transformers/dist/transformers.web.js"
);

if (!existsSync(target)) {
  console.log("[patch] transformers.web.js not found, skipping.");
  process.exit(0);
}

let code = readFileSync(target, "utf8");

// Replace empty fs/path/url stubs with real Node.js modules
const replacements = [
  ['var node_fs_default = {};', 'var node_fs_default = require("node:fs");'],
  ['var node_path_default = {};', 'var node_path_default = require("node:path");'],
  ['var node_url_default = {};', 'var node_url_default = require("node:url");'],
];

let patched = false;
for (const [from, to] of replacements) {
  if (code.includes(from)) {
    code = code.replace(from, to);
    patched = true;
  }
}

// When globalThis[Symbol.for("onnxruntime")] is set, the web build skips device setup.
// We need to add supportedDevices and defaultDevices when this path is taken.
const ortBlock = `if (ORT_SYMBOL in globalThis) {
  ONNX = globalThis[ORT_SYMBOL];
}`;
const patchedOrtBlock = `if (ORT_SYMBOL in globalThis) {
  ONNX = globalThis[ORT_SYMBOL];
  if (apis.IS_WEBGPU_AVAILABLE) {
    supportedDevices.push("webgpu");
  }
  supportedDevices.push("wasm");
  supportedDevices.push("cpu");
  defaultDevices = ["wasm"];
}`;
if (code.includes(ortBlock)) {
  code = code.replace(ortBlock, patchedOrtBlock);
  patched = true;
}

// Remap "cpu" device to "wasm" for onnxruntime-web
const cpuMapping = 'cpu: "cpu"';
const wasmMapping = 'cpu: "wasm"';
if (code.includes(cpuMapping)) {
  code = code.replace(cpuMapping, wasmMapping);
  patched = true;
}

if (patched) {
  writeFileSync(target, code);
  console.log("[patch] Patched transformers.web.js to enable Node.js fs/path/url modules and WASM device setup.");
} else {
  console.log("[patch] transformers.web.js already patched or no changes needed.");
}

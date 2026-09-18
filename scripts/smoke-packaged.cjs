// Run with Node 22+ against the actual packaged executable, using a temporary
// profile. Tests preload IPC and local image previews with webSecurity enabled.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const net = require("node:net");
const asar = require("@electron/asar");

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const executable = path.resolve(process.argv[2]);
  const resources = process.platform === "darwin"
    ? path.resolve(path.dirname(executable), "../Resources")
    : path.join(path.dirname(executable), "resources");
  const archive = path.join(resources, "app.asar");
  const metadata = JSON.parse(asar.extractFile(archive, "package.json"));
  assert.equal(metadata.version, require("../package.json").version);
  assert(!metadata.dependencies["posthog-js"] && !metadata.dependencies.firebase);
  const mainSource = asar.extractFile(archive, "export/electron/main-window.js").toString();
  assert.match(mainSource, /nodeIntegration: false/);
  assert.match(mainSource, /contextIsolation: true/);
  assert.match(mainSource, /webSecurity: true/);
  assert(!mainSource.includes("checkForUpdates("));
  for (const model of ["upscayl-standard-4x", "upscayl-lite-4x", "digital-art-4x"]) {
    for (const ext of ["param", "bin"]) assert(fs.statSync(path.join(resources, "models", `${model}.${ext}`)).size > 0);
  }
  const binary = path.join(resources, "bin", process.platform === "win32" ? "upscayl-bin.exe" : "upscayl-bin");
  const help = spawnSync(binary, ["-h"], { encoding: "utf8", timeout: 15000 });
  assert(!help.error, String(help.error));
  assert.match(help.stdout + help.stderr, /Usage|usage/);
  const exifPackage = `exiftool-vendored.${process.platform === "win32" ? "exe" : "pl"}`;
  const exifEntry = asar.listPackage(archive).find((entry) => entry.endsWith(`/${exifPackage}/bin/${process.platform === "win32" ? "exiftool.exe" : "exiftool"}`));
  assert(exifEntry, "Bundled ExifTool missing");
  const exifBinary = path.join(`${archive}.unpacked`, exifEntry);
  const exif = spawnSync(exifBinary, ["-ver"], { encoding: "utf8", timeout: 15000 });
  assert.equal(exif.status, 0, exif.stderr || String(exif.error));

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "upscayl-smoke-"));
  const fixture = path.join(temporary, "preview space # é.png");
  fs.copyFileSync(path.resolve("resources/icons/128x128.png"), fixture);
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const child = spawn(executable, [`--remote-debugging-port=${port}`, `--user-data-dir=${path.join(temporary, "profile")}`, "--no-first-run"], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (data) => { output += data; });
  child.stderr.on("data", (data) => { output += data; });
  let socket;
  try {
    let page;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (child.exitCode !== null) throw new Error(`App exited: ${output}`);
      try {
        const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        page = pages.find((p) => p.type === "page" && p.url.startsWith("file:"));
        if (page) break;
      } catch {}
      await pause(500);
    }
    assert(page, `No renderer page: ${output}`);
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let id = 0;
    const pending = new Map();
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (pending.has(message.id)) {
        const { resolve, reject, timer } = pending.get(message.id);
        clearTimeout(timer);
        pending.delete(message.id);
        message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
      }
    };
    function send(method, params) {
      return new Promise((resolve, reject) => {
        const requestId = ++id;
        const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`Timed out: ${method}`)); }, 30000);
        pending.set(requestId, { resolve, reject, timer });
        socket.send(JSON.stringify({ id: requestId, method, params }));
      });
    }
    async function evaluate(expression) {
      const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    }
    let state;
    for (let attempt = 0; attempt < 60; attempt++) {
      state = await evaluate(`({ready: document.readyState, text: document.body.innerText, bridge: !!window.electron, node: typeof require})`);
      if (state.bridge && /Upscayl/i.test(state.text)) break;
      await pause(500);
    }
    assert(state.bridge, "Preload bridge missing");
    assert.match(state.text, /Upscayl/i);
    assert.equal(state.node, "undefined", "Node leaked into renderer");
    const version = await evaluate("window.electron.getAppVersion()");
    assert(version.includes(metadata.version), version);
    const platform = await evaluate("window.electron.platform");
    assert.equal(platform, process.platform === "win32" ? "win" : "mac");
    const preview = await evaluate(`new Promise(resolve => { const img = new Image(); img.onload = () => resolve({width: img.naturalWidth, height: img.naturalHeight}); img.onerror = () => resolve({error: true}); img.src = ${JSON.stringify(pathToFileURL(fixture).href)}; document.body.appendChild(img); })`);
    assert.deepEqual(preview, { width: 128, height: 128 });
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    fs.mkdirSync("dist/internal", { recursive: true });
    fs.writeFileSync(`dist/internal/smoke-${process.platform}-${process.arch}.png`, Buffer.from(data, "base64"));
    console.log(JSON.stringify({ version, platform, checks: ["packaged security settings", "telemetry removed", "updater disabled", "models bundled", "native engine loads", "ExifTool runs", "renderer starts", "preload IPC", "local image preview"] }, null, 2));
  } finally {
    if (socket) socket.close();
    child.kill();
    await pause(1000);
    fs.rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

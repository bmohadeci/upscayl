const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const folder = path.resolve("dist/internal");
const files = fs.readdirSync(folder).filter((file) => /\.(exe|dmg)$/.test(file)).sort();
if (!files.length) throw new Error("No installers found");
const sums = files.map((file) => `${createHash("sha256").update(fs.readFileSync(path.join(folder, file))).digest("hex")}  ${file}`).join("\n") + "\n";
fs.writeFileSync(path.join(folder, "SHA256SUMS.txt"), sums);
console.log(sums);

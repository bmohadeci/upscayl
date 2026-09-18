// Ad-hoc signatures allow local execution on Apple Silicon. They are not
// Developer ID signatures and do not provide Gatekeeper notarization.
const { execFileSync } = require("node:child_process");
const path = require("node:path");

module.exports = async ({ electronPlatformName, appOutDir, packager }) => {
  if (electronPlatformName !== "darwin") return;
  const app = path.join(appOutDir, `${packager.appInfo.productFilename}.app`);
  execFileSync("codesign", [
    "--force", "--deep", "--sign", "-", "--timestamp=none",
    "--entitlements", path.resolve("resources/entitlements.mac.plist"), app,
  ], { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--deep", "--strict", app], {
    stdio: "inherit",
  });
};

const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

const [root, destination] = process.argv.slice(2);

if (!root || !destination) process.exit(2);

function addFolder(zip, current, base) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.name === "AutoBackups") continue;
    const source = path.join(current, entry.name);
    const relative = path.relative(base, source);
    if (entry.isDirectory()) addFolder(zip, source, base);
    else zip.addLocalFile(source, path.dirname(relative));
  }
}

try {
  const zip = new AdmZip();
  addFolder(zip, root, root);
  zip.addFile(
    "backup-manifest.json",
    Buffer.from(JSON.stringify({ version: 1, createdAt: Date.now() }, null, 2)),
  );
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  zip.writeZip(destination);

  const folder = path.dirname(destination);
  const archives = fs
    .readdirSync(folder)
    .filter((name) => name.endsWith(".zip"))
    .sort()
    .reverse();

  for (const expired of archives.slice(6)) {
    try {
      fs.unlinkSync(path.join(folder, expired));
    } catch {}
  }

  process.exit(0);
} catch (error) {
  process.stderr.write(String(error?.stack || error));
  process.exit(1);
}

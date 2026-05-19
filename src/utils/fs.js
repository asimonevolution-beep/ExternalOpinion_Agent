const fs = require('fs/promises');

const ensureDirectory = async (directoryPath) => {
  await fs.mkdir(directoryPath, { recursive: true });
};

const pathExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

module.exports = {
  ensureDirectory,
  pathExists,
  readFile: fs.readFile,
  writeFile: fs.writeFile,
  appendFile: fs.appendFile,
  rename: fs.rename,
  stat: fs.stat,
  readdir: fs.readdir,
};

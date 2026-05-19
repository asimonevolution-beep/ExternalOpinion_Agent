const fs = require('fs');
const path = require('path');
const pino = require('pino');
const config = require('../config');

const streams = [{ stream: process.stdout }];

if (config.logFile) {
  const logDirectory = path.dirname(config.logFile);
  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }
  streams.push({ stream: fs.createWriteStream(config.logFile, { flags: 'a' }) });
}

const logger = pino(
  {
    level: config.logLevel,
    base: { pid: false },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream(streams),
);

module.exports = logger;

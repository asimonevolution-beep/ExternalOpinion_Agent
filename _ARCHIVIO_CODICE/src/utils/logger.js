const fs = require('fs/promises');
const path = require('path');
const pino = require('pino');
const config = require('../config');

/**
 * Crea un logger pino con output console e file opzionale.
 * @returns {import('pino').Logger}
 */
async function createLogger() {
  const streams = [{ stream: process.stdout }];

  if (config.logFile) {
    const logDirectory = path.dirname(config.logFile);
    await fs.mkdir(logDirectory, { recursive: true });
    streams.push({ stream: pino.destination({ dest: config.logFile, sync: false }) });
  }

  return pino(
    {
      level: config.logLevel,
      base: { pid: false },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.multistream(streams),
  );
}

module.exports = { createLogger };

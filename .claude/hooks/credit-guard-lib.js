const fs = require('fs');
const path = require('path');

function projectDir(input) {
  return (
    process.env.CLAUDE_PROJECT_DIR ||
    (input && input.workspace && input.workspace.project_dir) ||
    (input && input.cwd) ||
    process.cwd()
  );
}

function statePath(input) {
  return path.join(projectDir(input), '.claude', '.credit-guard-state.json');
}

const DEFAULT_STATE = {
  costCeiling: 0.5,
  contextCeiling: 45,
  rateCeiling: 60,
  maxConsecutive: 25,
  lastCost: 0,
  lastAuthorizedCost: 0,
  contextPct: 0,
  ratePct: 0,
  model: '',
  toolCount: 0,
  bypassOnce: false,
  allowAgents: false,
};

function readState(input) {
  try {
    const raw = fs.readFileSync(statePath(input), 'utf8');
    return Object.assign({}, DEFAULT_STATE, JSON.parse(raw));
  } catch (e) {
    return Object.assign({}, DEFAULT_STATE);
  }
}

function writeState(input, state) {
  try {
    const p = statePath(input);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(state, null, 2));
  } catch (e) {}
}

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch (e) { return ''; }
}

function parseInput() {
  const raw = readStdin();
  try { return JSON.parse(raw); } catch (e) { return {}; }
}

module.exports = { projectDir, statePath, readState, writeState, parseInput, DEFAULT_STATE };

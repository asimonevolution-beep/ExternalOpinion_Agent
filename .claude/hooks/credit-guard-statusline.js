#!/usr/bin/env node
// credit-guard-statusline.js — Status line permanente + sensore costi/contesto.
// Mostra: modello | costo sessione | contesto % | token | effort.
// Effetto collaterale chiave: scrive lastCost/contextPct/model nello stato,
// così l'hook PreToolUse può bloccare quando si supera una soglia.
const fs = require('fs');
const { readState, writeState } = require('./credit-guard-lib.js');

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch (e) { return ''; }
}

let input = {};
try { input = JSON.parse(readStdin()); } catch (e) { input = {}; }

const model = (input.model && (input.model.display_name || input.model.id)) || 'n/d';
const modelId = (input.model && input.model.id) || '';
const cost = (input.cost && typeof input.cost.total_cost_usd === 'number') ? input.cost.total_cost_usd : 0;

// --- contesto: leggo la coda del transcript per stimare i token attivi ---
function context(transcriptPath, mId) {
  try {
    if (!transcriptPath) return null;
    const fd = fs.openSync(transcriptPath, 'r');
    const size = fs.fstatSync(fd).size;
    const readLen = Math.min(size, 256 * 1024);
    const buf = Buffer.alloc(readLen);
    fs.readSync(fd, buf, 0, readLen, size - readLen);
    fs.closeSync(fd);
    const lines = buf.toString('utf8').split('\n').filter(Boolean);
    let u = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const o = JSON.parse(lines[i]);
        const usage = o && o.message && o.message.usage;
        if (usage && usage.input_tokens != null) { u = usage; break; }
      } catch (e) { /* riga parziale, ignora */ }
    }
    if (!u) return null;
    const toks = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    const win = /1m|\[1m\]/i.test(mId || '') ? 1000000 : 200000;
    return { toks, pct: (toks / win) * 100 };
  } catch (e) { return null; }
}

const ctx = context(input.transcript_path, modelId);
const pct = ctx ? ctx.pct : 0;
const toks = ctx ? ctx.toks : 0;
const effort = input.effort || (input.output_style && input.output_style.name) || '';

// aggiorna lo stato (preserva i tetti gestiti dall'hook)
const st = readState(input);
st.lastCost = cost;
st.contextPct = pct;
st.model = model;
writeState(input, st);

// formattazione token in k/M
function fmtTok(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return String(n);
}

// indicatori soglia
const costFlag = cost >= st.costCeiling ? '!' : '';
const ctxFlag = pct >= st.contextCeiling ? '!' : '';
const opusFlag = /opus/i.test(modelId) ? ' [OPUS!]' : '';

const parts = [
  `🛡 ${model}${opusFlag}`,
  `$${cost.toFixed(3)}/${st.costCeiling.toFixed(2)}${costFlag}`,
  `ctx ${pct.toFixed(0)}%${ctxFlag}`,
  `tok ${fmtTok(toks)}`,
];
if (effort) parts.push(`eff ${effort}`);

process.stdout.write(parts.join('  |  '));

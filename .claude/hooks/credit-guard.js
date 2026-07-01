#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { readState, writeState, parseInput } = require('./credit-guard-lib.js');

const STOP_MSG =
  'STOP CONSUMO.\n' +
  'Claude Code sta superando la soglia impostata.\n' +
  'Autorizzi altri 0,50 USD di lavoro?\n' +
  'Rispondi esattamente:\n' +
  'SÃŒ CONTINUA\n' +
  'oppure\n' +
  'NO FERMA';

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

function allow() { process.exit(0); }

const input = parseInput();
const tool = input.tool_name || '';
const ti = input.tool_input || {};
const st = readState(input);

// (A) modifiche al file di stato: SEMPRE permesse (no deadlock)
const fp = (ti.file_path || '').replace(/\\/g, '/');
if ((tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit') &&
    fp.endsWith('.claude/.credit-guard-state.json')) {
  allow();
}

// (B) sblocco one-shot
if (st.bypassOnce) {
  st.bypassOnce = false;
  writeState(input, st);
  allow();
}

// conteggio tool call consecutive (solo dopo i bypass)
st.toolCount = (st.toolCount || 0) + 1;
writeState(input, st);

// (C) tetto COSTO â€” delta rispetto all'ultimo messaggio utente
const costDelta = (st.lastCost || 0) - (st.lastAuthorizedCost || 0);
if (costDelta >= st.costCeiling) {
  deny(STOP_MSG + `\n\n[soglia: +$${costDelta.toFixed(3)} >= $${st.costCeiling.toFixed(2)} in questo turno]`);
}

// (D) tetto CONTESTO
if (st.contextPct >= st.contextCeiling) {
  deny(STOP_MSG + `\n\n[soglia: CONTESTO ${st.contextPct.toFixed(0)}% >= ${st.contextCeiling}%]`);
}

// (E) tetto RATE LIMIT
if (st.ratePct >= st.rateCeiling) {
  deny(STOP_MSG + `\n\n[soglia: RATE LIMIT ${st.ratePct.toFixed(0)}% >= ${st.rateCeiling}%]`);
}

// (F) troppe tool call consecutive
if (st.toolCount > st.maxConsecutive) {
  deny(STOP_MSG + `\n\n[soglia: ${st.toolCount} tool call consecutive > ${st.maxConsecutive}]`);
}

// (G) subagent / workflow
if ((tool === 'Agent' || tool === 'Workflow') && !st.allowAgents) {
  deny(STOP_MSG + `\n\n[BLOCCO: subagent/workflow vietati. Autorizza nel file di stato.]`);
}

// (H) comandi Bash/PowerShell pesanti
// Le keyword sono costruite a runtime per evitare falsi positivi
// quando questo file viene scritto/aggiornato tramite tool Bash
if (tool === 'Bash' || tool === 'PowerShell') {
  const cmd = String(ti.command || '');
  const bld = 'buil' + 'd';
  const esbld = 'es' + bld;
  const tst = 'te' + 'st';
  const jst = 'je' + tst;
  const vts = 'vi' + tst;
  const mch = 'moc' + 'ha';
  const plw = 'play' + 'wright';
  const cyp = 'cyp' + 'ress';
  const rwy = 'rail' + 'way';
  const dep = 'dep' + 'loy';
  const vcl = 'ver' + 'cel';
  const ntf = 'net' + 'lify';
  const nxt = 'ne' + 'xt';
  const vit = 'vi' + 'te';
  const wbp = 'web' + 'pack';
  const rlu = 'roll' + 'up';
  const tc  = 'ts' + 'c';
  const LBL_B = 'BUI' + 'LD';
  const LBL_T = 'TEST' + ' LUNGO';
  const LBL_D = 'DEP' + 'LOY';
  const RULES = [
    [new RegExp(`\\b(npm|pnpm|yarn)\\s+(run\\s+)?${bld}\\b`, 'i'), LBL_B],
    [new RegExp(`\\b(${nxt}|${vit}|${wbp}|${rlu}|${esbld}|${tc})\\b.*\\b${bld}\\b`, 'i'), LBL_B],
    [new RegExp(`\\b(npm|pnpm|yarn)\\s+(run\\s+)?(${tst}|e2e)\\b`, 'i'), LBL_T],
    [new RegExp(`\\b(${jst}|${vts}|${mch}|${plw}|${cyp})\\b`, 'i'), LBL_T],
    [new RegExp(`\\b(${rwy}\\s+(up|${dep}|re${dep})|${vcl}(\\s+${dep})?|${ntf}\\s+${dep})\\b`, 'i'), LBL_D],
    [/\bgrep\s+-[a-zA-Z]*r[a-zA-Z]*\s+.*\s+[\.\/]\s*$/i, 'SCANSIONE GLOBALE'],
    [/\b(rg|ripgrep)\b(?!.*(-g|--glob|--type|--max-count|-m\b)).*\s\.\s*$/i, 'SCANSIONE GLOBALE'],
    [/\bfind\s+[\.\/]/i, 'SCANSIONE FILESYSTEM'],
    [/\bls\s+-[a-zA-Z]*R/i, 'LISTING RICORSIVO'],
    [/\b(cat|type)\s+.*\*/i, 'LETTURA MASSIVA'],
  ];
  for (const [re, label] of RULES) {
    if (re.test(cmd)) {
      deny(STOP_MSG + `\n\n[BLOCCO: comando "${label}" senza autorizzazione.]`);
    }
  }
}

allow();


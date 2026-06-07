const fs = require('fs');
const path = require('path');

console.log("=== CASCADE: PATCH ACTION 2 STARTED ===");

const expectedRevenue = 180450;
const totalCosts = 260000;
const targetRoi = Number((((expectedRevenue - totalCosts) / totalCosts) * 100).toFixed(1));

if (targetRoi !== -30.6) {
  console.error(`[FAIL] ROI matematico errato: ${targetRoi}`);
  process.exit(1);
}

const handoffPath = path.join(process.cwd(), 'docs/CASCADE_AGENT_HANDOFF.md');
if (!fs.existsSync(handoffPath)) {
  console.error("[FAIL] docs/CASCADE_AGENT_HANDOFF.md mancante.");
  process.exit(1);
}

const searchRoots = ['reports', 'REPORT_FINALI', 'src/templates'];
const allowedExt = new Set(['.html', '.md', '.txt']);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...walk(full));
    if (item.isFile() && allowedExt.has(path.extname(item.name).toLowerCase())) out.push(full);
  }
  return out;
}

const files = searchRoots.flatMap(walk);

const candidates = files.filter(file => {
  const text = fs.readFileSync(file, 'utf8');
  const name = file.toLowerCase();
  return (
    name.includes('abramo') ||
    text.includes('Abramo') ||
    text.includes('Via Albareto') ||
    text.includes('-32,3') ||
    text.includes('-32.3') ||
    text.includes('-30,6') ||
    text.includes('-30.6')
  );
});

if (candidates.length === 0) {
  console.error("[FAIL] Nessun file report/template Abramo trovato in reports, REPORT_FINALI, src/templates.");
  process.exit(1);
}

let patchedFiles = [];

for (const file of candidates) {
  const original = fs.readFileSync(file, 'utf8');
  let text = original;
  text = text.replace(/-32,3/g, '-30,6');
  text = text.replace(/-32\.3/g, '-30.6');

  if (text !== original) {
    fs.writeFileSync(file, text, 'utf8');
    patchedFiles.push(file);
    console.log(`[PATCHED] ${file}`);
  } else {
    console.log(`[UNCHANGED] ${file}`);
  }
}

fs.mkdirSync(path.join(process.cwd(), 'outputs/action2'), { recursive: true });

const artifact = {
  action: "Azione 2 - Allineamento ROI",
  status: "PATCH_APPLIED",
  action2_status: "ACTIVE_NOT_DONE",
  roi_expected: -30.6,
  roi_old: -32.3,
  source_data: { expectedRevenue, totalCosts },
  formula: "((expectedRevenue - totalCosts) / totalCosts) * 100",
  discovered_files: candidates,
  patched_files: patchedFiles,
  safe_roi_status: "PENDING",
  pdf_status: "NOT_VERIFIED",
  verification_result: "PENDING",
  errors: [],
  production_touched: false,
  email_sent: false,
  deploy_executed: false,
  next_locked_action: "Azione 3"
};

fs.writeFileSync(
  path.join(process.cwd(), 'outputs/action2/verification-result.json'),
  JSON.stringify(artifact, null, 2),
  'utf8'
);

console.log("[ARTIFACT] outputs/action2/verification-result.json creato.");
console.log("=== CASCADE: PATCH ACTION 2 COMPLETED ===");

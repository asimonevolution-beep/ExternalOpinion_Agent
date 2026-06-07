const fs = require('fs');
const path = require('path');
const { safeRoiCalculation } = require('./lib/safe-roi-calculation.cjs');

console.log("=== CASCADE: VERIFY ACTION 2 STARTED ===");

const artifactPath = path.join(process.cwd(), 'outputs/action2/verification-result.json');

if (!fs.existsSync(artifactPath)) {
  console.error("[FAIL] Artifact mancante.");
  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

const expectedRevenue = 180450;
const totalCosts = 260000;

let errors = [];

const directRoi = Number((((expectedRevenue - totalCosts) / totalCosts) * 100).toFixed(1));
if (directRoi !== -30.6) {
  errors.push(`[FAIL] ROI matematico diretto errato: ${directRoi}`);
}

const safeRoi = safeRoiCalculation({ expectedRevenue, totalCosts });
if (safeRoi !== -30.6) {
  errors.push(`[FAIL] safeRoiCalculation fallback produce ${safeRoi} invece di -30.6`);
  artifact.safe_roi_status = "FAIL";
} else {
  artifact.safe_roi_status = "PASS_PURE_FALLBACK";
  artifact.safe_roi_file = "scripts/lib/safe-roi-calculation.cjs";
  console.log("[PASS] safeRoiCalculation fallback verificata: -30.6");
}

const files = artifact.discovered_files || [];

if (files.length === 0) {
  errors.push("[FAIL] Nessun file report/template scoperto.");
}

let checkedFiles = [];

for (const file of files) {
  if (!fs.existsSync(file)) {
    errors.push(`[FAIL] File scoperto non più presente: ${file}`);
    continue;
  }

  const text = fs.readFileSync(file, 'utf8');
  checkedFiles.push(file);

  if (text.includes('-32,3') || text.includes('-32.3')) {
    errors.push(`[FAIL] ROI vecchio ancora presente in ${file}`);
  }

  if (!text.includes('-30,6') && !text.includes('-30.6')) {
    errors.push(`[FAIL] ROI corretto assente in ${file}`);
  }

  if (!text.includes('YELLOW') && !text.includes('GIALLO')) {
    errors.push(`[FAIL] YELLOW/GIALLO assente in ${file}`);
  }
}

artifact.checked_files = checkedFiles;
artifact.pdf_status = "NOT_VERIFIED";
artifact.action2_status = "ACTIVE_NOT_DONE";
artifact.production_touched = false;
artifact.email_sent = false;
artifact.deploy_executed = false;

if (errors.length > 0) {
  artifact.verification_result = "FAIL";
  artifact.errors = errors;
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), 'utf8');

  console.error("=== CASCADE: VERIFY ACTION 2 FAIL ===");
  errors.forEach(e => console.error(e));
  process.exit(1);
}

artifact.verification_result = "PASS_TEXT_ONLY";
artifact.errors = [];
fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), 'utf8');

console.log("PDF_STATUS: NOT_VERIFIED");
console.log("ACTION2_STATUS: ACTIVE_NOT_DONE");
console.log("=== CASCADE: VERIFY ACTION 2 PASS_TEXT_ONLY ===");
process.exit(0);

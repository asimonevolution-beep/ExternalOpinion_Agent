// Export dei Google Docs (.gdoc) di External Opinion dal Drive -> Markdown nel repo.
//
// Uso:
//   npm run export        -> esporta solo i doc elencati in gdoc-list.json
//   npm run export:all    -> esporta TUTTI i Google Docs/Sheet del Drive in _export_completo/
//
// Prerequisito: credentials.json (OAuth Desktop) nella stessa cartella. Vedi README.md.
// Al primo avvio si apre il browser per autorizzare (sola lettura). Il token resta in token.json.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';
import { authenticate } from '@google-cloud/local-auth';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const CRED_PATH = path.join(HERE, 'credentials.json');
const TOKEN_PATH = path.join(HERE, 'token.json');
const LIST_PATH = path.join(HERE, 'gdoc-list.json');
const OUT_BASE = path.resolve(HERE, '..', '..', 'assets', 'canonical', 'DRIVE_EXTERNALOPINION');

const DOC_MIME = 'application/vnd.google-apps.document';
const SHEET_MIME = 'application/vnd.google-apps.spreadsheet';

// --- Autenticazione OAuth (desktop loopback) ---
function loadSavedCredentialsIfExist() {
  try {
    const credentials = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    return google.auth.fromJSON(credentials);
  } catch {
    return null;
  }
}

function saveCredentials(client) {
  const keys = JSON.parse(fs.readFileSync(CRED_PATH, 'utf8'));
  const key = keys.installed || keys.web;
  fs.writeFileSync(
    TOKEN_PATH,
    JSON.stringify({
      type: 'authorized_user',
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    })
  );
}

async function authorize() {
  if (!fs.existsSync(CRED_PATH)) {
    console.error('\n[ERRORE] Manca credentials.json in ' + HERE);
    console.error('         Segui README.md per crearlo (OAuth Desktop) e riprova.\n');
    process.exit(1);
  }
  let client = loadSavedCredentialsIfExist();
  if (client) return client;
  client = await authenticate({ scopes: SCOPES, keyfilePath: CRED_PATH });
  if (client.credentials) saveCredentials(client);
  return client;
}

// --- Utility ---
function sanitizeFileName(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
}

function escapeForQuery(name) {
  return name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function exportOne(drive, file, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const isSheet = file.mimeType === SHEET_MIME;
  const exportMime = isSheet ? 'text/csv' : 'text/markdown';
  const ext = isSheet ? '.csv' : '.md';
  const outPath = path.join(outDir, sanitizeFileName(file.name) + ext);
  const res = await drive.files.export(
    { fileId: file.id, mimeType: exportMime },
    { responseType: 'arraybuffer' }
  );
  fs.writeFileSync(outPath, Buffer.from(res.data));
  return outPath;
}

async function findByName(drive, name) {
  const q =
    `name = '${escapeForQuery(name)}' and trashed = false and ` +
    `(mimeType = '${DOC_MIME}' or mimeType = '${SHEET_MIME}')`;
  const res = await drive.files.list({
    q,
    fields: 'files(id, name, mimeType, modifiedTime)',
    pageSize: 10,
    spaces: 'drive',
  });
  return res.data.files || [];
}

async function listAllGoogleNative(drive) {
  const out = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `trashed = false and (mimeType = '${DOC_MIME}' or mimeType = '${SHEET_MIME}')`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 1000,
      pageToken,
      spaces: 'drive',
    });
    out.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return out;
}

async function main() {
  const all = process.argv.includes('--all');
  const auth = await authorize();
  const drive = google.drive({ version: 'v3', auth });

  let ok = 0;
  let fail = 0;

  if (all) {
    console.log('Modalita: TUTTI i Google Docs/Sheet del Drive -> _export_completo/');
    const files = await listAllGoogleNative(drive);
    console.log(`Trovati ${files.length} documenti nativi Google.`);
    const outDir = path.join(OUT_BASE, '_export_completo');
    for (const f of files) {
      try {
        const p = await exportOne(drive, f, outDir);
        console.log(`  OK   ${f.name} -> ${path.relative(OUT_BASE, p)}`);
        ok++;
      } catch (e) {
        console.log(`  FAIL ${f.name}: ${e.message}`);
        fail++;
      }
    }
  } else {
    const list = JSON.parse(fs.readFileSync(LIST_PATH, 'utf8'));
    console.log(`Modalita: lista (${list.length} doc da gdoc-list.json)`);
    for (const item of list) {
      try {
        const matches = await findByName(drive, item.name);
        if (matches.length === 0) {
          console.log(`  ASSENTE  "${item.name}" (nessun doc con questo nome esatto)`);
          fail++;
          continue;
        }
        // se ci sono duplicati, esporta il primo e segnala
        const file = matches[0];
        const outDir = path.join(OUT_BASE, item.category, '_da_gdoc');
        const p = await exportOne(drive, file, outDir);
        const dup = matches.length > 1 ? ` (ATTENZIONE: ${matches.length} doc omonimi, esportato il 1o)` : '';
        console.log(`  OK   ${item.category}/_da_gdoc/${path.basename(p)}${dup}`);
        ok++;
      } catch (e) {
        console.log(`  FAIL "${item.name}": ${e.message}`);
        fail++;
      }
    }
  }

  console.log(`\nFatto. Esportati: ${ok}  |  Falliti/assenti: ${fail}`);
  console.log(`Output in: ${OUT_BASE}`);
}

main().catch((e) => {
  console.error('Errore fatale:', e);
  process.exit(1);
});

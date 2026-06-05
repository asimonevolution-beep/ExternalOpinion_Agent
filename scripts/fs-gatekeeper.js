const fs = require('fs');
const path = require('path');

// Caratteri vietati per Netlify/Deploy
const ILLEGAL_CHARS = /[#\s()]/g;

function sanitize(dir) {
  if (!fs.existsSync(dir)) return;
  
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const oldPath = path.join(dir, entry.name);
    
    // Rinomina se il nome contiene caratteri illegali
    if (ILLEGAL_CHARS.test(entry.name)) {
      const newName = entry.name.replace(ILLEGAL_CHARS, '_');
      const newPath = path.join(dir, newName);
      fs.renameSync(oldPath, newPath);
      console.log(`[GATEKEEPER] Sanificato: ${entry.name} -> ${newName}`);
    }

    // Ricorsione
    if (entry.isDirectory()) sanitize(path.join(dir, entry.name));
  });
}

// Target di pulizia: cartelle che contengono file di lavoro
['src', 'docs'].forEach(dir => sanitize(dir));

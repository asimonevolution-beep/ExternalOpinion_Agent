(function () {
  'use strict';

  // Stato
  var state = {
    service: null,
    label: null,
    jobId: null,
    checkoutUrl: null,
    allegati: [],
    // Livello di analisi scelto (07/11/2026): default prima analisi promo 10 €
    tier: 'TIER_1_PROMO_10',
    tierPrezzo: '10',
    tierNome: 'Analisi completa',
  };

  // Scelta del livello di analisi
  document.querySelectorAll('.livello').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.livello').forEach(function (b) { b.classList.remove('sel'); });
      btn.classList.add('sel');
      state.tier       = btn.dataset.tier;
      state.tierPrezzo = btn.dataset.prezzo;
      state.tierNome   = btn.dataset.nome;
    });
  });

  // Refs
  var catBtns      = document.querySelectorAll('.cat-btn');
  var intakeForm   = document.getElementById('intake-form');
  var inputUrl     = document.getElementById('input-url');
  var inputNote    = document.getElementById('input-note');
  var submitBtn    = document.getElementById('submit-btn');
  var loadingState = document.getElementById('loading-state');
  var globalError  = document.getElementById('global-error');
  var confirmPanel = document.getElementById('confirm-panel');
  var catSection   = document.getElementById('cat-section');
  var displayCase  = document.getElementById('display-case-id');
  var copyBtn      = document.getElementById('copy-btn');
  var checkoutBtn  = document.getElementById('checkout-btn');
  var newCaseBtn   = document.getElementById('new-case-btn');
  var step1        = document.getElementById('step-1');
  var step2        = document.getElementById('step-2');
  var step3        = document.getElementById('step-3');

  // Selezione categoria
  catBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      catBtns.forEach(function (b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      state.service = btn.dataset.service;
      state.label   = btn.dataset.label;
      var badge = document.getElementById('tipo-badge');
      if (badge) badge.textContent = state.label;
      intakeForm.classList.add('visible');
      step1.classList.remove('active'); step1.classList.add('done');
      step2.classList.add('active');
      intakeForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  // Documenti caricati dal telefono o dal computer (07/11/2026)
  var MAX_DOC_BYTES = 7 * 1024 * 1024;
  var MAX_DOCS = 8;
  var TIPI_OK = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  state.files = [];
  var inputDocs  = document.getElementById('input-docs');
  var uploadList = document.getElementById('upload-list');

  function tipoFile(f) {
    if (f.type) return f.type.toLowerCase();
    var n = (f.name || '').toLowerCase();
    if (/\.pdf$/.test(n)) return 'application/pdf';
    if (/\.jpe?g$/.test(n)) return 'image/jpeg';
    if (/\.png$/.test(n)) return 'image/png';
    if (/\.hei[cf]$/.test(n)) return 'image/heic';
    return '';
  }
  function renderFiles() {
    uploadList.innerHTML = '';
    state.files.forEach(function (it, i) {
      var li = document.createElement('li');
      var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = it.file.name;
      var st = document.createElement('span'); st.className = 'st' + (it.esito === 'ok' ? ' ok' : it.esito === 'ko' ? ' ko' : '');
      st.textContent = it.stato || (Math.max(1, Math.round(it.file.size / 1024)) + ' KB');
      li.appendChild(nm); li.appendChild(st);
      if (!it.esito) {
        var rm = document.createElement('button'); rm.type = 'button'; rm.textContent = '×'; rm.setAttribute('aria-label', 'Rimuovi ' + it.file.name);
        rm.addEventListener('click', function () { state.files.splice(i, 1); renderFiles(); });
        li.appendChild(rm);
      }
      uploadList.appendChild(li);
    });
  }
  if (inputDocs) {
    inputDocs.addEventListener('change', function () {
      globalError.classList.remove('visible');
      Array.prototype.forEach.call(inputDocs.files, function (f) {
        if (state.files.length >= MAX_DOCS) { globalError.textContent = 'Puoi caricare al massimo ' + MAX_DOCS + ' documenti.'; globalError.classList.add('visible'); return; }
        if (TIPI_OK.indexOf(tipoFile(f)) === -1) { globalError.textContent = '"' + f.name + '": carica un PDF o una foto (JPG, PNG).'; globalError.classList.add('visible'); return; }
        if (f.size > MAX_DOC_BYTES) { globalError.textContent = '"' + f.name + '" supera 7 MB: caricane una versione più leggera.'; globalError.classList.add('visible'); return; }
        if (state.files.some(function (x) { return x.file.name === f.name && x.file.size === f.size; })) return;
        state.files.push({ file: f });
      });
      inputDocs.value = '';
      if (state.files.length) showFieldError('field-url', 'error-url', false);
      renderFiles();
    });
  }
  function leggiBase64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).replace(/^data:[^,]*,/, '')); };
      r.onerror = function () { reject(new Error('Lettura del file non riuscita')); };
      r.readAsDataURL(file);
    });
  }
  // Carica i file uno alla volta sulla richiesta appena creata
  function caricaDocumenti(jobId) {
    var caricati = 0;
    return state.files.reduce(function (p, it) {
      return p.then(function () {
        it.stato = 'caricamento…'; renderFiles();
        return leggiBase64(it.file).then(function (b64) {
          return fetch('/api/jobs/' + encodeURIComponent(jobId) + '/documents', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: it.file.name, tipo: tipoFile(it.file), dati: b64 }),
          });
        }).then(function (res) {
          return res.json().then(function (d) {
            if (!res.ok || !d.success) throw new Error(d.error || 'Caricamento non riuscito');
            it.esito = 'ok'; it.stato = 'caricato ✓'; caricati++;
          });
        }).catch(function (err) {
          it.esito = 'ko'; it.stato = 'non caricato'; it.errore = err.message;
        }).then(renderFiles);
      });
    }, Promise.resolve()).then(function () { return caricati; });
  }

  // Validazione
  function validateUrl(val) {
    try { new URL(val); return true; } catch (_) { return false; }
  }
  function validateContact(val) {
    return val && val.trim().length >= 5;
  }

  function showFieldError(fieldId, errorId, show) {
    var f = document.getElementById(fieldId);
    var e = document.getElementById(errorId);
    if (show) { f.classList.add('has-error'); e.style.display = 'block'; }
    else       { f.classList.remove('has-error'); e.style.display = 'none'; }
  }

  function clearErrors() {
    showFieldError('field-url', 'error-url', false);
    showFieldError('field-name', 'error-name', false);
    showFieldError('field-email', 'error-email', false);
    showFieldError('field-phone', 'error-phone', false);
    globalError.classList.remove('visible');
  }

  // Submit
  submitBtn.addEventListener('click', function () {
    clearErrors();

    var urlVal     = inputUrl.value.trim();
    var nameVal    = document.getElementById('input-name').value.trim();
    var companyVal = document.getElementById('input-company').value.trim();
    var emailVal   = document.getElementById('input-email').value.trim();
    var phoneVal   = document.getElementById('input-phone').value.trim();
    var noteVal    = inputNote.value.trim();
    var valid      = true;

    // Link oppure documenti: basta uno dei due
    if (urlVal ? !validateUrl(urlVal) : !state.files.length) {
      showFieldError('field-url', 'error-url', true);
      valid = false;
    }
    if (nameVal.length < 2) {
      showFieldError('field-name', 'error-name', true);
      valid = false;
    }
    var emailOk = !emailVal || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);
    var phoneOk = !phoneVal || phoneVal.replace(/\D/g, '').length >= 7;
    if ((!emailVal && !phoneVal) || !emailOk) {
      showFieldError('field-email', 'error-email', true);
      valid = false;
    }
    if ((!emailVal && !phoneVal) || !phoneOk) {
      showFieldError('field-phone', 'error-phone', true);
      valid = false;
    }
    if (!state.service) {
      globalError.textContent = 'Seleziona un tipo di caso prima di procedere.';
      globalError.classList.add('visible');
      valid = false;
    }
    if (!valid) return;

    var payload = {
      urlAsta:  urlVal || null,
      documentiInArrivo: state.files.length,
      nome:     nameVal,
      ragioneSociale: companyVal || null,
      email:    emailVal || null,
      telefono: phoneVal || null,
      service:  state.service,
      tier:     state.tier,
      deferUntilPayment: true,
      zonaDati: {
        categoria:          state.label,
        note:               noteVal || null,
        telefono:           phoneVal || null,
        documentiCaricati:  state.files.length || null,
        source:             'quick-intake',
      },
    };

    submitBtn.disabled = true;
    loadingState.classList.add('visible');

    fetch('/api/analyze', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data }; }); })
    .then(function (result) {
      if (!result.data.success && result.status >= 400) {
        loadingState.classList.remove('visible');
        submitBtn.disabled = false;
        var msg = result.data.error || 'Errore durante la creazione del caso. Riprova tra qualche istante.';
        globalError.textContent = msg;
        globalError.classList.add('visible');
        return;
      }

      var jobId = result.data.jobId;
      state.jobId = jobId;

      return caricaDocumenti(jobId).then(function (nCaricati) {
        state.docCaricati = nCaricati;
        var falliti = state.files.filter(function (x) { return x.esito === 'ko'; });
        if (!urlVal && nCaricati === 0) {
          throw new Error('Nessun documento è stato caricato: ' + (falliti[0] && falliti[0].errore || 'riprova'));
        }
      }).then(function () { return fetch('/api/jobs/' + encodeURIComponent(jobId) + '/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: state.tier, email: emailVal || null })
      }).then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok || !data.checkoutUrl) throw new Error(data.error || 'Checkout non disponibile');
          return { jobId: jobId, checkout: data };
        });
      }); })
      .then(function (res2) {
        loadingState.classList.remove('visible');
        submitBtn.disabled = false;

        var shortId = res2.jobId ? res2.jobId.toString().slice(0, 8) : 'XXXXXXXX';

        displayCase.textContent = 'EO-' + shortId.toUpperCase();
        document.getElementById('summary-tipo').textContent    = state.label || '—';
        document.getElementById('summary-url').textContent     = urlVal ? (urlVal.length > 50 ? urlVal.slice(0, 50) + '…' : urlVal) : 'nessuno (solo documenti)';
        var nonCaricati = state.files.filter(function (x) { return x.esito === 'ko'; }).map(function (x) { return x.file.name; });
        document.getElementById('summary-docs').textContent = state.docCaricati
          ? state.docCaricati + (state.docCaricati === 1 ? ' documento caricato' : ' documenti caricati') +
            (nonCaricati.length ? ' · non caricati: ' + nonCaricati.join(', ') : '') + '.'
          : 'Nessun documento caricato.';
        document.getElementById('summary-contact').textContent = emailVal || phoneVal;

        // Riepilogo coerente con il livello scelto: prezzo mostrato = prezzo addebitato
        var promo = state.tier === 'TIER_1_PROMO_10';
        document.getElementById('summary-livello').textContent =
          promo ? "l'analisi completa" : 'il livello ' + state.tierNome;
        document.getElementById('summary-tempi').textContent = promo ? '24–48 ore' : '48–72 ore';
        document.getElementById('summary-prezzo').innerHTML = promo
          ? '<span style="text-decoration:line-through;opacity:.55;">€69</span>' +
            '<strong style="color:var(--gold-bright);font-size:20px;margin-left:6px;">€10</strong>' +
            '<span style="opacity:.7;font-size:12px;margin-left:6px;">promo di lancio</span>'
          : '<strong style="color:var(--gold-bright);font-size:20px;">€' + state.tierPrezzo + '</strong>' +
            '<span style="opacity:.7;font-size:12px;margin-left:6px;">' + state.tierNome + '</span>';

        if (res2.checkout && res2.checkout.checkoutUrl) {
          checkoutBtn.href        = res2.checkout.checkoutUrl;
          checkoutBtn.textContent = 'Procedi al pagamento →';
        } else {
          // La landing non esiste più: senza link di pagamento si contatta Simone
          checkoutBtn.href        = 'mailto:info@externalopinion.it?subject=' + encodeURIComponent('Caso EO-' + shortId.toUpperCase());
          checkoutBtn.textContent = 'Pagamento non disponibile: scrivici →';
          checkoutBtn.title       = 'Indica il codice caso nella mail';
        }

        intakeForm.classList.remove('visible');
        catSection.style.display = 'none';
        document.getElementById('steps').style.display = 'none';
        confirmPanel.classList.add('visible');
      });
    })
    .catch(function (err) {
      loadingState.classList.remove('visible');
      submitBtn.disabled = false;
      globalError.textContent = (err && /documento|Checkout/.test(err.message))
        ? err.message
        : 'Connessione non riuscita. Verifica la connessione e riprova.';
      globalError.classList.add('visible');
      console.error('[QuickIntake]', err);
    });
  });

  // Copia caseId
  copyBtn.addEventListener('click', function () {
    var text = displayCase.textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () {
        copyBtn.textContent = 'Copiato!';
        setTimeout(function () { copyBtn.textContent = 'Copia codice'; }, 2000);
      });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      copyBtn.textContent = 'Copiato!';
      setTimeout(function () { copyBtn.textContent = 'Copia codice'; }, 2000);
    }
  });

  // Nuovo caso
  newCaseBtn.addEventListener('click', function () {
    state = { service: null, label: null, jobId: null, checkoutUrl: null };
    catBtns.forEach(function (b) { b.classList.remove('selected'); });
    inputUrl.value = ''; inputNote.value = '';
    document.getElementById('input-name').value = '';
    document.getElementById('input-company').value = '';
    document.getElementById('input-email').value = '';
    document.getElementById('input-phone').value = '';
    clearErrors();
    intakeForm.classList.remove('visible');
    catSection.style.display = '';
    document.getElementById('steps').style.display = '';
    confirmPanel.classList.remove('visible');
    step1.classList.add('active'); step1.classList.remove('done');
    step2.classList.remove('active'); step2.classList.remove('done');
    step3.classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

})();

/* ===== V2: interazioni semaforo e statistiche ===== */
(function () {
  var pop = document.getElementById('stage-pop');
  var popT = document.getElementById('pop-t');
  var popB = document.getElementById('pop-b');
  var VERDETTI = {
    verde:  { t: 'VERDETTO VERDE',  b: 'Nessuna criticità rilevante emersa dallo screening documentale e di mercato.' },
    giallo: { t: 'VERDETTO GIALLO', b: 'Criticità presenti che richiedono approfondimento prima di muovere soldi. Il dettaglio è nel report completo.' },
    rosso:  { t: 'VERDETTO ROSSO',  b: 'Criticità gravi rilevate. Il report completo documenta ogni rischio con riferimenti verificabili.' }
  };
  var open = null;
  function show(cls, t, b, btn) {
    document.querySelectorAll('.hot.verdetto, .hot.stat').forEach(function (x) { x.classList.remove('open'); });
    if (open === btn) { pop.classList.remove('visible'); open = null; return; }
    pop.className = 'visible ' + cls; pop.id = 'stage-pop';
    popT.textContent = t; popB.textContent = b;
    btn.classList.add('open'); open = btn;
  }
  document.querySelectorAll('.hot.verdetto').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var v = VERDETTI[btn.dataset.v];
      show('v-' + btn.dataset.v, v.t, v.b, btn);
    });
  });
  document.querySelectorAll('.hot.stat').forEach(function (btn) {
    btn.addEventListener('click', function () {
      show('v-oro', 'DATO DI MERCATO', 'Dettaglio e fonte disponibili nel report completo.', btn);
    });
  });
})();

(function () {
  'use strict';

  // Stato
  var state = {
    service: null,
    label: null,
    jobId: null,
    checkoutUrl: null,
    allegati: [],
  };

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

  // Chip documenti disponibili
  document.querySelectorAll('.a-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      chip.classList.toggle('sel');
      var doc = chip.dataset.doc;
      var i = state.allegati.indexOf(doc);
      if (i === -1) { state.allegati.push(doc); }
      else          { state.allegati.splice(i, 1); }
    });
  });

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

    if (!validateUrl(urlVal)) {
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
      urlAsta:  urlVal,
      nome:     nameVal,
      ragioneSociale: companyVal || null,
      email:    emailVal || null,
      telefono: phoneVal || null,
      service:  state.service,
      tier:     'TIER_1_PROMO_10',
      deferUntilPayment: true,
      zonaDati: {
        categoria:          state.label,
        note:               noteVal || null,
        telefono:           phoneVal || null,
        allegatiDichiarati: state.allegati.length ? state.allegati.slice() : null,
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

      return fetch('/api/jobs/' + encodeURIComponent(jobId) + '/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'TIER_1_PROMO_10', email: emailVal || null })
      }).then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok || !data.checkoutUrl) throw new Error(data.error || 'Checkout non disponibile');
          return { jobId: jobId, checkout: data };
        });
      })
      .then(function (res2) {
        loadingState.classList.remove('visible');
        submitBtn.disabled = false;

        var shortId = res2.jobId ? res2.jobId.toString().slice(0, 8) : 'XXXXXXXX';

        displayCase.textContent = 'EO-' + shortId.toUpperCase();
        document.getElementById('summary-tipo').textContent    = state.label || '—';
        document.getElementById('summary-url').textContent     = urlVal.length > 50 ? urlVal.slice(0, 50) + '…' : urlVal;
        document.getElementById('summary-contact').textContent = emailVal || phoneVal;

        if (res2.checkout && res2.checkout.checkoutUrl) {
          checkoutBtn.href        = res2.checkout.checkoutUrl;
          checkoutBtn.textContent = 'Procedi al pagamento →';
        } else {
          checkoutBtn.href        = '/landing.html#piani';
          checkoutBtn.textContent = 'Scegli il piano (indica codice caso) →';
          checkoutBtn.title       = 'Copia il codice caso e indicalo nel pagamento';
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
      globalError.textContent = 'Connessione non riuscita. Verifica la connessione e riprova.';
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

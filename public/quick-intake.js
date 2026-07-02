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
  var inputContact = document.getElementById('input-contact');
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
    showFieldError('field-contact', 'error-contact', false);
    globalError.classList.remove('visible');
  }

  // Submit
  submitBtn.addEventListener('click', function () {
    clearErrors();

    var urlVal     = inputUrl.value.trim();
    var contactVal = inputContact.value.trim();
    var noteVal    = inputNote.value.trim();
    var valid      = true;

    if (!validateUrl(urlVal)) {
      showFieldError('field-url', 'error-url', true);
      valid = false;
    }
    if (!validateContact(contactVal)) {
      showFieldError('field-contact', 'error-contact', true);
      valid = false;
    }
    if (!state.service) {
      globalError.textContent = 'Seleziona un tipo di caso prima di procedere.';
      globalError.classList.add('visible');
      valid = false;
    }
    if (!valid) return;

    var isEmail = contactVal.indexOf('@') !== -1;
    var emailForCheckout = isEmail ? contactVal : '';

    var payload = {
      urlAsta:  urlVal,
      email:    contactVal,
      service:  state.service,
      tier:     'TIER_1_CASCADE_79',
      zonaDati: {
        categoria:          state.label,
        note:               noteVal || null,
        telefono:           !isEmail ? contactVal : null,
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

      // Payment Link Stripe live 10 EUR — client_reference_id = caseId
      return Promise.resolve({ jobId: jobId, checkout: { checkoutUrl: 'https://buy.stripe.com/6oUeV54fFbZ16jdfJ9ffy06?client_reference_id=' + encodeURIComponent(jobId) } });
      /* checkout API legacy disattivato
      return fetch('/api/jobs/' + jobId + '/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tier: 'TIER_1_CASCADE_79', email: emailForCheckout }),
      })
      .then(function (r) { return r.json().then(function (d) { return { jobId: jobId, checkout: d }; }); })
      .catch(function () { return { jobId: jobId, checkout: null }; })
      legacy end */
      .then(function (res2) {
        loadingState.classList.remove('visible');
        submitBtn.disabled = false;

        var shortId = res2.jobId ? res2.jobId.toString().slice(0, 8) : 'XXXXXXXX';

        displayCase.textContent = 'EO-' + shortId.toUpperCase();
        document.getElementById('summary-tipo').textContent    = state.label || '—';
        document.getElementById('summary-url').textContent     = urlVal.length > 50 ? urlVal.slice(0, 50) + '…' : urlVal;
        document.getElementById('summary-contact').textContent = contactVal;

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
    inputUrl.value = ''; inputContact.value = ''; inputNote.value = '';
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

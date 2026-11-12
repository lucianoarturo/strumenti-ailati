// La chiave personale sta dopo il # dell'indirizzo: il browser non la manda a nessun server,
// nemmeno a GitHub che ospita la pagina.
var CHIAVE = (location.hash.match(/[a-f0-9]{40}/) || [''])[0];
var K = { k: CHIAVE, t: leggiAccesso() };

function leggiAccesso() { try { return localStorage.getItem('accesso_' + CHIAVE) || ''; } catch (e) { return ''; } }
function salvaAccesso(t) { try { localStorage.setItem('accesso_' + CHIAVE, t); } catch (e) {} }
var PEZZO = 4 * 1024 * 1024;   // multiplo di 256 KB, come chiede Drive
var DATI = null;
var NUOVO = '__nuovo__';

function el(tag, attr, figli) {
  var e = document.createElement(tag);
  if (attr) Object.keys(attr).forEach(function (a) {
    if (a === 'testo') e.textContent = attr[a];
    else if (a === 'classe') e.className = attr[a];
    else if (a === 'click') e.addEventListener('click', attr[a]);
    else e.setAttribute(a, attr[a]);
  });
  (figli || []).forEach(function (f) { if (f) e.appendChild(typeof f === 'string' ? document.createTextNode(f) : f); });
  return e;
}

// Le chiamate vanno allo sportello Apps Script con fetch, senza cookie: cosi' non conta quale
// account Google e' aperto nel browser.
var URL_SPORTELLO = 'https://script.google.com/macros/s/AKfycbxo7F2IxF3FACKdedIR9fzY5gmwPnf1j5L77NZJ4djBQflsh0Ghb4-WCgrpbAHnq1o7/exec';

function chiama(nome) {
  var argomenti = Array.prototype.slice.call(arguments, 1);
  return fetch(URL_SPORTELLO, {
    method: 'POST', credentials: 'omit', redirect: 'follow',
    body: JSON.stringify({ pagina: nome, argomenti: argomenti })
  }).then(function (r) {
    if (!r.ok) throw new Error('Il collegamento non ha risposto (' + r.status + '): riprova tra poco.');
    return r.json();
  }, function () {
    throw new Error('Collegamento non riuscito: controlla la connessione e riprova.');
  }).then(function (d) {
    if (d.ok) return d.risultato;
    var testo = String(d.error || 'errore').replace(/^Error:\s*/, '');
    if (testo.indexOf('ACCESSO_SCADUTO') >= 0) { mostraEntra(); testo = 'Accesso scaduto: chiedi un nuovo codice qui sopra.'; }
    throw new Error(testo);
  });
}

function messaggio(contenitore, tipo, testo) {
  var c = document.getElementById(contenitore);
  c.innerHTML = '';
  if (testo) c.appendChild(el('div', { classe: 'messaggio ' + tipo, testo: testo }));
}

function data(ms) {
  var d = new Date(ms);
  return d.toLocaleDateString('it-IT') + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

// ------------------------------------------------------------------ avvio

function mostraEntra() {
  ['nuova', 'elenco', 'caricamento'].forEach(function (id) { document.getElementById(id).classList.add('nascosto'); });
  document.getElementById('entra').classList.remove('nascosto');
}

if (!CHIAVE) erroreAvvio(new Error('Link incompleto: usa il link personale che ti ha mandato Luciano.'));
else chiama('pStatoAccesso', K).then(function (s) {
  if (s.ok) return avvio();
  document.getElementById('email-mascherata').textContent = s.email;
  mostraEntra();
  if (s.codiceInAttesa) {
    // Pagina ricaricata dopo aver chiesto il codice: la casella resta disponibile.
    document.getElementById('chiedi-codice').classList.add('nascosto');
    document.getElementById('campo-codice').classList.remove('nascosto');
    messaggio('esito-entra', 'info', 'Ti ho già mandato un codice: scrivilo qui sotto, oppure chiedine un altro.');
  }
}).catch(erroreAvvio);

function chiediCodice() {
  var b = document.getElementById('chiedi-codice');
  b.disabled = true;
  messaggio('esito-entra', 'info', 'Mando il codice…');
  chiama('pInviaCodice', K).then(function (r) {
    messaggio('esito-entra', 'ok', 'Codice mandato a ' + r.email + '. Vale 10 minuti.');
    b.classList.add('nascosto');
    document.getElementById('campo-codice').classList.remove('nascosto');
    document.getElementById('codice').focus();
  }).catch(function (err) { messaggio('esito-entra', 'errore', err.message); })
    .then(function () { b.disabled = false; });
}
document.getElementById('chiedi-codice').addEventListener('click', chiediCodice);
document.getElementById('rimanda').addEventListener('click', chiediCodice);
document.getElementById('entra-con-codice').addEventListener('click', entra);
document.getElementById('codice').addEventListener('keydown', function (e) { if (e.key === 'Enter') entra(); });

function entra() {
  var b = document.getElementById('entra-con-codice');
  b.disabled = true;
  chiama('pVerificaCodice', K, document.getElementById('codice').value).then(function (r) {
    K.t = r.t;
    salvaAccesso(r.t);
    messaggio('esito-entra', '', '');
    document.getElementById('entra').classList.add('nascosto');
    document.getElementById('caricamento').classList.remove('nascosto');
    return avvio();
  }).catch(function (err) { messaggio('esito-entra', 'errore', err.message); })
    .then(function () { b.disabled = false; });
}

function erroreAvvio(err) {
  document.getElementById('caricamento').className = 'messaggio errore';
  document.getElementById('caricamento').textContent = err.message;
}

function avvio() {
 return chiama('pAvvio', K).then(function (d) {
  DATI = d;
  document.getElementById('saluto').textContent = 'Ciao ' + d.firma + ' · ' + d.cliente;
  var s = document.getElementById('progetto');
  d.progetti.forEach(function (p) { s.appendChild(el('option', { value: p.id, testo: p.nome })); });
  s.appendChild(el('option', { value: NUOVO, testo: '+ Apri un nuovo progetto' }));
  var ultimo = null;
  try { ultimo = localStorage.getItem('progetto'); } catch (e) {}
  if (ultimo && d.progetti.some(function (p) { return p.id === ultimo; })) s.value = ultimo;
  document.getElementById('caricamento').classList.add('nascosto');
  document.getElementById('nuova').classList.remove('nascosto');
  document.getElementById('elenco').classList.remove('nascosto');
  cambiaProgetto();
 }).catch(erroreAvvio);
}

document.getElementById('progetto').addEventListener('change', cambiaProgetto);
document.getElementById('aggiorna').addEventListener('click', caricaElenco);
document.getElementById('invia').addEventListener('click', invia);

function progettoScelto() { return document.getElementById('progetto').value; }

function cambiaProgetto() {
  var nuovo = progettoScelto() === NUOVO;
  document.getElementById('campi-progetto').classList.toggle('nascosto', nuovo);
  document.getElementById('campi-nuovo').classList.toggle('nascosto', !nuovo);
  messaggio('esito-invio', '', '');
  if (!nuovo) { try { localStorage.setItem('progetto', progettoScelto()); } catch (e) {} }
  caricaElenco();
}

// ------------------------------------------------------------------ richieste e file

function caricaElenco() {
  var id = progettoScelto() === NUOVO ? DATI.radiceId : progettoScelto();
  var r = document.getElementById('richieste');
  var f = document.getElementById('file');
  r.innerHTML = '';
  f.innerHTML = '';
  r.appendChild(el('div', { classe: 'messaggio info', testo: 'Leggo le richieste…' }));
  chiama('pProgetto', K, id).then(function (p) {
    document.getElementById('titolo-elenco').textContent = p.generali ? 'Richieste generali (nuovi progetti)' : 'Richieste e risposte — ' + p.nome;
    r.innerHTML = '';
    if (!p.richieste.length) r.appendChild(el('p', { classe: 'aiuto', testo: 'Ancora nessuna richiesta.' }));
    p.richieste.forEach(function (q, i) { r.appendChild(disegnaRichiesta(q, i === 0)); });
    p.file.forEach(function (gruppo) { f.appendChild(disegnaCartella(gruppo)); });
  }).catch(function (err) {
    r.innerHTML = '';
    r.appendChild(el('div', { classe: 'messaggio errore', testo: err.message }));
  });
}

function disegnaRichiesta(q, aperta) {
  var box = el('div', { classe: 'richiesta' }, [
    el('div', { classe: 'testa' }, [
      el('span', { testo: q.numero ? 'Richiesta ' + q.numero : q.titolo }),
      el('span', { classe: 'stato ' + q.stato.codice, testo: q.stato.testo })
    ])
  ]);
  var testo = el('details', aperta ? { open: '' } : null, [
    el('summary', { testo: 'Cosa è stato chiesto' }),
    el('div', { classe: 'testo-richiesta', testo: q.testo.replace(/\n?PRONTA\s*$/i, '').trim() })
  ]);
  box.appendChild(testo);
  if (q.risposte.length) {
    var r = el('div', { classe: 'risposta' });
    var lista = null;
    q.risposte.forEach(function (b) {
      if (b.tipo !== 'voce') lista = null;
      if (b.tipo === 'titolo') r.appendChild(el('h3', { testo: testoDi(b) }));
      else if (b.tipo === 'sottotitolo') r.appendChild(el('p', null, [el('strong', null, pezzi(b))]));
      else if (b.tipo === 'voce') {
        if (!lista) { lista = el('ul'); r.appendChild(lista); }
        lista.appendChild(el('li', null, pezzi(b)));
      } else if (b.tipo === 'tabella') {
        var t = el('table');
        b.righe.forEach(function (riga) { t.appendChild(el('tr', null, riga.map(function (c) { return el('td', { testo: c }); }))); });
        r.appendChild(el('div', { classe: 'tabella' }, [t]));
      } else r.appendChild(el('p', null, pezzi(b)));
    });
    box.appendChild(el('details', aperta ? { open: '' } : null, [el('summary', { testo: 'Risposta' }), r]));
  }
  return box;
}

function testoDi(b) { return (b.parti || []).map(function (p) { return p.t; }).join(''); }

function pezzi(b) {
  var out = [];
  (b.parti || []).forEach(function (p) {
    if (p.fileId) {
      out.push(el('strong', { testo: p.t }));
      pulsantiFile(p.fileId, p.fileTipo, p.fileNome).forEach(function (x) { out.push(x); });
    } else if (p.link) {
      out.push(el('a', { href: p.link, target: '_blank', rel: 'noopener', testo: p.t }));
    } else out.push(p.t);
  });
  return out;
}

function pulsantiFile(id, tipo, nome) {
  if (tipo === 'doc') return [
    el('button', { classe: 'piccolo', testo: 'Word', click: function (e) { scarica(e.target, id, 'docx'); } }),
    el('button', { classe: 'piccolo', testo: 'PDF', click: function (e) { scarica(e.target, id, 'pdf'); } })
  ];
  if (tipo === 'foglio') return [el('button', { classe: 'piccolo', testo: 'Excel', click: function (e) { scarica(e.target, id, 'xlsx'); } })];
  return [el('button', { classe: 'piccolo', testo: 'Scarica', click: function (e) { scarica(e.target, id, ''); } })];
}

function disegnaCartella(g) {
  var box = el('div', null, [el('h3', { testo: g.cartella })]);
  if (!g.elementi.length) box.appendChild(el('p', { classe: 'aiuto', testo: 'Vuota.' }));
  g.elementi.forEach(function (f) {
    box.appendChild(el('div', { classe: 'file' }, [
      el('div', null, [el('div', { testo: f.nome }), el('div', { classe: 'data', testo: data(f.modificato) })]),
      el('div', null, pulsantiFile(f.id, f.tipo, f.nome))
    ]));
  });
  return box;
}

function scarica(pulsante, id, formato) {
  var prima = pulsante.textContent;
  pulsante.disabled = true;
  pulsante.textContent = '…';
  chiama('pScarica', K, id, formato).then(function (r) {
    var b = atob(r.base64);
    var byte = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) byte[i] = b.charCodeAt(i);
    var url = URL.createObjectURL(new Blob([byte], { type: r.mime }));
    var a = el('a', { href: url, download: r.nome });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 2000);
  }).catch(function (err) {
    alert(err.message);
  }).then(function () {
    pulsante.disabled = false;
    pulsante.textContent = prima;
  });
}

// ------------------------------------------------------------------ invio

function leggiPezzo(file, inizio, fine) {
  return new Promise(function (ok, ko) {
    var r = new FileReader();
    r.onload = function () { ok(String(r.result).split(',')[1] || ''); };
    r.onerror = function () { ko(new Error('Non riesco a leggere il file ' + file.name + '. Di solito succede se il file è aperto in un altro programma (per esempio Excel) o se è stato modificato dopo averlo scelto: chiudilo, sceglilo di nuovo e riprova. Se il file sta in una cartella di rete o su OneDrive, copialo prima sul desktop.')); };
    r.readAsDataURL(file.slice(inizio, fine));
  });
}

function caricaFile(progetto, file, tipo, avanzamento) {
  return chiama('pIniziaCaricamento', K, progetto, file.name, file.type, file.size, tipo).then(function (s) {
    var inizio = 0;
    function prossimo() {
      var fine = Math.min(inizio + PEZZO, file.size);
      avanzamento(Math.round(inizio / file.size * 100));
      return leggiPezzo(file, inizio, fine).then(function (b64) {
        return chiama('pCaricaPezzo', K, s.sessione, b64, inizio);
      }).then(function (r) {
        inizio = fine;
        if (r.fatto) return s.nome;
        if (inizio >= file.size) throw new Error('Caricamento di ' + file.name + ' non concluso: riprova.');
        return prossimo();
      });
    }
    return prossimo();
  });
}

function invia() {
  var pulsante = document.getElementById('invia');
  var progetto = progettoScelto();
  var testo, cartella, daCaricare = [];
  if (progetto === NUOVO) {
    var prodotto = document.getElementById('n-prodotto').value.trim();
    if (!prodotto) return messaggio('esito-invio', 'errore', 'Scrivi il nome del prodotto.');
    var note = document.getElementById('n-note').value.trim();
    testo = 'Apri un nuovo progetto.\nProdotto: ' + prodotto + '\nTipo di documento: ' + document.getElementById('n-tipo').value + (note ? '\nNote: ' + note : '');
    cartella = DATI.radiceId;
  } else {
    testo = document.getElementById('testo').value.trim();
    if (!testo) return messaggio('esito-invio', 'errore', 'Scrivi cosa vuoi che faccia.');
    cartella = progetto;
    [['f-bozza', 'bozza'], ['f-correzioni', 'correzioni'], ['f-fonti', 'fonte']].forEach(function (c) {
      Array.prototype.forEach.call(document.getElementById(c[0]).files, function (f) { daCaricare.push({ file: f, tipo: c[1] }); });
    });
  }
  pulsante.disabled = true;
  var caricati = [];
  var catena = Promise.resolve();
  daCaricare.forEach(function (x, i) {
    catena = catena.then(function () {
      return caricaFile(cartella, x.file, x.tipo, function (perc) {
        messaggio('esito-invio', 'info', 'Carico ' + x.file.name + ' (' + (i + 1) + ' di ' + daCaricare.length + '): ' + perc + '%');
      }).then(function (nome) { caricati.push(nome); });
    });
  });
  catena.then(function () {
    messaggio('esito-invio', 'info', 'Invio la richiesta…');
    return chiama('pInviaRichiesta', K, cartella, testo, caricati);
  }).then(function (r) {
    messaggio('esito-invio', 'ok', 'Richiesta ' + r.numero + ' inviata. Riceverai un\'email quando è pronta; di solito ci vuole meno di mezz\'ora.');
    ['testo', 'n-prodotto', 'n-note', 'f-bozza', 'f-correzioni', 'f-fonti'].forEach(function (id) { document.getElementById(id).value = ''; });
    caricaElenco();
  }).catch(function (err) {
    var gia = caricati.length ? ' I file già caricati sono in 01-Fonti: ' + caricati.join(', ') + '. Per riprovare, non serve ricaricarli: citali nel testo.' : '';
    messaggio('esito-invio', 'errore', err.message + gia);
  }).then(function () { pulsante.disabled = false; });
}

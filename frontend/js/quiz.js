/* ============================================================
   js/quiz.js
   Logica della pagina quiz — gestisce tre viste distinte:
   1. lista quiz — mostra tutti i quiz dell'utente
   2. dettaglio quiz — mostra le domande e permette di aggiungerne
   3. esecuzione quiz — modalità studio con punteggio finale
   ============================================================ */


/* ------------------------------------------------------------
   PROTEZIONE PAGINA E INIZIALIZZAZIONE NAVBAR
   ------------------------------------------------------------ */
if (!localStorage.getItem('token')) {
    window.location.href = 'index.html';
}

const nome     = localStorage.getItem('nome') || 'Utente';
const iniziali = nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

document.getElementById('user-avatar').textContent   = iniziali;
document.getElementById('dropdown-name').textContent = nome;

document.querySelectorAll('.navbar-link').forEach(link => {
    if (link.dataset.page === 'quiz') link.classList.add('active');
});

document.getElementById('user-avatar').addEventListener('click', (e) => {
    e.stopPropagation();
    const dd = document.getElementById('user-dropdown');
    dd.hidden = !dd.hidden;
});

document.addEventListener('click', () => {
    document.getElementById('user-dropdown').hidden = true;
});

document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('nome');
    window.location.href = 'index.html';
});


/* ------------------------------------------------------------
   STATO DELL'APPLICAZIONE
   quizCorrente e domandeCorrente tengono i dati del quiz
   aperto nel dettaglio — servono sia per la vista dettaglio
   che per l'esecuzione del quiz.
   Le variabili di esecuzione tengono traccia della domanda
   corrente e del punteggio durante il quiz.
   ------------------------------------------------------------ */
let tuttiIQuiz      = [];
let tutteLeMaterie  = [];
let quizCorrente    = null;  /* oggetto quiz aperto nel dettaglio */
let domandeCorrente = [];    /* domande del quiz corrente */
let quizEliminaId   = null;

/* Variabili di esecuzione quiz */
let domandeQuiz     = [];    /* domande mescolate per l'esecuzione */
let indiceDomanda   = 0;     /* indice domanda corrente */
let risposteCorrette = 0;    /* contatore risposte corrette */
let rispostaConfermata = false; /* impedisce di cambiare risposta dopo la conferma */


/* ------------------------------------------------------------
   SELEZIONE ELEMENTI DOM
   ------------------------------------------------------------ */

/* Viste */
const vistaLista    = document.getElementById('vista-lista');
const vistaDettaglio = document.getElementById('vista-dettaglio');
const vistaQuiz     = document.getElementById('vista-quiz');

/* Vista lista */
const quizLoading   = document.getElementById('quiz-loading');
const quizGrid      = document.getElementById('quiz-grid');
const quizEmpty     = document.getElementById('quiz-empty');
const btnNuovoQuiz  = document.getElementById('btn-nuovo-quiz');

/* Vista dettaglio */
const btnTornaLista    = document.getElementById('btn-torna-lista');
const btnIniziaQuiz    = document.getElementById('btn-inizia-quiz');
const btnEliminaQuiz   = document.getElementById('btn-elimina-quiz');
const dettaglioTitolo  = document.getElementById('dettaglio-titolo');
const dettaglioMateria = document.getElementById('dettaglio-materia');
const dettaglioCount   = document.getElementById('dettaglio-count');
const domandeLoading   = document.getElementById('domande-loading');
const domandeList      = document.getElementById('domande-list');
const domandeEmpty     = document.getElementById('domande-empty');
const btnNuovaDomanda  = document.getElementById('btn-nuova-domanda');

/* Vista esecuzione */
const progressFill      = document.getElementById('progress-fill');
const progressLabel     = document.getElementById('progress-label');
const domandaCard       = document.getElementById('domanda-card');
const domandaNumero     = document.getElementById('domanda-numero');
const domandaTesto      = document.getElementById('domanda-testo');
const quizOpzioni       = document.getElementById('quiz-opzioni');
const rispostaApertaWrap = document.getElementById('risposta-aperta-wrap');
const rispostaAperta    = document.getElementById('risposta-aperta');
const btnConfermaRisposta = document.getElementById('btn-conferma-risposta');
const btnQuizAnnulla    = document.getElementById('btn-quiz-annulla');
const risultatoCard     = document.getElementById('risultato-card');
const risultatoIcona    = document.getElementById('risultato-icona');
const risultatoTitolo   = document.getElementById('risultato-titolo');
const risultatoTesto    = document.getElementById('risultato-testo');
const btnProssimaDomanda = document.getElementById('btn-prossima-domanda');
const finaleCard        = document.getElementById('finale-card');
const finaleIcona       = document.getElementById('finale-icona');
const finaleScore       = document.getElementById('finale-score');
const finaleTesto       = document.getElementById('finale-testo');
const btnRiprova        = document.getElementById('btn-riprova');
const btnTornaDettaglio = document.getElementById('btn-torna-dettaglio');

/* Modal quiz */
const modalQuiz        = document.getElementById('modal-quiz');
const modalQuizClose   = document.getElementById('modal-quiz-close');
const btnQuizAnnullaModal = document.getElementById('btn-quiz-annulla-modal');
const formQuiz         = document.getElementById('form-quiz');
const quizTitolo       = document.getElementById('quiz-titolo');
const quizMateria      = document.getElementById('quiz-materia');

/* Modal domanda */
const modalDomanda      = document.getElementById('modal-domanda');
const modalDomandaClose = document.getElementById('modal-domanda-close');
const btnDomandaAnnulla = document.getElementById('btn-domanda-annulla');
const formDomanda       = document.getElementById('form-domanda');
const domandaTipo       = document.getElementById('domanda-tipo');
const domandaTestoInput = document.getElementById('domanda-testo-input');
const domandaCorretta   = document.getElementById('domanda-corretta');
const risposteErrateWrap = document.getElementById('risposte-errate-wrap');

/* Modal elimina */
const modalElimina       = document.getElementById('modal-elimina');
const modalEliminaClose  = document.getElementById('modal-elimina-close');
const btnEliminaAnnulla  = document.getElementById('btn-elimina-annulla');
const btnEliminaConferma = document.getElementById('btn-elimina-conferma');

/* Toast */
const toastContainer = document.getElementById('toast-container');


/* ------------------------------------------------------------
   GESTIONE VISTE
   La pagina ha tre viste — ne mostriamo una alla volta
   nascondendo le altre. Più semplice di tre pagine separate
   e non richiede di ricaricare i dati.
   ------------------------------------------------------------ */
function mostraVista(vista) {
    vistaLista.hidden    = vista !== 'lista';
    vistaDettaglio.hidden = vista !== 'dettaglio';
    vistaQuiz.hidden     = vista !== 'quiz';
    /* Torniamo in cima alla pagina quando cambiamo vista */
    window.scrollTo(0, 0);
}


/* ------------------------------------------------------------
   VISTA LISTA — mostra i quiz
   ------------------------------------------------------------ */
function mostraQuiz() {
    quizLoading.hidden = true;

    if (tuttiIQuiz.length === 0) {
        quizGrid.hidden  = true;
        quizEmpty.hidden = false;
        return;
    }

    quizGrid.hidden  = false;
    quizEmpty.hidden = true;

    quizGrid.innerHTML = tuttiIQuiz.map(quiz => `
        <div class="quiz-card" onclick="apriDettaglio(${quiz.id})">
            <div class="quiz-card-titolo">${quiz.titolo}</div>
            <div class="quiz-card-footer">
                <span class="quiz-card-domande">
                    🧠 ${quiz.numero_domande} ${quiz.numero_domande === 1 ? 'domanda' : 'domande'}
                </span>
                ${quiz.materia_nome
                    ? `<span class="badge badge-primary">${quiz.materia_nome}</span>`
                    : ''}
            </div>
        </div>
    `).join('');
}


/* ------------------------------------------------------------
   VISTA DETTAGLIO — apre un quiz e carica le sue domande
   ------------------------------------------------------------ */
async function apriDettaglio(id) {
    quizCorrente = tuttiIQuiz.find(q => q.id === id);
    if (!quizCorrente) return;

    /* Popoliamo l'intestazione */
    dettaglioTitolo.textContent = quizCorrente.titolo;

    if (quizCorrente.materia_nome) {
        dettaglioMateria.textContent = quizCorrente.materia_nome;
        dettaglioMateria.hidden      = false;
    } else {
        dettaglioMateria.hidden = true;
    }

    /* Resettiamo la lista domande e mostriamo lo spinner */
    domandeList.hidden    = true;
    domandeEmpty.hidden   = true;
    domandeLoading.hidden = false;

    mostraVista('dettaglio');

    /* Carichiamo le domande del quiz */
    try {
        domandeCorrente = await api.getDomande(id);
        mostraDomande();
    } catch (err) {
        console.error(err);
        showToast('Errore nel caricamento delle domande', 'danger');
    }
}

/* Aggiorna il contatore domande e la lista */
function mostraDomande() {
    domandeLoading.hidden = true;
    dettaglioCount.textContent = `${domandeCorrente.length} ${domandeCorrente.length === 1 ? 'domanda' : 'domande'}`;

    if (domandeCorrente.length === 0) {
        domandeList.hidden  = true;
        domandeEmpty.hidden = false;
        return;
    }

    domandeList.hidden  = false;
    domandeEmpty.hidden = true;

    domandeList.innerHTML = domandeCorrente.map((d, i) => {
        /* Parsing delle risposte errate — sono salvate come JSON nel DB */
        let errateStr = '';
        if (d.risposte_errate) {
            try {
                const errate = typeof d.risposte_errate === 'string'
                    ? JSON.parse(d.risposte_errate)
                    : d.risposte_errate;
                errateStr = errate.filter(Boolean).join(', ');
            } catch {}
        }

        return `
            <li class="domanda-item">
                <div class="domanda-numero">${i + 1}</div>
                <div class="domanda-body">
                    <div class="domanda-testo">${d.testo}</div>
                    <div class="domanda-risposta">
                        ✅ <span>${d.risposta_corretta}</span>
                        ${errateStr ? `· ❌ ${errateStr}` : ''}
                    </div>
                </div>
                <div class="domanda-azioni">
                    <button class="btn btn-ghost btn-sm" onclick="eliminaDomanda(${d.id})">🗑️</button>
                </div>
            </li>
        `;
    }).join('');
}

/* Torna alla lista quiz */
btnTornaLista.addEventListener('click', () => {
    quizCorrente    = null;
    domandeCorrente = [];
    mostraVista('lista');
});


/* ------------------------------------------------------------
   MODAL NUOVO QUIZ — apertura e chiusura
   ------------------------------------------------------------ */
function apriModalQuiz() {
    formQuiz.reset();
    document.getElementById('quiz-titolo-error').textContent = '';
    modalQuiz.classList.add('active');
}

function chiudiModalQuiz() {
    modalQuiz.classList.remove('active');
}

btnNuovoQuiz.addEventListener('click',      apriModalQuiz);
modalQuizClose.addEventListener('click',    chiudiModalQuiz);
btnQuizAnnullaModal.addEventListener('click', chiudiModalQuiz);
modalQuiz.addEventListener('click', (e) => {
    if (e.target === modalQuiz) chiudiModalQuiz();
});


/* ------------------------------------------------------------
   SUBMIT NUOVO QUIZ
   ------------------------------------------------------------ */
formQuiz.addEventListener('submit', async (e) => {
    e.preventDefault();

    const titolo = quizTitolo.value.trim();
    if (!titolo) {
        document.getElementById('quiz-titolo-error').textContent = 'Titolo obbligatorio';
        return;
    }

    setLoading('btn-quiz-salva', true);

    try {
        const nuovoQuiz = await api.creaQuiz(titolo, quizMateria.value || null);
        showToast('Quiz creato', 'success');
        chiudiModalQuiz();
        await caricaDati();
        /* Apriamo subito il dettaglio del quiz appena creato */
        apriDettaglio(nuovoQuiz.id);
    } catch (err) {
        console.error(err);
        showToast('Errore nella creazione del quiz', 'danger');
    } finally {
        setLoading('btn-quiz-salva', false);
    }
});


/* ------------------------------------------------------------
   MODAL NUOVA DOMANDA
   Quando il tipo cambia a "aperta" nascondiamo le risposte
   errate — non servono per le domande aperte.
   ------------------------------------------------------------ */
domandaTipo.addEventListener('change', () => {
    risposteErrateWrap.hidden = domandaTipo.value === 'aperta';
});

function apriModalDomanda() {
    formDomanda.reset();
    risposteErrateWrap.hidden = false;
    document.getElementById('domanda-testo-error').textContent    = '';
    document.getElementById('domanda-corretta-error').textContent = '';
    modalDomanda.classList.add('active');
}

function chiudiModalDomanda() {
    modalDomanda.classList.remove('active');
}

btnNuovaDomanda.addEventListener('click',    apriModalDomanda);
modalDomandaClose.addEventListener('click',  chiudiModalDomanda);
btnDomandaAnnulla.addEventListener('click',  chiudiModalDomanda);
modalDomanda.addEventListener('click', (e) => {
    if (e.target === modalDomanda) chiudiModalDomanda();
});


/* ------------------------------------------------------------
   SUBMIT NUOVA DOMANDA
   ------------------------------------------------------------ */
formDomanda.addEventListener('submit', async (e) => {
    e.preventDefault();

    let valido = true;
    document.getElementById('domanda-testo-error').textContent    = '';
    document.getElementById('domanda-corretta-error').textContent = '';

    if (!domandaTestoInput.value.trim()) {
        document.getElementById('domanda-testo-error').textContent = 'Domanda obbligatoria';
        valido = false;
    }
    if (!domandaCorretta.value.trim()) {
        document.getElementById('domanda-corretta-error').textContent = 'Risposta corretta obbligatoria';
        valido = false;
    }
    if (!valido) return;

    /* Raccogliamo le risposte errate filtrando quelle vuote */
    const errate = [
        document.getElementById('errata-1').value.trim(),
        document.getElementById('errata-2').value.trim(),
        document.getElementById('errata-3').value.trim(),
    ].filter(Boolean);

    setLoading('btn-domanda-salva', true);

    try {
        await api.creaDomanda(quizCorrente.id, {
            testo:              domandaTestoInput.value.trim(),
            risposta_corretta:  domandaCorretta.value.trim(),
            risposte_errate:    errate.length > 0 ? errate : null,
            tipo:               domandaTipo.value,
        });

        showToast('Domanda aggiunta', 'success');
        chiudiModalDomanda();

        /* Ricarichiamo le domande e aggiorniamo il contatore */
        domandeCorrente = await api.getDomande(quizCorrente.id);
        mostraDomande();

        /* Aggiorniamo il contatore nel quiz nella lista */
        const q = tuttiIQuiz.find(q => q.id === quizCorrente.id);
        if (q) q.numero_domande = domandeCorrente.length;

    } catch (err) {
        console.error(err);
        showToast('Errore nell\'aggiunta della domanda', 'danger');
    } finally {
        setLoading('btn-domanda-salva', false);
    }
});


/* ------------------------------------------------------------
   ELIMINA DOMANDA
   ------------------------------------------------------------ */
async function eliminaDomanda(domandaId) {
    try {
        await api.eliminaDomanda(quizCorrente.id, domandaId);
        showToast('Domanda eliminata', 'success');
        domandeCorrente = await api.getDomande(quizCorrente.id);
        mostraDomande();
    } catch (err) {
        console.error(err);
        showToast('Errore nell\'eliminazione della domanda', 'danger');
    }
}


/* ------------------------------------------------------------
   MODAL ELIMINA QUIZ
   ------------------------------------------------------------ */
btnEliminaQuiz.addEventListener('click', () => {
    if (!quizCorrente) return;
    quizEliminaId = quizCorrente.id;
    modalElimina.classList.add('active');
});

function chiudiModalElimina() {
    modalElimina.classList.remove('active');
    quizEliminaId = null;
}

modalEliminaClose.addEventListener('click',  chiudiModalElimina);
btnEliminaAnnulla.addEventListener('click',  chiudiModalElimina);
modalElimina.addEventListener('click', (e) => {
    if (e.target === modalElimina) chiudiModalElimina();
});

btnEliminaConferma.addEventListener('click', async () => {
    if (!quizEliminaId) return;

    setLoading('btn-elimina-conferma', true);

    try {
        await api.eliminaQuiz(quizEliminaId);
        showToast('Quiz eliminato', 'success');
        chiudiModalElimina();
        quizCorrente    = null;
        domandeCorrente = [];
        await caricaDati();
        mostraVista('lista');
    } catch (err) {
        console.error(err);
        showToast('Errore nell\'eliminazione del quiz', 'danger');
    } finally {
        setLoading('btn-elimina-conferma', false);
    }
});


/* ------------------------------------------------------------
   ESECUZIONE QUIZ
   Avvia la modalità studio — mescola le domande e le mostra
   una alla volta. Tiene il punteggio e mostra il risultato
   finale alla fine.
   ------------------------------------------------------------ */
btnIniziaQuiz.addEventListener('click', () => {
    if (domandeCorrente.length === 0) {
        showToast('Aggiungi almeno una domanda prima di iniziare', 'danger');
        return;
    }
    avviaQuiz();
});

function avviaQuiz() {
    /* Mescoliamo le domande con l'algoritmo Fisher-Yates —
       così ogni esecuzione del quiz ha un ordine diverso */
    domandeQuiz = [...domandeCorrente].sort(() => Math.random() - 0.5);
    indiceDomanda    = 0;
    risposteCorrette = 0;

    mostraVista('quiz');
    mostraDomandaCorrente();
}

function mostraDomandaCorrente() {
    const domanda = domandeQuiz[indiceDomanda];
    rispostaConfermata = false;

    /* Aggiorniamo la barra di avanzamento */
    const percentuale = (indiceDomanda / domandeQuiz.length) * 100;
    progressFill.style.width   = `${percentuale}%`;
    progressLabel.textContent  = `${indiceDomanda + 1} / ${domandeQuiz.length}`;

    /* Mostriamo il numero e il testo della domanda */
    domandaNumero.textContent = `Domanda ${indiceDomanda + 1}`;
    domandaTesto.textContent  = domanda.testo;

    /* Nascondiamo il risultato e mostriamo la domanda */
    domandaCard.hidden    = false;
    risultatoCard.hidden  = true;
    finaleCard.hidden     = true;

    if (domanda.tipo === 'aperta') {
        /* Domanda aperta — mostriamo il textarea */
        quizOpzioni.hidden          = true;
        rispostaApertaWrap.hidden   = false;
        rispostaAperta.value        = '';
        rispostaAperta.disabled     = false;
    } else {
        /* Domanda multipla — generiamo i bottoni delle opzioni */
        quizOpzioni.hidden        = false;
        rispostaApertaWrap.hidden = true;

        /* Mescoliamo le opzioni — risposta corretta + risposte errate */
        let opzioni = [domanda.risposta_corretta];
        if (domanda.risposte_errate) {
            try {
                const errate = typeof domanda.risposte_errate === 'string'
                    ? JSON.parse(domanda.risposte_errate)
                    : domanda.risposte_errate;
                opzioni = opzioni.concat(errate.filter(Boolean));
            } catch {}
        }
        /* Mescoliamo le opzioni */
        opzioni = opzioni.sort(() => Math.random() - 0.5);

        quizOpzioni.innerHTML = opzioni.map(opzione => `
            <button class="quiz-opzione" onclick="selezionaOpzione(this, '${opzione.replace(/'/g, "\\'")}')">
                ${opzione}
            </button>
        `).join('');
    }
}

/* Gestisce il click su un'opzione di risposta multipla */
function selezionaOpzione(el, valore) {
    /* Ignoriamo i click se la risposta è già stata confermata */
    if (rispostaConfermata) return;

    /* Rimuoviamo la selezione precedente */
    quizOpzioni.querySelectorAll('.quiz-opzione').forEach(b => {
        b.classList.remove('selezionata');
    });
    el.classList.add('selezionata');
    /* Salviamo il valore selezionato sull'elemento per recuperarlo dopo */
    el.dataset.selezionata = 'true';
}

/* Conferma la risposta e mostra il feedback */
btnConfermaRisposta.addEventListener('click', () => {
    if (rispostaConfermata) return;

    const domanda = domandeQuiz[indiceDomanda];
    let corretta  = false;

    if (domanda.tipo === 'aperta') {
        /* Per le domande aperte confrontiamo ignorando maiuscole/minuscole
           e spazi iniziali/finali */
        const risposta = rispostaAperta.value.trim().toLowerCase();
        const corretta_str = domanda.risposta_corretta.toLowerCase();
        corretta = risposta === corretta_str;
        rispostaAperta.disabled = true;
    } else {
        /* Per le domande multiple controlliamo quale opzione è selezionata */
        const selezionata = quizOpzioni.querySelector('[data-selezionata="true"]');
        if (!selezionata) {
            showToast('Seleziona una risposta', 'warning');
            return;
        }

        /* Coloriamo le opzioni — verde la corretta, rosso la sbagliata */
        quizOpzioni.querySelectorAll('.quiz-opzione').forEach(btn => {
            btn.classList.add('disabilitata');
            if (btn.textContent.trim() === domanda.risposta_corretta) {
                btn.classList.add('corretta');
            } else if (btn.dataset.selezionata && btn.textContent.trim() !== domanda.risposta_corretta) {
                btn.classList.add('errata');
            }
        });

        corretta = selezionata.textContent.trim() === domanda.risposta_corretta;
    }

    rispostaConfermata = true;
    if (corretta) risposteCorrette++;

    /* Mostriamo il feedback */
    risultatoIcona.textContent  = corretta ? '✅' : '❌';
    risultatoTitolo.textContent = corretta ? 'Risposta corretta!' : 'Risposta errata';
    risultatoTitolo.className   = `quiz-risultato-titolo ${corretta ? 'corretta' : 'errata'}`;
    risultatoTesto.textContent  = corretta
        ? 'Ottimo! Continua così.'
        : `La risposta corretta era: "${domanda.risposta_corretta}"`;

    /* Mostriamo la card risultato dopo un breve ritardo
       così l'utente vede prima il colore delle opzioni */
    setTimeout(() => {
        risultatoCard.hidden = false;
    }, corretta ? 0 : 600);
});

/* Passa alla domanda successiva o mostra il finale */
btnProssimaDomanda.addEventListener('click', () => {
    indiceDomanda++;

    if (indiceDomanda >= domandeQuiz.length) {
        mostraFinale();
    } else {
        risultatoCard.hidden = true;
        mostraDomandaCorrente();
    }
});

/* Mostra il punteggio finale */
function mostraFinale() {
    domandaCard.hidden   = true;
    risultatoCard.hidden = true;
    finaleCard.hidden    = false;

    /* Barra avanzamento al 100% */
    progressFill.style.width  = '100%';
    progressLabel.textContent = `${domandeQuiz.length} / ${domandeQuiz.length}`;

    const totale      = domandeQuiz.length;
    const percentuale = Math.round((risposteCorrette / totale) * 100);

    /* Icona e classe colore in base al punteggio */
    if (percentuale >= 80) {
        finaleIcona.textContent = '🏆';
        finaleScore.className   = 'quiz-finale-score ottimo';
        finaleTesto.textContent = 'Eccellente! Sei pronto per la verifica.';
    } else if (percentuale >= 60) {
        finaleIcona.textContent = '👍';
        finaleScore.className   = 'quiz-finale-score buono';
        finaleTesto.textContent = 'Buon risultato! Ripasssa gli argomenti che non ricordavi.';
    } else {
        finaleIcona.textContent = '📚';
        finaleScore.className   = 'quiz-finale-score scarso';
        finaleTesto.textContent = 'Continua a studiare — riprova dopo aver ripassato.';
    }

    finaleScore.textContent = `${risposteCorrette}/${totale} (${percentuale}%)`;
}

/* Riprova lo stesso quiz rimescolando le domande */
btnRiprova.addEventListener('click', avviaQuiz);

/* Torna al dettaglio del quiz */
btnTornaDettaglio.addEventListener('click', () => {
    mostraVista('dettaglio');
});

/* Annulla il quiz e torna al dettaglio */
btnQuizAnnulla.addEventListener('click', () => {
    mostraVista('dettaglio');
});


/* ------------------------------------------------------------
   CARICAMENTO DATI
   ------------------------------------------------------------ */
async function caricaDati() {
    try {
        const [quiz, materie] = await Promise.all([
            api.getQuiz(),
            api.getMaterie(),
        ]);

        tuttiIQuiz     = quiz;
        tutteLeMaterie = materie;

        /* Popoliamo il select materie nel modal nuovo quiz */
        quizMateria.innerHTML = '<option value="">Nessuna materia</option>';
        materie.forEach(m => {
            const opt       = document.createElement('option');
            opt.value       = m.id;
            opt.textContent = m.nome;
            quizMateria.appendChild(opt);
        });

        quizLoading.hidden = true;
        mostraQuiz();

    } catch (err) {
        console.error(err);
        showToast('Errore nel caricamento dei quiz', 'danger');
    }
}


/* ------------------------------------------------------------
   HELPERS UI
   ------------------------------------------------------------ */
function setLoading(btnId, loading) {
    const btn     = document.getElementById(btnId);
    const text    = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');
    btn.disabled   = loading;
    text.hidden    = loading;
    spinner.hidden = !loading;
}

function showToast(message, type = '') {
    const toast = document.createElement('div');
    toast.className   = `toast ${type ? 'toast-' + type : ''}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}


/* ------------------------------------------------------------
   AVVIO
   ------------------------------------------------------------ */
caricaDati();
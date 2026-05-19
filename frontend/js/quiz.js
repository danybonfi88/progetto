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
let quizInModifica   = null;
let filtromateria = ''; /* ID della materia selezionata, '' = tutti */

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
const btnModificaQuiz = document.getElementById('btn-modifica-quiz');

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
const btnQuizPausa = document.getElementById('btn-quiz-pausa');
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

/* Modal ripresa quiz */
const modalRiprendi      = document.getElementById('modal-riprendi');
const modalRiprendiClose = document.getElementById('modal-riprendi-close');
const btnRiprendiSi      = document.getElementById('btn-riprendi-si');
const btnRiprendiNo      = document.getElementById('btn-riprendi-no');

/* Toast */
const toastContainer = document.getElementById('toast-container');

/* Modal generazione AI */
const modalGeneraAi    = document.getElementById('modal-genera-ai');
const modalAiClose     = document.getElementById('modal-ai-close');
const btnGeneraAi      = document.getElementById('btn-genera-ai');
const btnAiAnnulla     = document.getElementById('btn-ai-annulla');
const formGeneraAi     = document.getElementById('form-genera-ai');
const aiArgomento      = document.getElementById('ai-argomento');
const aiNumero = document.getElementById('ai-numero');

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
/* 
   VISTA LISTA — mostra i quiz
   Aggiornata per permettere l'avvio rapido del quiz senza passare per il dettaglio.
*/
/* 
   VISTA LISTA — mostra i quiz
   SISTEMAZIONE: Ora include la logica di filtraggio per materia.
*/
function mostraQuiz() {
    quizLoading.hidden = true;

    if (tuttiIQuiz.length === 0) {
        quizGrid.hidden  = true;
        quizEmpty.hidden = false;
        return;
    }

    /* 
       LOGICA DI FILTRAGGIO:
       Creiamo una lista temporanea di quiz che rispettano il filtro.
       Se filtromateria è vuoto, passano tutti.
       Altrimenti, passano solo quelli con l'ID materia corrispondente.
    */
    const quizFiltrati = tuttiIQuiz.filter(quiz => {
        if (filtromateria === '') return true;
        return String(quiz.materia_id) === filtromateria;
    });

    /* Se dopo il filtro non resta nulla, mostriamo lo stato vuoto */
    if (quizFiltrati.length === 0) {
        quizGrid.hidden  = true;
        quizEmpty.hidden = true; // Nascondiamo l'empty generale
        
        /* Opzionale: potresti aggiungere un messaggio "Nessun quiz in questa materia" */
        quizEmpty.innerHTML = `
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-title">Nessun quiz trovato</div>
            <div class la="empty-state-text">Non ci sono quiz per questa materia.</div>
        `;
        quizEmpty.hidden = false;
        return;
    }

    quizGrid.hidden  = false;
    quizEmpty.hidden = true;

    /* Generiamo l'HTML usando la lista filtrata invece di tuttiIQuiz */
    quizGrid.innerHTML = quizFiltrati.map(quiz => `
        <div class="quiz-card">
            <div class="quiz-card-main" onclick="apriDettaglio(${quiz.id})">
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
            <button class="btn btn-primary btn-avvia-rapido" onclick="avviaQuizDiretto(event, ${quiz.id})">
                ▶ Avvia
            </button>
        </div>
    `).join('');
}

/* 
   AVVIO RAPIDO DEL QUIZ
   Permette di iniziare un quiz direttamente dalla lista.
   1. Previene la propagazione del click (per non aprire il dettaglio).
   2. Carica le domande dal server.
   3. Avvia la modalità esecuzione.
*/
async function avviaQuizDiretto(e, id) {
    /* Impedisce che il click sul bottone attivi anche l'onclick della card (apriDettaglio) */
    e.stopPropagation();

    try {
        /* Mostriamo un feedback visivo sul bottone */
        const btn = e.target;
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '...';

        /* 1. Recuperiamo le domande per questo quiz specifico tramite l'API */
        const domande = await api.getDomande(id);

        if (domande.length === 0) {
            showToast('Il quiz è vuoto. Aggiungi domande prima di iniziare.', 'warning');
            btn.disabled = false;
            btn.textContent = originalText;
            return;
        }

        /* 2. Impostiamo lo stato globale dell'app per l'esecuzione */
        quizCorrente = tuttiIQuiz.find(q => q.id === id);
        domandeCorrente = domande;

        /* 3. Lanciamo la funzione di avvio (che mescola le domande e mostra la vista quiz) */
        /* Aggiungiamo await perché avviaQuiz ora è asincrona per via del modal */
        await avviaQuiz();

    } catch (err) {
        console.error(err);
        showToast('Errore nel caricamento del quiz', 'danger');
    } finally {
        /* Ripristiniamo il bottone se c'è stato un errore */
        const btn = e.target;
        if (btn) {
            btn.disabled = false;
            btn.textContent = '▶ Avvia';
        }
    }
}


/* ------------------------------------------------------------
   VISTA DETTAGLIO — apre un quiz e carica le sue domande
   ------------------------------------------------------------ */
async function apriDettaglio(id) {
    /* Troviamo il quiz selezionato nella cache locale */
    quizCorrente = tuttiIQuiz.find(q => q.id === id);
    if (!quizCorrente) return;

    /* Impostiamo i testi dell'intestazione del quiz */
    dettaglioTitolo.textContent = quizCorrente.titolo;

    if (quizCorrente.materia_nome) {
        dettaglioMateria.textContent = quizCorrente.materia_nome;
        dettaglioMateria.hidden      = false;
    } else {
        dettaglioMateria.hidden = true;
    }

    /* Prepariamo la vista: nascondiamo i dati e mostriamo lo spinner */
    domandeList.hidden    = true;
    domandeEmpty.hidden   = true;
    domandeLoading.hidden = false;

    mostraVista('dettaglio');

    try {
        /* Recuperiamo l'elenco completo delle domande associate a questo specifico quiz */
        domandeCorrente = await api.getDomande(id);
        mostraDomande();
    } catch (err) {
        console.error(err);
        showToast('Errore nel caricamento delle domande', 'danger');
    } finally {
        /* ------------------------------------------------------------
           SCOMPARSA INDICATORE DI CARICAMENTO:
           Nascondiamo lo spinner delle domande. Se il caricamento fallisce,
           l'utente vedrà il messaggio di errore ma non rimarrà bloccato 
           da una rotellina infinita.
           ------------------------------------------------------------ */
        domandeLoading.hidden = true;
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
/* 
   APERTURA MODAL QUIZ
   Gestisce due modalità:
   - Senza argomenti: Modalità CREAZIONE (campi vuoti).
   - Con oggetto quiz: Modalità MODIFICA (campi pre-compilati).
*/
function apriModalQuiz(quiz = null) {
    /* Se quiz è presente, siamo in modalità modifica, altrimenti creazione */
    quizInModifica = quiz ? quiz.id : null;
    
    /* Gestione Testi: aggiorniamo titolo modal e testo bottone in base al contesto */
    const modalTitle = document.querySelector('#modal-quiz .modal-title');
    const btnText = document.getElementById('btn-quiz-salva').querySelector('.btn-text');

    if (quiz) {
        modalTitle.textContent = 'Modifica quiz';
        btnText.textContent = 'Aggiorna quiz';
        
        /* Pre-compilazione campi con i dati del quiz selezionato */
        quizTitolo.value = quiz.titolo;
        quizMateria.value = quiz.materia_id || '';
    } else {
        modalTitle.textContent = 'Nuovo quiz';
        btnText.textContent = 'Crea quiz';
        formQuiz.reset();
    }

    /* Pulizia errori precedenti e apertura modal */
    document.getElementById('quiz-titolo-error').textContent = '';
    modalQuiz.classList.add('active');
}

function chiudiModalQuiz() {
    modalQuiz.classList.remove('active');
}

/* 
   SISTEMAZIONE BUG CREAZIONE QUIZ:
   Colleghiamo il bottone "+ Nuovo quiz" alla funzione di apertura del modal.
   Senza questo listener, il click sul bottone non produce alcun effetto.
*/
btnNuovoQuiz.addEventListener('click', () => {
    apriModalQuiz(); // Chiamiamo la funzione senza argomenti per attivare la modalità "CREAZIONE"
});

/* Quando clicco su "Modifica quiz", passiamo l'oggetto quizCorrente alla funzione per pre-compilare i campi */
btnModificaQuiz.addEventListener('click', () => {
    if (quizCorrente) {
        apriModalQuiz(quizCorrente);
    }
});
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
        if (quizInModifica) {
            /* MODALITÀ MODIFICA: aggiorniamo il quiz esistente tramite ID */
            const dati = { 
                titolo: titolo, 
                materia_id: quizMateria.value || null 
            };
            await api.aggiornaQuiz(quizInModifica, dati);
            showToast('Quiz aggiornato con successo', 'success');
        } else {
            /* MODALITÀ CREAZIONE: creiamo un nuovo quiz */
            const nuovoQuiz = await api.creaQuiz(titolo, quizMateria.value || null);
            showToast('Quiz creato', 'success');
            
            /* Se l'utente ha creato il quiz dalla lista, lo portiamo subito nel dettaglio */
            if (vistaLista.hidden === false) {
                await caricaDati();
                apriDettaglio(nuovoQuiz.id);
            }
        }
        
        chiudiModalQuiz();
        await caricaDati(); // Ricarichiamo l'elenco quiz per aggiornare i nomi e le materie a video

    } catch (err) {
        console.error(err);
        showToast(err.message || 'Errore durante l\'operazione', 'danger');
    } finally {
        setLoading('btn-quiz-salva', false);
        quizInModifica = null; // Resettiamo lo stato per non confondere future aperture del modal
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

/* 
   FUNZIONE PAUSA QUIZ
   Salva l'attuale stato del quiz nel localStorage dell'utente.
   Salviamo: 
   - l'indice della domanda corrente (per ripartire da lì)
   - il numero di risposte corrette (per non azzerare il punteggio)
   - l'elenco delle domande mescolate (per mantenere lo stesso ordine)
*/
function pausaQuiz() {
    if (!quizCorrente) return;

    const stato = {
        indiceDomanda: indiceDomanda,
        risposteCorrette: risposteCorrette,
        domandeMescolate: domandeQuiz
    };

    localStorage.setItem(`quiz_progress_${quizCorrente.id}`, JSON.stringify(stato));
    showToast('Progresso salvato! Potrai riprendere da qui.', 'success');
    
    /* 
       SISTEMAZIONE VISTA:
       Non basta cambiare vista. Dobbiamo assicurarci che i contenuti 
       della vista dettaglio (titolo e lista domande) siano visibili.
    */
    mostraVista('dettaglio');
    
    /* 
       Richiamiamo mostraDomande() per forzare il browser a:
       1. Impostare domandeLoading.hidden = true
       2. Impostare domandeList.hidden = false (se ci sono domande)
       3 la renderizzare l'HTML della lista.
    */
    mostraDomande();
}

/* Colleghiamo la funzione al bottone Pausa */
btnQuizPausa.addEventListener('click', pausaQuiz);

/* 
   FUNZIONE CHIEDI RIPRESA
   Crea una Promise che risolve in TRUE se l'utente vuole riprendere, 
   o FALSE se vuole ricominciare.
   Questo permette di usare 'await' all'interno di avviaQuiz() 
   per simulare il comportamento del confirm() del browser ma con un modal dell'app.
*/
function chiediRipresa() {
    return new Promise((resolve) => {
        /* Mostriamo il modal */
        modalRiprendi.classList.add('active');

        /* Definiamo le funzioni di risposta */
        const rispondiSi = () => {
            modalRiprendi.classList.remove('active');
            resolve(true); // L'utente vuole riprendere
        };

        const rispondiNo = () => {
            modalRiprendi.classList.remove('active');
            resolve(false); // L'utente vuole ricominciare
        };

        /* Colleghiamo i bottoni alle risposte */
        btnRiprendiSi.onclick = rispondiSi;
        btnRiprendiNo.onclick = rispondiNo;
        modalRiprendiClose.onclick = rispondiNo; // Chiudendo la X, di default ricomincia

        /* Chiudi se clicchi fuori dal modal */
        modalRiprendi.onclick = (e) => {
            if (e.target === modalRiprendi) rispondiNo();
        };
    });
}

btnIniziaQuiz.addEventListener('click', () => {
    if (domandeCorrente.length === 0) {
        showToast('Aggiungi almeno una domanda prima di iniziare', 'danger');
        return;
    }
    avviaQuiz();
});

/* 
   AVVIO QUIZ
   Ora è una funzione ASYNC per poter attendere la risposta del modal di ripresa.
*/
async function avviaQuiz() {
    /* 1. VERIFICA SALVATAGGI PRECEDENTI */
    const salvataggio = localStorage.getItem(`quiz_progress_${quizCorrente.id}`);

    if (salvataggio) {
        /* 
           USO DEL MODAL PERSONALIZZATO:
           Attendiamo (await) che la Promise di chiediRipresa venga risolta.
           Il codice si ferma qui finché l'utente non clicca su un bottone del modal.
        */
        const riprendi = await chiediRipresa();
        
        if (riprendi) {
            const dati = JSON.parse(salvataggio);
            domandeQuiz      = dati.domandeMescolate;
            indiceDomanda    = dati.indiceDomanda;
            risposteCorrette = dati.risposteCorrette;
            
            localStorage.removeItem(`quiz_progress_${quizCorrente.id}`);
        } else {
            domandeQuiz      = [...domandeCorrente].sort(() => Math.random() - 0.5);
            indiceDomanda    = 0;
            risposteCorrette = 0;
            localStorage.removeItem(`quiz_progress_${quizCorrente.id}`);
        }
    } else {
        /* Avvio normale senza salvataggi */
        domandeQuiz      = [...domandeCorrente].sort(() => Math.random() - 0.5);
        indiceDomanda    = 0;
        risposteCorrette = 0;
    }

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
    /* Rimuoviamo ogni eventuale salvataggio residue poiché il quiz è stato completato */
    localStorage.removeItem(`quiz_progress_${quizCorrente.id}`);

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
/* 
   SISTEMAZIONE BUG TORNA AL DETTAGLIO:
   Dopo la fine del quiz, torniamo al dettaglio e riattiviamo 
   la renderizzazione della lista domande.
*/
btnTornaDettaglio.addEventListener('click', () => {
    mostraVista('dettaglio');
    mostraDomande(); // Ripristina la visibilità della lista domande
});

/* Annulla il quiz e torna al dettaglio */
/* 
   SISTEMAZIONE BUG ANNULLA:
   Quando l'utente annulla, torniamo al dettaglio e forziamo 
   la visualizzazione della lista domande per evitare la schermata bianca.
*/
btnQuizAnnulla.addEventListener('click', () => {
    mostraVista('dettaglio');
    mostraDomande(); // Ripristina la visibilità della lista domande
});

/* ------------------------------------------------------------
   GENERAZIONE AI DOMANDE
   Gestisce l'apertura del modal, la validazione dell'argomento
   e la chiamata all'API per popolare il quiz automaticamente.
   ------------------------------------------------------------ */

// Apre il modal di generazione AI
function apriModalGeneraAi() {
    formGeneraAi.reset();
    document.getElementById('ai-argomento-error').textContent = '';
    modalGeneraAi.classList.add('active');
}

// Chiude il modal di generazione AI
function chiudiModalGeneraAi() {
    modalGeneraAi.classList.remove('active');
}

// Event listener per l'apertura e la chiusura
btnGeneraAi.addEventListener('click', apriModalGeneraAi);
modalAiClose.addEventListener('click', chiudiModalGeneraAi);
btnAiAnnulla.addEventListener('click', chiudiModalGeneraAi);

// Chiude il modal cliccando sull'overlay
modalGeneraAi.addEventListener('click', (e) => {
    if (e.target === modalGeneraAi) chiudiModalGeneraAi();
});

// Gestisce l'invio del modulo di generazione
formGeneraAi.addEventListener('submit', async (e) => {
    e.preventDefault();

    const argomento = aiArgomento.value.trim();
    const numero    = aiNumero.value; // Leggiamo il numero selezionato (es. "5", "10")

    if (!argomento) {
        document.getElementById('ai-argomento-error').textContent = 'L\'argomento è obbligatorio';
        return;
    }

    setLoading('btn-ai-conferma', true);

    try {
        /* Passiamo sia l'argomento che il numero di domande desiderate */
        const data = await api.generateQuizQuestions(quizCorrente.id, argomento, numero);
        
        if (data.message) {
            showToast(`AI: ${data.message}`, 'success');
            chiudiModalGeneraAi();

            /* Fondamentale: dopo la generazione, dobbiamo aggiornare la lista 
               di domande visualizzata nella vista dettaglio per mostrare i nuovi inserimenti */
            domandeCorrente = await api.getDomande(quizCorrente.id);
            mostraDomande();

            /* Aggiorniamo anche il contatore nella lista generale dei quiz */
            const q = tuttiIQuiz.find(q => q.id === quizCorrente.id);
            if (q) q.numero_domande = domandeCorrente.length;
        }
    } catch (err) {
        console.error(err);
        showToast('Errore durante la generazione AI', 'danger');
    } finally {
        // Ripristiniamo il bottone
        setLoading('btn-ai-conferma', false);
    }
});

/* ------------------------------------------------------------
   CARICAMENTO DATI
   ------------------------------------------------------------ */
async function caricaDati() {
    try {
        /* Carichiamo in parallelo la lista quiz e le materie per i menu a tendina */
        const [quiz, materie] = await Promise.all([
            api.getQuiz(),
            api.getMaterie(),
        ]);

        tuttiIQuiz     = quiz;
        tutteLeMaterie = materie;

        /* --- AGGIUNTA: POPOLAMENTO FILTRI MATERIE --- */
        const quizFiltri = document.querySelector('.quiz-filtri');
        quizFiltri.innerHTML = `<button class="filtro-btn active" data-materia="">Tutti</button>`;
        
        materie.forEach(m => {
            const btn = document.createElement('button');
            btn.className        = 'filtro-btn';
            btn.dataset.materia  = m.id;
            /* SALVAGGIO COLORE: Non lo applichiamo subito, lo salviamo nel dataset */
            btn.dataset.color    = m.colore; 
            btn.textContent      = m.nome;
            quizFiltri.appendChild(btn);
        });

        /* Mostriamo la griglia dei quiz caricati */
        mostraQuiz();

    } catch (err) {
        console.error(err);
        showToast('Errore nel caricamento dei quiz', 'danger');
    } finally {
        /* ------------------------------------------------------------
           SCOMPARSA INDICATORE DI CARICAMENTO:
           Nascondiamo lo spinner della lista quiz. Questo garantisce che 
           l'utente veda l'interfaccia (o lo stato vuoto) anche se l'API fallisce.
           ------------------------------------------------------------ */
        quizLoading.hidden = true;
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

/* 
   GESTIONE CLICK FILTRI QUIZ
   Sincronizza la selezione visiva con la variabile di stato 
   e aggiorna la griglia dei quiz.
*/
document.querySelector('.quiz-filtri').addEventListener('click', (e) => {
    if (!e.target.classList.contains('filtro-btn')) return;

    /* 
       SISTEMAZIONE COLORI:
       Rimuoviamo la classe 'active' e resettiamo gli stili inline di TUTTI i bottoni.
       Questo assicura che i bottoni non restino colorati dopo il click.
    */
    document.querySelectorAll('.quiz-filtri .filtro-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.backgroundColor = ''; // Torna al colore base del CSS
        btn.style.color = '';           // Torna al colore testo base
    });

    /* Attiviamo il bottone cliccato */
    e.target.classList.add('active');

    /* 
       Se il bottone ha un colore associato (quindi è una materia e non il tasto "Tutti"),
       applichiamo il colore salvato nel dataset.
    */
    if (e.target.dataset.color) {
        e.target.style.backgroundColor = e.target.dataset.color;
        e.target.style.color = 'white'; // Testo bianco per leggibilità su colori scuri
    }

    /* Aggiorniamo l'ID della materia selezionata e ridisegniamo la griglia */
    filtromateria = e.target.dataset.materia;
    mostraQuiz();
});


/* ------------------------------------------------------------
   AVVIO
   ------------------------------------------------------------ */
caricaDati();
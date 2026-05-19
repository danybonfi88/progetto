/* ============================================================
   js/calendario.js
   Logica della pagina calendario — genera la griglia mensile,
   carica gli eventi dall'API, gestisce creazione, modifica
   ed eliminazione degli eventi.
   ============================================================ */


/* ------------------------------------------------------------
   PROTEZIONE PAGINA E INIZIALIZZAZIONE NAVBAR
   Stesso pattern di dashboard.js — controlla il token,
   imposta avatar e dropdown, evidenzia il link attivo.
   ------------------------------------------------------------ */
if (!localStorage.getItem('token')) {
    window.location.href = 'index.html';
}

const nome     = localStorage.getItem('nome') || 'Utente';
const iniziali = nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

document.getElementById('user-avatar').textContent   = iniziali;
document.getElementById('dropdown-name').textContent = nome;

document.querySelectorAll('.navbar-link').forEach(link => {
    if (link.dataset.page === 'calendario') link.classList.add('active');
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
   Variabili globali che tengono traccia dello stato corrente.
   tuttiGliEventi contiene tutti gli eventi caricati dall'API —
   non ricarichiamo dal server ogni volta che cambia il mese,
   filtriamo localmente per essere più veloci.
   ------------------------------------------------------------ */
let tuttiGliEventi = [];  /* cache degli eventi caricati dall'API */
let tutteLeMaterie = [];  /* cache delle materie per il select nel modal */
let meseCorrente   = new Date().getMonth();   /* 0-11 */
let annoCorrente   = new Date().getFullYear();
let eventoInModifica = null; /* id dell'evento in modifica, null se nuovo */
let eventoElimina    = null; /* id dell'evento da eliminare */


/* ------------------------------------------------------------
   SELEZIONE ELEMENTI DOM
   ------------------------------------------------------------ */

/* Calendario */
const calendarioGrid   = document.getElementById('calendario-grid');
const calendarioTitolo = document.getElementById('calendario-titolo');
const calendarioLoading = document.getElementById('calendario-loading');

/* Lista eventi */
const listaLoading = document.getElementById('lista-loading');
const listaEventi  = document.getElementById('lista-eventi');
const listaEmpty   = document.getElementById('lista-empty');
const filtroTipo   = document.getElementById('filtro-tipo');

/* Modal evento */
const modalEvento  = document.getElementById('modal-evento');
const modalTitolo  = document.getElementById('modal-titolo');
const formEvento   = document.getElementById('form-evento');
const btnNuovo     = document.getElementById('btn-nuovo-evento');
const btnClose     = document.getElementById('modal-close');
const btnAnnulla   = document.getElementById('btn-annulla');
const btnSalva     = document.getElementById('btn-salva');
const completatoGroup = document.getElementById('completato-group');

/* Campi form evento */
const campoTitolo     = document.getElementById('evento-titolo');
const campoTipo       = document.getElementById('evento-tipo');
const campoData       = document.getElementById('evento-data');
const campoOra        = document.getElementById('evento-ora');
const campoMateria    = document.getElementById('evento-materia');
const campoNote       = document.getElementById('evento-note');
const campoCompletato = document.getElementById('evento-completato');

/* Modal elimina */
const modalElimina       = document.getElementById('modal-elimina');
const btnEliminaClose    = document.getElementById('modal-elimina-close');
const btnEliminaAnnulla  = document.getElementById('btn-elimina-annulla');
const btnEliminaConferma = document.getElementById('btn-elimina-conferma');

/* Toast */
const toastContainer = document.getElementById('toast-container');


/* ------------------------------------------------------------
   NAVIGAZIONE TRA I MESI
   Aggiorniamo meseCorrente e annoCorrente e ridisegniamo
   il calendario — non ricarichiamo i dati dall'API perché
   tuttiGliEventi contiene già tutto.
   ------------------------------------------------------------ */
document.getElementById('btn-mese-prec').addEventListener('click', () => {
    meseCorrente--;
    /* Se andiamo prima di gennaio, torniamo a dicembre dell'anno precedente */
    if (meseCorrente < 0) {
        meseCorrente = 11;
        annoCorrente--;
    }
    generaCalendario();
    aggiornaLista();
});

document.getElementById('btn-mese-succ').addEventListener('click', () => {
    meseCorrente++;
    /* Se andiamo dopo dicembre, passiamo a gennaio dell'anno successivo */
    if (meseCorrente > 11) {
        meseCorrente = 0;
        annoCorrente++;
    }
    generaCalendario();
    aggiornaLista();
});


/* ------------------------------------------------------------
   GENERAZIONE GRIGLIA CALENDARIO
   Calcola quali celle mostrare per il mese corrente.
   Il calendario parte sempre dal lunedì — se il mese inizia
   di mercoledì, le prime due celle mostrano giorni del mese
   precedente per riempire la riga.
   ------------------------------------------------------------ */
function generaCalendario() {
    /* Aggiorniamo il titolo con il mese e l'anno corrente */
    const nomiMesi = [
        'Gennaio', 'Febbraio', 'Marzo', 'Aprile',
        'Maggio', 'Giugno', 'Luglio', 'Agosto',
        'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];
    calendarioTitolo.textContent = `${nomiMesi[meseCorrente]} ${annoCorrente}`;

    /* Primo giorno del mese — getDay() restituisce 0=domenica, 1=lunedì...
       Convertiamo al formato europeo: 0=lunedì, 6=domenica */
    const primoCella  = new Date(annoCorrente, meseCorrente, 1);
    let   giornoInizio = primoCella.getDay(); /* 0=dom, 1=lun... */
    giornoInizio = giornoInizio === 0 ? 6 : giornoInizio - 1; /* converti a lun=0 */

    /* Ultimo giorno del mese — passando 0 come giorno otteniamo
       l'ultimo giorno del mese precedente, che è il nostro mese + 1 */
    const ultimoGiorno = new Date(annoCorrente, meseCorrente + 1, 0).getDate();

    /* Data di oggi per evidenziare la cella corrente */
    const oggi = new Date();

    /* Svuotiamo la griglia e ricostruiamo tutto */
    calendarioGrid.innerHTML = '';

    /* Celle dei giorni del mese precedente per riempire la prima riga */
    const ultimoMesePrecedente = new Date(annoCorrente, meseCorrente, 0).getDate();
    for (let i = giornoInizio - 1; i >= 0; i--) {
        const cella = creaCella(ultimoMesePrecedente - i, true);
        calendarioGrid.appendChild(cella);
    }

    /* Celle dei giorni del mese corrente */
    for (let giorno = 1; giorno <= ultimoGiorno; giorno++) {
        const isOggi = (
            giorno         === oggi.getDate()    &&
            meseCorrente   === oggi.getMonth()   &&
            annoCorrente   === oggi.getFullYear()
        );
        const cella = creaCella(giorno, false, isOggi);
        calendarioGrid.appendChild(cella);
    }

    /* Celle dei giorni del mese successivo per completare l'ultima riga.
       La griglia deve avere sempre un multiplo di 7 celle */
    const totCelle  = giornoInizio + ultimoGiorno;
    const righe     = Math.ceil(totCelle / 7);
    const celleFinali = (righe * 7) - totCelle;
    for (let i = 1; i <= celleFinali; i++) {
        const cella = creaCella(i, true);
        calendarioGrid.appendChild(cella);
    }

    /* Inseriamo gli eventi nelle celle corrispondenti */
    inserisciEventiNelleCalendario();
}


/* ------------------------------------------------------------
   CREAZIONE CELLA
   Crea un elemento DOM per una singola cella del calendario.
   altroMese: true se il giorno appartiene al mese precedente
   o successivo — viene mostrato opaco.
   ------------------------------------------------------------ */
function creaCella(giorno, altroMese = false, isOggi = false) {
    const cella = document.createElement('div');
    cella.className = 'calendario-cella';

    if (altroMese) cella.classList.add('altro-mese');
    if (isOggi)    cella.classList.add('oggi');

    /* Salviamo la data sulla cella come attributo data-*
       per poterla recuperare quando l'utente clicca */
    if (!altroMese) {
        const dataStr = `${annoCorrente}-${String(meseCorrente + 1).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
        cella.dataset.data = dataStr;

        /* Al click su una cella vuota apriamo il modal
           con la data pre-compilata */
        cella.addEventListener('click', () => {
            apriModalNuovo(dataStr);
        });
    }

    cella.innerHTML = `
        <div class="cella-numero">${giorno}</div>
        <div class="cella-eventi" id="cella-${giorno}-${altroMese ? 'altro' : meseCorrente}"></div>
    `;

    return cella;
}


/* ------------------------------------------------------------
   INSERIMENTO EVENTI NELLE CELLE
   Dopo aver generato la griglia, iteriamo sugli eventi
   del mese corrente e inseriamo le pillole colorate
   nelle celle corrispondenti.
   ------------------------------------------------------------ */
function inserisciEventiNelleCalendario() {
    /* Filtriamo solo gli eventi del mese corrente */
    const eventidelMese = tuttiGliEventi.filter(e => {
        const data = new Date(e.data);
        return data.getMonth()   === meseCorrente &&
               data.getFullYear() === annoCorrente;
    });

    eventidelMese.forEach(evento => {
        const data  = new Date(evento.data);
        const giorno = data.getDate();
        const contenitore = document.getElementById(`cella-${giorno}-${meseCorrente}`);
        if (!contenitore) return;

        /* Mostriamo massimo 3 eventi per cella —
           se ce ne sono di più aggiungiamo "+N altri" */
        const eventiGia = contenitore.querySelectorAll('.cella-evento').length;
        if (eventiGia >= 3) {
            /* Aggiorniamo il contatore "+N altri" se esiste già */
            let altri = contenitore.querySelector('.cella-altri');
            if (!altri) {
                altri = document.createElement('div');
                altri.className = 'cella-altri';
                contenitore.appendChild(altri);
            }
            const nascosti = eventidelMese.filter(e => {
                const d = new Date(e.data);
                return d.getDate() === giorno;
            }).length - 3;
            altri.textContent = `+${nascosti} altri`;
            return;
        }

        const colore = evento.materia_colore || '#6366F1';
        const pillola = document.createElement('div');
        pillola.className = 'cella-evento';
        pillola.style.background = colore + '33'; /* 33 = 20% opacità in hex */
        pillola.style.color      = colore;
        pillola.style.borderLeft = `2px solid ${colore}`;
        pillola.textContent      = evento.titolo;

        /* Al click sulla pillola apriamo il modal di modifica */
        pillola.addEventListener('click', (e) => {
            e.stopPropagation(); /* evita che si apra anche il modal nuovo */
            apriModalModifica(evento);
        });

        contenitore.appendChild(pillola);
    });
}


/* ------------------------------------------------------------
   LISTA EVENTI
   Vista alternativa al calendario — mostra tutti gli eventi
   futuri in ordine cronologico con possibilità di filtro.
   ------------------------------------------------------------ */
function aggiornaLista() {
    const oggi    = new Date().toISOString().split('T')[0];
    const filtro  = filtroTipo.value;

    /* Filtriamo per data futura e tipo selezionato */
    let eventi = tuttiGliEventi.filter(e => e.data >= oggi);
    if (filtro) {
        eventi = eventi.filter(e => e.tipo === filtro);
    }

    listaLoading.hidden = true;

    if (eventi.length === 0) {
        listaEventi.hidden = true;
        listaEmpty.hidden  = false;
        return;
    }

    listaEventi.hidden = false;
    listaEmpty.hidden  = true;

    listaEventi.innerHTML = eventi.map(evento => {
        const colore = evento.materia_colore || '#6366F1';
        const data   = new Date(evento.data).toLocaleDateString('it-IT', {
            weekday: 'short',
            day:     '2-digit',
            month:   'long'
        });

        const badgeClass = {
            verifica:       'badge-danger',
            compito:        'badge-primary',
            interrogazione: 'badge-warning',
            altro:          'badge-gray'
        }[evento.tipo] || 'badge-gray';

        return `
            <li class="lista-evento-item">
                <div class="lista-evento-colore" style="background: ${colore}"></div>
                <div class="lista-evento-body">
                    <div class="lista-evento-titolo ${evento.completato ? 'completato' : ''}">
                        ${evento.titolo}
                    </div>
                    <div class="lista-evento-meta">
                        <span class="lista-evento-data">${data}</span>
                        ${evento.materia_nome
                            ? `<span class="lista-evento-materia">· ${evento.materia_nome}</span>`
                            : ''}
                        <span class="badge ${badgeClass}">${evento.tipo}</span>
                    </div>
                </div>
                <div class="lista-evento-azioni">
                    <button class="btn btn-ghost btn-sm" onclick="apriModalModifica(${JSON.stringify(evento).replace(/"/g, '&quot;')})">
                        ✏️
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="apriModalElimina(${evento.id})">
                        🗑️
                    </button>
                </div>
            </li>
        `;
    }).join('');
}

/* Aggiorniamo la lista quando cambia il filtro */
filtroTipo.addEventListener('change', aggiornaLista);


/* ------------------------------------------------------------
   MODAL NUOVO EVENTO
   Apre il modal con i campi vuoti e la data pre-compilata
   se l'utente ha cliccato su una cella del calendario.
   ------------------------------------------------------------ */
function apriModalNuovo(dataPrecompilata = '') {
    eventoInModifica = null;
    modalTitolo.textContent    = 'Nuovo evento';
    completatoGroup.hidden     = true; /* il checkbox completato non serve in creazione */

    /* Puliamo tutti i campi del form */
    formEvento.reset();

    /* Pre-compiliamo la data se arriva dal click su una cella */
    if (dataPrecompilata) {
        campoData.value = dataPrecompilata;
    }

    modalEvento.classList.add('active');
}

function chiudiModalEvento() {
    modalEvento.classList.remove('active');
    formEvento.reset();
    eventoInModifica = null;
    /* Puliamo gli errori di validazione */
    document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
}

btnNuovo.addEventListener('click',   () => apriModalNuovo());
btnClose.addEventListener('click',   chiudiModalEvento);
btnAnnulla.addEventListener('click', chiudiModalEvento);

/* Chiude il modal cliccando sull'overlay */
modalEvento.addEventListener('click', (e) => {
    if (e.target === modalEvento) chiudiModalEvento();
});


/* ------------------------------------------------------------
   MODAL MODIFICA EVENTO
   Apre il modal con i campi pre-compilati con i dati
   dell'evento selezionato.
   ------------------------------------------------------------ */
function apriModalModifica(evento) {
    eventoInModifica           = evento.id;
    modalTitolo.textContent    = 'Modifica evento';
    completatoGroup.hidden     = false; /* in modifica mostriamo il checkbox */

    /* Pre-compiliamo tutti i campi con i dati esistenti */
    campoTitolo.value     = evento.titolo;
    campoTipo.value       = evento.tipo;
    
    /* 
       SISTEMAZIONE DATA DEFINITIVA:
       Poiché ora il backend invia la data come stringa pura (es. "2024-10-27") 
       grazie a DATE_FORMAT, non c'è più alcun rischio di shifting.
       Assegniamo semplicemente il valore al campo input.
    */
    if (evento.data) {
        campoData.value = evento.data; 
    }

    campoOra.value        = evento.ora        || '';
    campoMateria.value    = evento.materia_id  || '';
    campoNote.value       = evento.note        || '';
    campoCompletato.checked = evento.completato || false;

    modalEvento.classList.add('active');
}

/* ------------------------------------------------------------
   SUBMIT FORM EVENTO
   Gestisce sia la creazione che la modifica — la differenza
   è determinata da eventoInModifica: null = nuovo, id = modifica.
   ------------------------------------------------------------ */
formEvento.addEventListener('submit', async (e) => {
    e.preventDefault();

    /* Validazione campi obbligatori */
    let valido = true;
    document.querySelectorAll('.form-error').forEach(el => el.textContent = '');

    if (!campoTitolo.value.trim()) {
        document.getElementById('evento-titolo-error').textContent = 'Titolo obbligatorio';
        valido = false;
    }
    if (!campoTipo.value) {
        document.getElementById('evento-tipo-error').textContent = 'Tipo obbligatorio';
        valido = false;
    }
    if (!campoData.value) {
        document.getElementById('evento-data-error').textContent = 'Data obbligatoria';
        valido = false;
    }
    if (!valido) return;

    setLoading('btn-salva', true);

    /* Costruiamo l'oggetto con i dati del form */
    const dati = {
        titolo:     campoTitolo.value.trim(),
        tipo:       campoTipo.value,
        data:       campoData.value,
        ora:        campoOra.value      || null,
        materia_id: campoMateria.value  || null,
        note:       campoNote.value     || null,
        completato: campoCompletato.checked,
    };

    try {
        if (eventoInModifica) {
            /* Modifica evento esistente */
            await api.aggiornaEvento(eventoInModifica, dati);
            showToast('Evento aggiornato', 'success');
        } else {
            /* Creazione nuovo evento */
            await api.creaEvento(dati);
            showToast('Evento creato', 'success');
        }

        chiudiModalEvento();
        /* Ricarichiamo i dati dall'API e ridisegniamo tutto */
        await caricaDati();

    } catch (err) {
        console.error(err);
        showToast('Errore nel salvataggio', 'danger');
    } finally {
        setLoading('btn-salva', false);
    }
});


/* ------------------------------------------------------------
   MODAL ELIMINA EVENTO
   Modal di conferma separato — evita eliminazioni accidentali.
   ------------------------------------------------------------ */
function apriModalElimina(id) {
    eventoElimina = id;
    modalElimina.classList.add('active');
}

function chiudiModalElimina() {
    modalElimina.classList.remove('active');
    eventoElimina = null;
}

btnEliminaClose.addEventListener('click',   chiudiModalElimina);
btnEliminaAnnulla.addEventListener('click', chiudiModalElimina);

modalElimina.addEventListener('click', (e) => {
    if (e.target === modalElimina) chiudiModalElimina();
});

btnEliminaConferma.addEventListener('click', async () => {
    if (!eventoElimina) return;

    setLoading('btn-elimina-conferma', true);

    try {
        await api.eliminaEvento(eventoElimina);
        showToast('Evento eliminato', 'success');
        chiudiModalElimina();
        await caricaDati();
    } catch (err) {
        console.error(err);
        showToast('Errore durante l\'eliminazione', 'danger');
    } finally {
        setLoading('btn-elimina-conferma', false);
    }
});


/* ------------------------------------------------------------
   CARICAMENTO DATI
   Carica eventi e materie dall'API in parallelo.
   Le materie servono per il select nel modal evento.
   ------------------------------------------------------------ */
async function caricaDati() {
    try {
        /* Recuperiamo in parallelo gli eventi e le materie dell'utente */
        const [eventi, materie] = await Promise.all([
            api.getEventi(),
            api.getMaterie(),
        ]);

        tuttiGliEventi = eventi;
        tutteLeMaterie = materie;

        /* Popoliamo il menu a tendina delle materie nel modal di creazione evento */
        campoMateria.innerHTML = '<option value="">Nessuna materia</option>';
        materie.forEach(m => {
            const opt = document.createElement('option');
            opt.value       = m.id;
            opt.textContent = m.nome;
            campoMateria.appendChild(opt);
        });

        /* Ridisegniamo l'intera griglia del calendario e la lista cronologica */
        generaCalendario();
        aggiornaLista();

    } catch (err) {
        console.error(err);
        showToast('Errore nel caricamento degli eventi', 'danger');
    } finally {
        /* ------------------------------------------------------------
           SCOMPARSA INDICATORI DI CARICAMENTO:
           Nascondiamo lo spinner del calendario e quello della lista eventi.
           L'uso del finally assicura che l'utente possa comunque interagire 
           con la pagina anche se il caricamento dei dati è fallito.
           ------------------------------------------------------------ */
        calendarioLoading.style.display = 'none';
        listaLoading.hidden = true;
    }
}


/* ------------------------------------------------------------
   HELPERS UI
   Funzioni di supporto — stesse di dashboard.js.
   In un progetto più grande andrebbero in utils.js.
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
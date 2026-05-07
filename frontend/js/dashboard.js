/* ============================================================
   js/dashboard.js
   Logica della dashboard — carica i dati dall'API, aggiorna
   le statistiche, popola le liste di eventi e file recenti.
   ============================================================ */


/* ------------------------------------------------------------
   PROTEZIONE DELLA PAGINA
   Tutte le pagine tranne index.html controllano subito se
   l'utente è loggato. Se non c'è token nel localStorage,
   lo mandiamo al login prima ancora di caricare qualsiasi dato.
   Questo controllo va fatto prima di tutto il resto.
   ------------------------------------------------------------ */
if (!localStorage.getItem('token')) {
    window.location.href = 'index.html';
}


/* ------------------------------------------------------------
   SELEZIONE ELEMENTI DOM
   Salviamo tutti i riferimenti agli elementi HTML in variabili
   all'inizio — stessa logica di auth.js, il browser cerca
   ogni elemento nel DOM una volta sola.
   ------------------------------------------------------------ */

/* Navbar — avatar e dropdown */
const userAvatar   = document.getElementById('user-avatar');
const userDropdown = document.getElementById('user-dropdown');
const dropdownName = document.getElementById('dropdown-name');
const btnLogout    = document.getElementById('btn-logout');

/* Intestazione pagina */
const userNome = document.getElementById('user-nome');

/* Card statistiche */
const statEventi = document.getElementById('stat-eventi');
const statFiles  = document.getElementById('stat-files');
const statQuiz   = document.getElementById('stat-quiz');
const statGruppi = document.getElementById('stat-gruppi');

/* Sezione eventi */
const eventiLoading = document.getElementById('eventi-loading');
const eventiList    = document.getElementById('eventi-list');
const eventiEmpty   = document.getElementById('eventi-empty');

/* Sezione file */
const filesLoading = document.getElementById('files-loading');
const filesList    = document.getElementById('files-list');
const filesEmpty   = document.getElementById('files-empty');

/* Toast container */
const toastContainer = document.getElementById('toast-container');


/* ------------------------------------------------------------
   INIZIALIZZAZIONE NAVBAR
   Leggiamo il nome dal localStorage — viene salvato lì
   al momento del login da auth.js — e lo usiamo per:
   - mostrare le iniziali nell'avatar
   - mostrare il nome nel dropdown
   - salutare l'utente nel titolo della pagina
   ------------------------------------------------------------ */
const nome = localStorage.getItem('nome') || 'Utente';

/* Iniziali dell'utente — prendiamo la prima lettera di ogni parola
   del nome, massimo due lettere (es. "Mario Rossi" → "MR") */
const iniziali = nome
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

userAvatar.textContent   = iniziali;
dropdownName.textContent = nome;
userNome.textContent     = nome.split(' ')[0]; /* solo il primo nome nel saluto */

/* Evidenziamo il link della pagina corrente nella navbar —
   confrontiamo data-page con il nome del file corrente */
document.querySelectorAll('.navbar-link').forEach(link => {
    if (link.dataset.page === 'dashboard') {
        link.classList.add('active');
    }
});


/* ------------------------------------------------------------
   DROPDOWN AVATAR
   Mostra e nasconde il menu al click sull'avatar.
   Chiude il dropdown se l'utente clicca fuori da esso —
   questo è il pattern standard per i menu a tendina.
   ------------------------------------------------------------ */
userAvatar.addEventListener('click', (e) => {
    /* stopPropagation impedisce che il click si propaghi
       al document — altrimenti il listener sotto lo chiuderebbe
       subito dopo averlo aperto */
    e.stopPropagation();
    userDropdown.hidden = !userDropdown.hidden;
});

/* Chiude il dropdown cliccando ovunque fuori da esso */
document.addEventListener('click', () => {
    userDropdown.hidden = true;
});


/* ------------------------------------------------------------
   LOGOUT
   Rimuoviamo token e nome dal localStorage e torniamo al login.
   Non serve chiamare il backend — il token JWT è stateless,
   basta eliminarlo lato client per "disconnettere" l'utente.
   ------------------------------------------------------------ */
btnLogout.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('nome');
    window.location.href = 'index.html';
});


/* ------------------------------------------------------------
   CARICAMENTO DATI
   Carichiamo tutti i dati in parallelo con Promise.all —
   invece di aspettare che ogni chiamata finisca prima di
   iniziare la successiva, le lanciamo tutte insieme.
   Il tempo totale è quello della chiamata più lenta,
   non la somma di tutte le chiamate.
   ------------------------------------------------------------ */
async function caricaDashboard() {
    try {
        /* Promise.all aspetta che TUTTE le promise si risolvano.
           Se anche solo una fallisce, va nel catch */
        const [eventi, files, quiz, gruppi] = await Promise.all([
            api.getEventi(),
            api.getFiles(),
            api.getQuiz(),
            api.getGruppi(),
        ]);

        /* Aggiorniamo le statistiche con i conteggi */
        aggiornaStatistiche(eventi, files, quiz, gruppi);

        /* Popoliamo le liste nella griglia principale */
        mostraEventi(eventi);
        mostraFiles(files);

    } catch (err) {
        console.error(err);
        showToast('Errore nel caricamento dei dati', 'danger');
    }
}


/* ------------------------------------------------------------
   STATISTICHE
   Aggiorna i valori nelle quattro card in cima alla dashboard.
   Per gli eventi mostriamo solo quelli futuri — quelli già
   passati non sono "in programma".
   ------------------------------------------------------------ */
function aggiornaStatistiche(eventi, files, quiz, gruppi) {
    /* Filtriamo solo gli eventi con data >= oggi */
    const oggi = new Date().toISOString().split('T')[0]; /* formato YYYY-MM-DD */
    const eventiFuturi = eventi.filter(e => e.data >= oggi);

    statEventi.textContent = eventiFuturi.length;
    statFiles.textContent  = files.length;
    statQuiz.textContent   = quiz.length;
    statGruppi.textContent = gruppi.length;
}


/* ------------------------------------------------------------
   LISTA EVENTI
   Mostra i prossimi 5 eventi ordinati per data.
   Se non ce ne sono, mostra lo stato vuoto.
   Nasconde lo spinner una volta caricati i dati.
   ------------------------------------------------------------ */
function mostraEventi(eventi) {
    /* Nascondiamo lo spinner ora che i dati sono arrivati */
    eventiLoading.hidden = true;

    /* Filtriamo solo gli eventi futuri e prendiamo i primi 5 */
    const oggi = new Date().toISOString().split('T')[0];
    const prossimi = eventi
        .filter(e => e.data >= oggi)
        .slice(0, 5);

    if (prossimi.length === 0) {
        eventiEmpty.hidden = false;
        return;
    }

    eventiList.hidden = false;

    /* Costruiamo l'HTML per ogni evento e lo inseriamo nella lista.
       innerHTML è accettabile qui perché i dati vengono dal nostro
       backend autenticato, non direttamente dall'utente */
    eventiList.innerHTML = prossimi.map(evento => {
        /* Colore del pallino — usiamo il colore della materia se
           disponibile, altrimenti il colore primario di default */
        const colore = evento.materia_colore || '#6366F1';

        /* Formattiamo la data in italiano — DD/MM invece di YYYY-MM-DD */
        const data = new Date(evento.data);
        const dataFormattata = data.toLocaleDateString('it-IT', {
            day:   '2-digit',
            month: 'short'
        });

        /* Badge colorato per il tipo di evento */
        const badgeClass = {
            verifica:       'badge-danger',
            compito:        'badge-primary',
            interrogazione: 'badge-warning',
            altro:          'badge-gray'
        }[evento.tipo] || 'badge-gray';

        return `
            <li class="evento-item">
                <span class="evento-dot" style="background: ${colore}"></span>
                <span class="evento-titolo">${evento.titolo}</span>
                <span class="evento-data">${dataFormattata}</span>
                <span class="badge ${badgeClass}">${evento.tipo}</span>
            </li>
        `;
    }).join('');
}


/* ------------------------------------------------------------
   LISTA FILE
   Mostra i 5 file più recenti.
   L'icona cambia in base al tipo MIME del file.
   ------------------------------------------------------------ */
function mostraFiles(files) {
    filesLoading.hidden = true;

    /* Prendiamo solo i primi 5 — la GET li restituisce già
       ordinati per data_upload DESC */
    const recenti = files.slice(0, 5);

    if (recenti.length === 0) {
        filesEmpty.hidden = false;
        return;
    }

    filesList.hidden = false;

    filesList.innerHTML = recenti.map(file => {
        /* Scegliamo l'emoji in base al tipo MIME del file */
        const icona = getIconaFile(file.tipo_mime);

        /* Convertiamo i byte in una stringa leggibile —
           KB se sotto 1MB, MB altrimenti */
        const dimensione = file.dimensione_bytes
            ? file.dimensione_bytes > 1024 * 1024
                ? `${(file.dimensione_bytes / 1024 / 1024).toFixed(1)} MB`
                : `${Math.round(file.dimensione_bytes / 1024)} KB`
            : '';

        return `
            <li class="file-item">
                <div class="file-icon">${icona}</div>
                <span class="file-nome">${file.nome_originale}</span>
                <span class="file-size">${dimensione}</span>
            </li>
        `;
    }).join('');
}


/* ------------------------------------------------------------
   ICONA FILE
   Restituisce un'emoji in base al tipo MIME del file.
   Usata nella lista file per dare un feedback visivo rapido
   sul tipo di contenuto senza leggere il nome.
   ------------------------------------------------------------ */
function getIconaFile(mime) {
    if (!mime) return '📄';
    if (mime.startsWith('image/'))       return '🖼️';
    if (mime === 'application/pdf')      return '📕';
    if (mime.includes('word'))           return '📝';
    if (mime.includes('spreadsheet') || mime.includes('excel')) return '📊';
    if (mime.includes('presentation') || mime.includes('powerpoint')) return '📑';
    if (mime.startsWith('video/'))       return '🎬';
    if (mime.startsWith('audio/'))       return '🎵';
    if (mime.includes('zip') || mime.includes('rar')) return '🗜️';
    return '📄';
}


/* ------------------------------------------------------------
   TOAST
   Notifica temporanea — stessa implementazione di auth.js.
   In un progetto più grande questa funzione andrebbe in un
   file utils.js condiviso invece di ripeterla in ogni pagina.
   ------------------------------------------------------------ */
function showToast(message, type = '') {
    const toast = document.createElement('div');
    toast.className = `toast ${type ? 'toast-' + type : ''}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}


/* ------------------------------------------------------------
   AVVIO
   Chiamiamo caricaDashboard() all'avvio della pagina.
   Tutto il resto è già stato inizializzato sopra in modo
   sincrono — i dati dell'API arrivano dopo in modo asincrono.
   ------------------------------------------------------------ */
caricaDashboard();
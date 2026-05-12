/* ============================================================
   js/materie.js
   Logica della pagina materie — gestisce il caricamento, 
   la creazione e l'eliminazione delle materie dell'utente.
   Le materie servono come categorie per organizzare 
   eventi, file e quiz.
   ============================================================ */

/* ------------------------------------------------------------
   PROTEZIONE PAGINA E INIZIALIZZAZIONE NAVBAR
   Controlla il token JWT per assicurarsi che l'utente sia loggato.
   Imposta l'avatar e il nome utente nella navbar.
   ------------------------------------------------------------ */
if (!localStorage.getItem('token')) {
    window.location.href = 'index.html';
}

const nome     = localStorage.getItem('nome') || 'Utente';
const iniziali = nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

document.getElementById('user-avatar').textContent   = iniziali;
document.getElementById('dropdown-name').textContent = nome;

document.querySelectorAll('.navbar-link').forEach(link => {
    if (link.dataset.page === 'materie') link.classList.add('active');
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
   SELEZIONE ELEMENTI DOM
   ------------------------------------------------------------ */
const materieLoading = document.getElementById('materie-loading');
const materieGrid    = document.getElementById('materie-grid');
const materieEmpty   = document.getElementById('materie-empty');

const modalMateria     = document.getElementById('modal-materia');
const modalMateriaClose = document.getElementById('modal-materia-close');
const btnNuovaMateria  = document.getElementById('btn-nuova-materia');
const btnMateriaAnnulla = document.getElementById('btn-materia-annulla');
const formMateria       = document.getElementById('form-materia');
const campoNome        = document.getElementById('materia-nome');
const campoColore      = document.getElementById('materia-colore');
const btnMateriaSalva   = document.getElementById('btn-materia-salva'); 
const toastContainer = document.getElementById('toast-container');

let materiaInModifica = null; // Contiene l'ID della materia in modifica, null se stiamo creando


/* ------------------------------------------------------------
   CARICAMENTO MATERIE
   Recupera la lista materie dall'API e le visualizza nella griglia.
   In caso di errore, nasconde lo spinner e mostra un toast.
   ------------------------------------------------------------ */
async function caricaDati() {
    try {
        const materie = await api.getMaterie();
        
        /* Nascondiamo lo spinner e gestiamo l'eventualità che non ci siano materie */
        materieLoading.hidden = true;

        if (materie.length === 0) {
            materieGrid.hidden  = true;
            materieEmpty.hidden = false;
            return;
        }

        materieGrid.hidden  = false;
        materieEmpty.hidden = true;

        /* Generiamo l'HTML per ogni materia. 
           Aggiungiamo un bottone di modifica (✏️) accanto a quello di eliminazione. */
        materieGrid.innerHTML = materie.map(m => `
            <div class="materia-card" style="border-left: 5px solid ${m.colore}">
                <div class="materia-info">
                    <span class="materia-nome">${m.nome}</span>
                    <div class la="materia-color-preview" style="background: ${m.colore}"></div>
                </div>
                <div class="materia-azioni">
                    <button class="btn-modifica-materia" onclick="apriModalMateria(${m.id}, '${m.nome}', '${m.colore}')">✏️</button>
                    <button class="btn-elimina-materia" onclick="eliminaMateria(${m.id})">🗑️</button>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error(err);
        showToast('Errore nel caricamento delle materie', 'danger');
    } finally {
        /* Lo spinner deve scomparire sempre, a prescindere dall'esito */
        materieLoading.hidden = true;
    }
}


/* ----------------------------------------------------------------------------
   APERTURA MODAL MATERIA
   Questa funzione gestisce l'apertura del modal in due modalità:
   - Se chiamata senza argomenti: Modalità CREAZIONE (campi vuoti).
   - Se chiamata con parametri: Modalità MODIFICA (campi pre-compilati).
   ---------------------------------------------------------------------------- */
function apriModalMateria(id = null, nome = '', colore = '#6366F1') {
    /* Impostiamo l'ID della materia in modifica. Se è null, siamo in modalità creazione */
    materiaInModifica = id; 
    
    /* 1. Gestione Testi: Cambiamo titolo del modal e testo del bottone in base al contesto */
    const modalTitle = document.querySelector('.modal-title');
    if (id) {
        modalTitle.textContent = 'Modifica materia';
        btnMateriaSalva.querySelector('.btn-text').textContent = 'Aggiorna materia';
    } else {
        modalTitle.textContent = 'Nuova materia';
        btnMateriaSalva.querySelector('.btn-text').textContent = 'Crea materia';
    }

    /* 2. Pre-compilazione Campi: Inseriamo i dati della materia o resettiamo il form */
    campoNome.value = nome;
    campoColore.value = colore;
    
    /* Rimuoviamo eventuali messaggi di errore rimasti aperti */
    document.getElementById('materia-nome-error').textContent = '';
    
    /* Mostriamo il modal */
    modalMateria.classList.add('active');
}

function chiudiModalMateria() {
    modalMateria.classList.remove('active');
}

/* ============================================================================
   SITUAZIONE PUNTO 4: QUI VANNO GLI EVENT LISTENERS
   Queste righe collegano i bottoni HTML alle funzioni scritte sopra.
   Senza queste righe, cliccando sui bottoni non succederebbe nulla.
   ============================================================================ */

// Quando clicco su "+ Nuova materia", l'app deve aprire il modal in modalità creazione
btnNuovaMateria.addEventListener('click', () => apriModalMateria()); 

// Quando clicco la X in alto a destra, il modal deve chiudersi
modalMateriaClose.addEventListener('click', chiudiModalMateria);

// Quando clicco il tasto "Annulla", il modal deve chiudersi
btnMateriaAnnulla.addEventListener('click', chiudiModalMateria);

// Se clicco fuori dal modal (sull'overlay scuro), il modal deve chiudersi
modalMateria.addEventListener('click', (e) => {
    if (e.target === modalMateria) chiudiModalMateria();
});

/* ----------------------------------------------------------------------------
   SUBMIT FORM MATERIA
   Invia i dati al server. Sceglie tra POST (creazione) e PUT (modifica)
   in base allo stato della variabile 'materiaInModifica'.
   ---------------------------------------------------------------------------- */
formMateria.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nomeVal = campoNome.value.trim();
    if (!nomeVal) {
        document.getElementById('materia-nome-error').textContent = 'Nome obbligatorio';
        return;
    }

    /* Attiviamo lo spinner e disabilitiamo il bottone */
    setLoading('btn-materia-salva', true);

    try {
        const dati = { 
            nome: nomeVal, 
            colore: campoColore.value 
        };

        if (materiaInModifica) {
            /* MODALITÀ MODIFICA: Aggiorna la materia esistente tramite ID */
            await api.aggiornaMateria(materiaInModifica, dati);
            showToast('Materia aggiornata con successo', 'success');
        } else {
            /* MODALITÀ CREAZIONE: Crea una nuova materia */
            await api.creaMateria(nomeVal, campoColore.value);
            showToast('Materia creata con successo', 'success');
        }
        
        /* Chiudiamo il modal e ricarichiamo la lista per aggiornare la vista */
        chiudiModalMateria();
        await caricaDati(); 
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Errore durante l\'operazione', 'danger');
    } finally {
        /* Ripristiniamo il bottone e resettiamo l'ID di modifica */
        setLoading('btn-materia-salva', false);
        materiaInModifica = null; 
    }
});


/* ------------------------------------------------------------
   ELIMINAZIONE MATERIA
   Rimuove la materia tramite API e aggiorna la griglia.
   ------------------------------------------------------------ */
async function eliminaMateria(id) {
    if (!confirm('Sei sicuro di voler eliminare questa materia? Gli eventi e i quiz associati rimarranno, ma non avranno più una materia assegnata.')) {
        return;
    }

    try {
        await api.eliminaMateria(id);
        showToast('Materia eliminata', 'success');
        await caricaDati();
    } catch (err) {
        console.error(err);
        showToast('Errore durante l\'eliminazione', 'danger');
    }
}


/* ------------------------------------------------------------
   HELPERS UI
   ------------------------------------------------------------ */
function setLoading(btnId, loading) {
    const btn     = document.getElementById(btnId);
    const text    = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');
    if (!btn) return;
    btn.disabled   = loading;
    text.hidden     = loading;
    spinner.hidden  = !loading;
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

/* Avvio caricamento dati */
caricaDati();
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

const toastContainer = document.getElementById('toast-container');


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
           Ogni card ha un bottone di eliminazione rapida. */
        materieGrid.innerHTML = materie.map(m => `
            <div class="materia-card" style="border-left: 5px solid ${m.colore}">
                <div class="materia-info">
                    <span class="materia-nome">${m.nome}</span>
                    <div class="materia-color-preview" style="background: ${m.colore}"></div>
                </div>
                <button class="btn-elimina-materia" onclick="eliminaMateria(${m.id})">🗑️</button>
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


/* ------------------------------------------------------------
   GESTIONE MODAL (APERTURA / CHIUSURA)
   ------------------------------------------------------------ */
function apriModalMateria() {
    formMateria.reset();
    document.getElementById('materia-nome-error').textContent = '';
    modalMateria.classList.add('active');
}

function chiudiModalMateria() {
    modalMateria.classList.remove('active');
}

btnNuovaMateria.addEventListener('click', apriModalMateria);
modalMateriaClose.addEventListener('click', chiudiModalMateria);
btnMateriaAnnulla.addEventListener('click', chiudiModalMateria);

modalMateria.addEventListener('click', (e) => {
    if (e.target === modalMateria) chiudiModalMateria();
});


/* ------------------------------------------------------------
   SUBMIT NUOVA MATERIA
   Valida l'input del nome e invia i dati al backend tramite api.js.
   ------------------------------------------------------------ */
formMateria.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nomeVal = campoNome.value.trim();
    if (!nomeVal) {
        document.getElementById('materia-nome-error').textContent = 'Nome obbligatorio';
        return;
    }

    setLoading('btn-materia-salva', true);

    try {
        /* Chiamata API per creare la materia con nome e colore scelto */
        await api.creaMateria(nomeVal, campoColore.value);
        showToast('Materia creata con successo', 'success');
        chiudiModalMateria();
        /* Ricarichiamo la lista per aggiornare la vista */
        await caricaDati();
    } catch (err) {
        console.error(err);
        showToast('Errore durante la creazione della materia', 'danger');
    } finally {
        setLoading('btn-materia-salva', false);
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
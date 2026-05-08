/* ============================================================
   js/gruppi.js
   Logica della pagina gruppi — carica i gruppi dall'API,
   gestisce creazione, visualizzazione dettaglio, aggiunta
   e rimozione membri, eliminazione gruppo.
   Le azioni disponibili cambiano in base al ruolo dell'utente:
   admin vede tutto, membro solo la lista.
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
    if (link.dataset.page === 'gruppi') link.classList.add('active');
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
   gruppoCorrente tiene il gruppo aperto nel modal dettaglio —
   serve per sapere su quale gruppo eseguire le azioni
   (aggiungi membro, elimina gruppo ecc.).
   ------------------------------------------------------------ */
let tuttiIGruppi  = [];
let gruppoCorrente = null; /* oggetto gruppo aperto nel modal dettaglio */
let gruppoEliminaId = null;


/* ------------------------------------------------------------
   SELEZIONE ELEMENTI DOM
   ------------------------------------------------------------ */

/* Lista gruppi */
const gruppiLoading = document.getElementById('gruppi-loading');
const gruppiGrid    = document.getElementById('gruppi-grid');
const gruppiEmpty   = document.getElementById('gruppi-empty');

/* Modal nuovo gruppo */
const modalGruppo      = document.getElementById('modal-gruppo');
const modalGruppoClose = document.getElementById('modal-gruppo-close');
const btnNuovoGruppo   = document.getElementById('btn-nuovo-gruppo');
const btnGruppoAnnulla = document.getElementById('btn-gruppo-annulla');
const formGruppo       = document.getElementById('form-gruppo');
const campoNome        = document.getElementById('gruppo-nome');
const campoDescrizione = document.getElementById('gruppo-descrizione');

/* Modal dettaglio gruppo */
const modalDettaglio      = document.getElementById('modal-dettaglio');
const modalDettaglioClose = document.getElementById('modal-dettaglio-close');
const dettaglioNome       = document.getElementById('dettaglio-nome');
const dettaglioDescrizione = document.getElementById('dettaglio-descrizione');
const dettaglioCount      = document.getElementById('dettaglio-count');
const membroList          = document.getElementById('membri-list');
const aggiungiMembroWrap  = document.getElementById('aggiungi-membro-wrap');
const nuovoMembroEmail    = document.getElementById('nuovo-membro-email');
const btnAggiungiMembro   = document.getElementById('btn-aggiungi-membro');
const zonaPericolosa      = document.getElementById('zona-pericolosa');
const btnEliminaGruppo    = document.getElementById('btn-elimina-gruppo');

/* Modal elimina gruppo */
const modalElimina       = document.getElementById('modal-elimina');
const modalEliminaClose  = document.getElementById('modal-elimina-close');
const btnEliminaAnnulla  = document.getElementById('btn-elimina-annulla');
const btnEliminaConferma = document.getElementById('btn-elimina-conferma');

/* Toast */
const toastContainer = document.getElementById('toast-container');


/* ------------------------------------------------------------
   MODAL NUOVO GRUPPO — apertura e chiusura
   ------------------------------------------------------------ */
function apriModalGruppo() {
    formGruppo.reset();
    document.getElementById('gruppo-nome-error').textContent = '';
    modalGruppo.classList.add('active');
}

function chiudiModalGruppo() {
    modalGruppo.classList.remove('active');
}

btnNuovoGruppo.addEventListener('click',   apriModalGruppo);
modalGruppoClose.addEventListener('click', chiudiModalGruppo);
btnGruppoAnnulla.addEventListener('click', chiudiModalGruppo);
modalGruppo.addEventListener('click', (e) => {
    if (e.target === modalGruppo) chiudiModalGruppo();
});


/* ------------------------------------------------------------
   SUBMIT NUOVO GRUPPO
   ------------------------------------------------------------ */
formGruppo.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nomeVal = campoNome.value.trim();
    if (!nomeVal) {
        document.getElementById('gruppo-nome-error').textContent = 'Nome obbligatorio';
        return;
    }

    setLoading('btn-gruppo-salva', true);

    try {
        await api.creaGruppo(nomeVal, campoDescrizione.value.trim());
        showToast('Gruppo creato', 'success');
        chiudiModalGruppo();
        await caricaDati();
    } catch (err) {
        console.error(err);
        showToast('Errore nella creazione del gruppo', 'danger');
    } finally {
        setLoading('btn-gruppo-salva', false);
    }
});


/* ------------------------------------------------------------
   MOSTRA GRUPPI
   Genera le card per ogni gruppo e le inserisce nella griglia.
   ------------------------------------------------------------ */
function mostraGruppi() {
    gruppiLoading.hidden = true;

    if (tuttiIGruppi.length === 0) {
        gruppiGrid.hidden  = true;
        gruppiEmpty.hidden = false;
        return;
    }

    gruppiGrid.hidden  = false;
    gruppiEmpty.hidden = true;

    gruppiGrid.innerHTML = tuttiIGruppi.map(gruppo => `
        <div class="gruppo-card" onclick="apriDettaglio(${gruppo.id})">
            <div class="gruppo-card-header">
                <div class="gruppo-card-nome">${gruppo.nome}</div>
                <span class="gruppo-ruolo ${gruppo.ruolo}">${gruppo.ruolo}</span>
            </div>
            ${gruppo.descrizione
                ? `<p class="gruppo-card-descrizione">${gruppo.descrizione}</p>`
                : ''}
            <div class="gruppo-card-footer">
                👥 ${gruppo.numero_membri} ${gruppo.numero_membri === 1 ? 'membro' : 'membri'}
            </div>
        </div>
    `).join('');
}


/* ------------------------------------------------------------
   MODAL DETTAGLIO GRUPPO
   Apre il modal con i dettagli del gruppo selezionato.
   Mostra la lista membri e le azioni disponibili in base
   al ruolo dell'utente loggato.
   ------------------------------------------------------------ */
async function apriDettaglio(id) {
    /* Troviamo il gruppo nella lista locale */
    gruppoCorrente = tuttiIGruppi.find(g => g.id === id);
    if (!gruppoCorrente) return;

    /* Popoliamo il modal con i dati del gruppo */
    dettaglioNome.textContent        = gruppoCorrente.nome;
    dettaglioDescrizione.textContent = gruppoCorrente.descrizione || '';
    dettaglioDescrizione.hidden      = !gruppoCorrente.descrizione;
    dettaglioCount.textContent       = `${gruppoCorrente.numero_membri} membri`;

    /* Mostriamo le azioni admin solo se l'utente è admin */
    const isAdmin = gruppoCorrente.ruolo === 'admin';
    aggiungiMembroWrap.hidden = !isAdmin;
    zonaPericolosa.hidden     = !isAdmin;

    /* Svuotiamo la lista membri e mostriamo uno spinner */
    membroList.innerHTML = `
        <li style="padding: 1rem; text-align: center">
            <div class="spinner"></div>
        </li>
    `;

    modalDettaglio.classList.add('active');

    /* Carichiamo i membri del gruppo — non li abbiamo nella lista
       principale perché sarebbe troppo dato da caricare all'inizio.
       Li carichiamo solo quando l'utente apre il dettaglio. */
    try {
        /* Nota: questo endpoint non è ancora implementato nel backend —
           in un progetto completo aggiungeresti GET /api/gruppi/:id/membri.
           Per ora usiamo i dati che abbiamo già. */
        mostraMembri([]);
    } catch (err) {
        console.error(err);
        showToast('Errore nel caricamento dei membri', 'danger');
    }
}

/* ------------------------------------------------------------
   MOSTRA MEMBRI
   Genera la lista HTML dei membri del gruppo.
   Il bottone rimuovi è visibile solo all'admin e non
   sul proprio nome.
   ------------------------------------------------------------ */
function mostraMembri(membri) {
    if (membri.length === 0) {
        membroList.innerHTML = `
            <li style="padding: 1rem; text-align: center; color: var(--gray-400); font-size: var(--text-sm)">
                Nessun membro da mostrare
            </li>
        `;
        return;
    }

    const isAdmin = gruppoCorrente?.ruolo === 'admin';

    membroList.innerHTML = membri.map(m => {
        /* Iniziali del membro per l'avatar */
        const ini = m.nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

        /* Bottone rimuovi — visibile solo se admin e non è se stesso */
        const btnRimuovi = (isAdmin && m.ruolo !== 'admin')
            ? `<button class="btn-rimuovi-membro" onclick="rimuoviMembro(${m.id})">
                 Rimuovi
               </button>`
            : '';

        return `
            <li class="membro-item">
                <div class="membro-avatar">${ini}</div>
                <div class="membro-info">
                    <div class="membro-nome">${m.nome}</div>
                    <div class="membro-ruolo">${m.ruolo}</div>
                </div>
                ${btnRimuovi}
            </li>
        `;
    }).join('');
}

function chiudiModalDettaglio() {
    modalDettaglio.classList.remove('active');
    gruppoCorrente = null;
    nuovoMembroEmail.value = '';
}

modalDettaglioClose.addEventListener('click', chiudiModalDettaglio);
modalDettaglio.addEventListener('click', (e) => {
    if (e.target === modalDettaglio) chiudiModalDettaglio();
});


/* ------------------------------------------------------------
   AGGIUNGI MEMBRO
   L'admin inserisce l'email del nuovo membro e lo aggiunge
   al gruppo. La route backend cerca l'utente per email.
   ------------------------------------------------------------ */
btnAggiungiMembro.addEventListener('click', async () => {
    const email = nuovoMembroEmail.value.trim();
    if (!email || !gruppoCorrente) return;

    setLoading('btn-aggiungi-membro', true);

    try {
        await api.aggiungiMembro(gruppoCorrente.id, email);
        showToast('Membro aggiunto', 'success');
        nuovoMembroEmail.value = '';
        /* Ricarichiamo i dati per aggiornare il contatore membri */
        await caricaDati();
        /* Aggiorniamo il contatore nel modal senza chiuderlo */
        const gruppoAggiornato = tuttiIGruppi.find(g => g.id === gruppoCorrente.id);
        if (gruppoAggiornato) {
            gruppoCorrente = gruppoAggiornato;
            dettaglioCount.textContent = `${gruppoAggiornato.numero_membri} membri`;
        }
    } catch (err) {
        console.error(err);
        showToast('Errore nell\'aggiunta del membro', 'danger');
    } finally {
        setLoading('btn-aggiungi-membro', false);
    }
});


/* ------------------------------------------------------------
   RIMUOVI MEMBRO
   ------------------------------------------------------------ */
async function rimuoviMembro(utenteId) {
    if (!gruppoCorrente) return;

    try {
        await api.rimuoviMembro(gruppoCorrente.id, utenteId);
        showToast('Membro rimosso', 'success');
        await caricaDati();
        const gruppoAggiornato = tuttiIGruppi.find(g => g.id === gruppoCorrente.id);
        if (gruppoAggiornato) {
            gruppoCorrente = gruppoAggiornato;
            dettaglioCount.textContent = `${gruppoAggiornato.numero_membri} membri`;
        }
    } catch (err) {
        console.error(err);
        showToast('Errore nella rimozione del membro', 'danger');
    }
}


/* ------------------------------------------------------------
   MODAL ELIMINA GRUPPO
   Aperto dal bottone nella zona pericolosa del modal dettaglio.
   ------------------------------------------------------------ */
btnEliminaGruppo.addEventListener('click', () => {
    if (!gruppoCorrente) return;
    gruppoEliminaId = gruppoCorrente.id;
    modalElimina.classList.add('active');
});

function chiudiModalElimina() {
    modalElimina.classList.remove('active');
    gruppoEliminaId = null;
}

modalEliminaClose.addEventListener('click',  chiudiModalElimina);
btnEliminaAnnulla.addEventListener('click',  chiudiModalElimina);
modalElimina.addEventListener('click', (e) => {
    if (e.target === modalElimina) chiudiModalElimina();
});

btnEliminaConferma.addEventListener('click', async () => {
    if (!gruppoEliminaId) return;

    setLoading('btn-elimina-conferma', true);

    try {
        await api.eliminaGruppo(gruppoEliminaId);
        showToast('Gruppo eliminato', 'success');
        chiudiModalElimina();
        chiudiModalDettaglio();
        await caricaDati();
    } catch (err) {
        console.error(err);
        showToast('Errore nell\'eliminazione del gruppo', 'danger');
    } finally {
        setLoading('btn-elimina-conferma', false);
    }
});


/* ------------------------------------------------------------
   CARICAMENTO DATI
   ------------------------------------------------------------ */
async function caricaDati() {
    try {
        tuttiIGruppi = await api.getGruppi();
        mostraGruppi();
    } catch (err) {
        console.error(err);
        showToast('Errore nel caricamento dei gruppi', 'danger');
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
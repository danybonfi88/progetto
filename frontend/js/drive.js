/* ============================================================
   js/drive.js
   Logica della pagina drive — carica i file dall'API,
   gestisce upload con FormData, filtra per materia,
   elimina file con conferma.
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
    if (link.dataset.page === 'drive') link.classList.add('active');
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
   ------------------------------------------------------------ */
let tuttiIFile    = [];
let tutteLeMaterie = [];
let tuttiIGruppi  = [];
let filtromateria  = ''; 
let fileSelezionato = null; 
let fileEliminaId   = null; 


/* ------------------------------------------------------------
   SELEZIONE ELEMENTI DOM
   ------------------------------------------------------------ */

/* Griglia file */
const filesLoading = document.getElementById('files-loading');
const filesGrid    = document.getElementById('files-grid');
const filesEmpty   = document.getElementById('files-empty');
const driveFiltri  = document.querySelector('.drive-filtri');

/* Input file nascosto */
const inputFile    = document.getElementById('input-file');
const btnUpload    = document.getElementById('btn-upload');

/* Modal upload */
const modalUpload        = document.getElementById('modal-upload');
const modalUploadClose   = document.getElementById('modal-upload-close');
const btnUploadAnnulla   = document.getElementById('btn-upload-annulla');
const formUpload         = document.getElementById('form-upload');
const uploadMateria      = document.getElementById('upload-materia');
const uploadGruppo       = document.getElementById('upload-gruppo');
const filePreviewNome    = document.getElementById('file-preview-nome');
const filePreviewSize    = document.getElementById('file-preview-size');
const filePreviewIcona   = document.getElementById('file-preview-icona');

const modalRinomina = document.getElementById('modal-rinomina');
const modalRinominaClose = document.getElementById('modal-rinomina-close');
const formRinomina = document.getElementById('form-rinomina');
const rinominaInput = document.getElementById('rinomina-nome');
const btnRinominaAnnulla = document.getElementById('btn-rinomina-annulla');
let fileInModificaId = null;

/* Modal elimina */
const modalElimina       = document.getElementById('modal-elimina');
const modalEliminaClose  = document.getElementById('modal-elimina-close');
const btnEliminaAnnulla  = document.getElementById('btn-elimina-annulla');
const btnEliminaConferma = document.getElementById('btn-elimina-conferma');

/* Toast */
const toastContainer = document.getElementById('toast-container');


/* ------------------------------------------------------------
   UPLOAD FILE — APERTURA FILE PICKER
   ------------------------------------------------------------ */
btnUpload.addEventListener('click', () => {
    inputFile.click();
});

inputFile.addEventListener('change', () => {
    const file = inputFile.files[0];
    if (!file) return;

    fileSelezionato = file;

    filePreviewNome.textContent  = file.name;
    filePreviewSize.textContent  = formattaDimensione(file.size);
    filePreviewIcona.textContent = getIconaFile(file.type);

    modalUpload.classList.add('active');
    inputFile.value = '';
});


function chiudiModalUpload() {
    modalUpload.classList.remove('active');
    fileSelezionato = null;
    formUpload.reset();
}

modalUploadClose.addEventListener('click',  chiudiModalUpload);
btnUploadAnnulla.addEventListener('click',  chiudiModalUpload);
modalUpload.addEventListener('click', (e) => {
    if (e.target === modalUpload) chiudiModalUpload();
});


/* ------------------------------------------------------------
   SUBMIT UPLOAD
   ------------------------------------------------------------ */
formUpload.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!fileSelezionato) {
        showToast('Seleziona un file da caricare', 'warning');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileSelezionato);
    formData.append('materia_id', uploadMateria.value);
    formData.append('gruppo_id', uploadGruppo.value);

    setLoading('btn-upload-conferma', true);

    try {
        await api.uploadFile(formData);
        showToast('File caricato con successo!', 'success');
        chiudiModalUpload();
        await caricaDati(); 
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Errore nel caricamento del file', 'danger');
    } finally {
        setLoading('btn-upload-conferma', false);
    }
});


/* ------------------------------------------------------------
   FILTRI MATERIA
   ------------------------------------------------------------ */
driveFiltri.addEventListener('click', (e) => {
    if (!e.target.classList.contains('filtro-btn')) return;

    /* Reset visivo dei bottoni: rimuovo la classe active e i colori personalizzati */
    driveFiltri.querySelectorAll('.filtro-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.backgroundColor = '';
        btn.style.color = '';
    });

    /* Attivo il bottone selezionato */
    e.target.classList.add('active');
    
    /* Se il bottone ha un colore associato (materia), lo applichiamo */
    if (e.target.dataset.color) {
        e.target.style.backgroundColor = e.target.dataset.color;
        e.target.style.color = 'white';
    }

    filtromateria = e.target.dataset.materia;
    mostraFile();
});


/* ------------------------------------------------------------
   MOSTRA FILE
   ------------------------------------------------------------ */
function mostraFile() {
    filesLoading.hidden = true;

    if (tuttiIFile.length === 0) {
        filesGrid.hidden = true;
        filesEmpty.hidden = false;
        return;
    }

    filesGrid.hidden = false;
    filesEmpty.hidden = true;

    /* 
       FILTRAGGIO:
       Semplifichiamo il confronto convertendo l'ID in stringa per evitare errori 
       di tipo tra numeri (dal DB) e stringhe (dal dataset HTML).
    */
    const filesFiltrati = tuttiIFile.filter(file => {
        if (filtromateria === '') return true;
        return String(file.materia_id) === filtromateria;
    });

    if (filesFiltrati.length === 0) {
        filesGrid.hidden = true;
        filesEmpty.hidden = false;
        return;
    }

    filesGrid.innerHTML = filesFiltrati.map(file => `
        <div class="file-card">
            <div class="file-info">
                <div class="file-icon">📄</div>
                <div class="file-details">
                    <div class="file-name">${file.nome_originale}</div>
                    <div class="file-meta">${file.dimensione_bytes} bytes</div>
                </div>
            </div>
            <div class="file-actions">
                <!-- NUOVO: Bottone Anteprima (Apre in nuova scheda) -->
                <button class="btn btn-outline btn-sm" onclick="apriAnteprima(${file.id})" title="Apri anteprima">
                    🔍
                </button>
                <!-- Bottone Download (Forza il salvataggio) -->
                <button class="btn btn-outline btn-sm" onclick="scaricaFile(${file.id}, '${file.nome_originale}')" title="Scarica">
                    📥
                </button>
                <button class="btn btn-outline btn-sm" onclick="apriModalRinomina(${file.id}, '${file.nome_originale}')" title="Rinomina">
                    ✏️
                </button>
                <button class="btn btn-danger btn-sm" onclick="apriModalElimina(event, ${file.id})" title="Elimina">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
}

/* 
   FUNZIONE APRI ANTEPRIMA
   Chiama l'endpoint /view per mostrare il file senza scaricarlo.
*/
function apriAnteprima(id) {
    const token = localStorage.getItem('token');
    window.open(`/api/files/${id}/view?token=${token}`, '_blank');
}

/* 
   FUNZIONE SCARICA FILE
   Chiama l'endpoint /download per forzare il salvataggio sul PC.
*/
function scaricaFile(id, nomeOriginale) {
    const token = localStorage.getItem('token');
    window.open(`/api/files/${id}/download?token=${token}`, '_blank');
}


/* ------------------------------------------------------------
   MODAL ELIMINA FILE
   ------------------------------------------------------------ */
function apriModalElimina(e, id) {
    e.stopPropagation();
    fileEliminaId = id;
    modalElimina.classList.add('active');
}

function chiudiModalElimina() {
    modalElimina.classList.remove('active');
    fileEliminaId = null;
}

modalEliminaClose.addEventListener('click',  chiudiModalElimina);
btnEliminaAnnulla.addEventListener('click',  chiudiModalElimina);
modalElimina.addEventListener('click', (e) => {
    if (e.target === modalElimina) chiudiModalElimina();
});

btnEliminaConferma.addEventListener('click', async () => {
    if (!fileEliminaId) return;

    setLoading('btn-elimina-conferma', true);

    try {
        await api.eliminaFile(fileEliminaId);
        showToast('File eliminato', 'success');
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
   ------------------------------------------------------------ */
async function caricaDati() {
    try {
        const [files, materie, gruppi] = await Promise.all([
            api.getFiles(),
            api.getMaterie(),
            api.getGruppi(),
        ]);

        tuttiIFile     = files;
        tutteLeMaterie = materie;
        tuttiIGruppi   = gruppi;

        driveFiltri.innerHTML = `<button class="filtro-btn active" data-materia="">Tutti</button>`;
        materie.forEach(m => {
            const btn = document.createElement('button');
            btn.className        = 'filtro-btn';
            btn.dataset.materia  = m.id;
            btn.dataset.color    = m.colore; // Salviamo il colore per usarlo al click
            btn.textContent      = m.nome;
            driveFiltri.appendChild(btn);
        });

        uploadMateria.innerHTML = '<option value="">Nessuna materia</option>';
        materie.forEach(m => {
            const opt       = document.createElement('option');
            opt.value       = m.id;
            opt.textContent = m.nome;
            uploadMateria.appendChild(opt);
        });

        uploadGruppo.innerHTML = '<option value="">Solo per me</option>';
        gruppi.forEach(g => {
            const opt       = document.createElement('option');
        opt.value       = g.id;
        opt.textContent = g.nome;
        uploadGruppo.appendChild(opt);
        });

        mostraFile();

    } catch (err) {
        console.error(err);
        showToast('Errore nel caricamento dei file', 'danger');
    } finally {
        filesLoading.hidden = true;
    }
}

/* 
   GESTIONE RINOMINA FILE
*/
function apriModalRinomina(id, nomeAttuale) {
    fileInModificaId = id;
    rinominaInput.value = nomeAttuale;
    modalRinomina.classList.add('active');
}

function chiudiModalRinomina() {
    modalRinomina.classList.remove('active');
    fileInModificaId = null;
}

modalRinominaClose.addEventListener('click', chiudiModalRinomina);
btnRinominaAnnulla.addEventListener('click', chiudiModalRinomina);

formRinomina.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nuovoNome = rinominaInput.value.trim();

    if (!nuovoNome) return;

    setLoading('btn-rinomina-salva', true);

    try {
        await api.aggiornaFile(fileInModificaId, { nome_file: nuovoNome });
        showToast('File rinominato con successo', 'success');
        chiudiModalRinomina();
        await caricaDati(); 
    } catch (err) {
        showToast(err.message || 'Errore durante la rinomina', 'danger');
    } finally {
        setLoading('btn-rinomina-salva', false);
    }
});


/* ------------------------------------------------------------
   HELPERS
   ------------------------------------------------------------ */

function formattaDimensione(bytes) {
    if (!bytes) return '';
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
}

function getIconaFile(mime) {
    if (!mime) return '📄';
    if (mime.startsWith('image/'))       return '🖼️';
    if (mime === 'application/pdf')      return '📕';
    if (mime.includes('word'))           return '📝';
    if (mime.includes('spreadsheet') || mime.includes('excel')) return '📊';
    if (mime.includes('presentation') || mime.includes('powerpoint')) return '📑';
    if (mime.startsWith('video/'))       return '🎬';
    if (mime.startsWith('audio/'))      return '🎵';
    if (mime.includes('zip') || mime.includes('rar')) return '🗜️';
    return '📄';
}

function setLoading(btnId, loading) {
    const btn     = document.getElementById(btnId);
    if (!btn) return;
    const text    = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');
    btn.disabled   = loading;
    if (text) text.hiddenS = loading;
    if (spinner) spinner.hidden = !loading;
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

caricaDati();

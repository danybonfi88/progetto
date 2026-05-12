/* ============================================================
   js/drive.js
   Logica della pagina drive — carica i file dall'API,
   gestisce upload con FormData, filtra per materia,
   elimina file con conferma.
   ============================================================ */


/* ------------------------------------------------------------
   PROTEZIONE PAGINA E INIZIALIZZAZIONE NAVBAR
   Stesso pattern di calendario.js.
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
   tuttiIFile contiene tutti i file caricati dall'API —
   filtriamo localmente per materia senza ricaricare dal server.
   fileSelezionato tiene il riferimento al File object scelto
   dall'utente prima di confermare l'upload.
   ------------------------------------------------------------ */
let tuttiIFile    = [];
let tutteLeMaterie = [];
let tuttiIGruppi  = [];
let filtromateria  = ''; /* id materia selezionata, '' = tutti */
let fileSelezionato = null; /* File object selezionato dall'utente */
let fileEliminaId   = null; /* id del file da eliminare */


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

/* Modal elimina */
const modalElimina       = document.getElementById('modal-elimina');
const modalEliminaClose  = document.getElementById('modal-elimina-close');
const btnEliminaAnnulla  = document.getElementById('btn-elimina-annulla');
const btnEliminaConferma = document.getElementById('btn-elimina-conferma');

/* Toast */
const toastContainer = document.getElementById('toast-container');


/* ------------------------------------------------------------
   UPLOAD FILE — APERTURA FILE PICKER
   Quando l'utente clicca su "Carica file", attiviamo
   programmaticamente l'input file nascosto. Questo ci permette
   di usare il nostro bottone stilizzato invece del brutto
   input file nativo del browser.
   ------------------------------------------------------------ */
btnUpload.addEventListener('click', () => {
    inputFile.click();
});

/* Quando l'utente seleziona un file dal file picker,
   mostriamo il modal di conferma con l'anteprima del file */
inputFile.addEventListener('change', () => {
    const file = inputFile.files[0];
    if (!file) return;

    fileSelezionato = file;

    /* Mostriamo l'anteprima nel modal — nome, dimensione, icona */
    filePreviewNome.textContent  = file.name;
    filePreviewSize.textContent  = formattaDimensione(file.size);
    filePreviewIcona.textContent = getIconaFile(file.type);

    modalUpload.classList.add('active');

    /* Resettiamo l'input file così se l'utente annulla
       e riprova a caricare lo stesso file, l'evento change
       si attiva di nuovo */
    inputFile.value = '';
});


/* ------------------------------------------------------------
   MODAL UPLOAD — APERTURA E CHIUSURA
   ------------------------------------------------------------ */
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
   Costruiamo un FormData con il file e i campi del form.
   Non usiamo JSON perché i file non possono essere serializzati
   in JSON — devono viaggiare come multipart/form-data.
   api.uploadFile() usa requestFile() che non imposta
   Content-Type manualmente, lasciando che il browser lo faccia
   con il boundary corretto per multer.
   ------------------------------------------------------------ */
formUpload.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fileSelezionato) return;

    setLoading('btn-upload-conferma', true);

    try {
        /* FormData è il modo corretto per mandare file via fetch —
           aggiungiamo il file e i campi opzionali */
        const formData = new FormData();
        formData.append('file',       fileSelezionato);
        formData.append('materia_id', uploadMateria.value);
        formData.append('gruppo_id',  uploadGruppo.value);

        await api.uploadFile(formData);

        showToast('File caricato con successo', 'success');
        chiudiModalUpload();
        /* Ricarichiamo la lista file dal server */
        await caricaDati();

    } catch (err) {
        console.error(err);
        showToast('Errore durante l\'upload', 'danger');
    } finally {
        setLoading('btn-upload-conferma', false);
    }
});


/* ------------------------------------------------------------
   FILTRI MATERIA
   Aggiorniamo filtromateria e ridisegniamo la griglia —
   non ricarichiamo dall'API, filtriamo tuttiIFile localmente.
   ------------------------------------------------------------ */
driveFiltri.addEventListener('click', (e) => {
    /* Verifichiamo che il click sia su un bottone filtro */
    if (!e.target.classList.contains('filtro-btn')) return;

    /* Rimuoviamo .active da tutti e lo aggiungiamo al cliccato */
    driveFiltri.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');

    filtromateria = e.target.dataset.materia;
    mostraFile();
});


/* ------------------------------------------------------------
   MOSTRA FILE
   Filtra tuttiIFile per materia selezionata e aggiorna
   la griglia — ogni file diventa una card cliccabile.
   ------------------------------------------------------------ */
function mostraFile() {
    let file = tuttiIFile;

    /* Filtro per materia — se filtromateria è vuoto mostriamo tutti */
    if (filtromateria) {
        file = file.filter(f => String(f.materia_id) === filtromateria);
    }

    if (file.length === 0) {
        filesGrid.hidden  = true;
        filesEmpty.hidden = false;
        return;
    }

    filesGrid.hidden  = false;
    filesEmpty.hidden = true;

    filesGrid.innerHTML = file.map(f => {
        const icona      = getIconaFile(f.tipo_mime);
        const dimensione = formattaDimensione(f.dimensione_bytes);
        const data       = new Date(f.data_upload).toLocaleDateString('it-IT', {
            day:   '2-digit',
            month: 'short',
            year:  'numeric'
        });

        /* Badge materia con il colore della materia stessa */
        const materiaBadge = f.materia_nome
            ? `<span class="file-card-materia" style="background: ${f.materia_colore}22; color: ${f.materia_colore}">
                 ${f.materia_nome}
               </span>`
            : '';

        /* Badge gruppo se il file è condiviso */
        const gruppoBadge = f.gruppo_id
            ? `<span class="file-card-gruppo">👥 Condiviso</span>`
            : '';

        return `
            <div class="file-card" onclick="scaricaFile(${f.id}, '${f.nome_originale}')">
                <button class="file-card-elimina" onclick="apriModalElimina(event, ${f.id})">🗑️</button>
                <div class="file-card-icona">${icona}</div>
                <div class="file-card-nome">${f.nome_originale}</div>
                <div class="file-card-meta">
                    <span>${dimensione}</span>
                    <span>${data}</span>
                </div>
                ${materiaBadge}
                ${gruppoBadge}
            </div>
        `;
    }).join('');
}


/* ------------------------------------------------------------
   DOWNLOAD FILE
   Il server non espone i file staticamente — per scaricarli
   dobbiamo fare una richiesta autenticata e usare l'API.
   Per semplicità apriamo una nuova tab con l'URL del backend.
   In un progetto reale si userebbe un endpoint dedicato
   che serve il file con l'header Content-Disposition.
   ------------------------------------------------------------ */
function scaricaFile(id, nomeOriginale) {
    /* Apriamo l'endpoint di download in una nuova tab */
    const token = localStorage.getItem('token');
    window.open(`/api/files/${id}/download?token=${token}`, '_blank');
}


/* ------------------------------------------------------------
   MODAL ELIMINA FILE
   ------------------------------------------------------------ */
function apriModalElimina(e, id) {
    /* stopPropagation impedisce che il click si propaghi
       alla card sottostante attivando il download */
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
   Carica file, materie e gruppi in parallelo.
   Le materie servono per i filtri e il select del modal.
   I gruppi servono per il select di condivisione nel modal.
   ------------------------------------------------------------ */
async function caricaDati() {
    try {
        /* Recuperiamo file, materie e gruppi per popolare la pagina e i filtri */
        const [files, materie, gruppi] = await Promise.all([
            api.getFiles(),
            api.getMaterie(),
            api.getGruppi(),
        ]);

        tuttiIFile     = files;
        tutteLeMaterie = materie;
        tuttiIGruppi   = gruppi;

        /* Generiamo i bottoni dei filtri per materia in base ai dati ricevuti */
        driveFiltri.innerHTML = `<button class="filtro-btn active" data-materia="">Tutti</button>`;
        materie.forEach(m => {
            const btn = document.createElement('button');
            btn.className        = 'filtro-btn';
            btn.dataset.materia  = m.id;
            btn.textContent      = m.nome;
            btn.addEventListener('click', () => {
                btn.style.background  = m.colore;
                btn.style.borderColor = m.colore;
            });
            driveFiltri.appendChild(btn);
        });

        /* Popoliamo i selettori nel modal di upload (materia e gruppo di condivisione) */
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

        /* Infine, generiamo la griglia dei file effettivamente caricati */
        mostraFile();

    } catch (err) {
        console.error(err);
        showToast('Errore nel caricamento dei file', 'danger');
    } finally {
        /* ------------------------------------------------------------
           SCOMPARSA INDICATORE DI CARICAMENTO:
           Nascondiamo lo spinner principale del drive. Questo deve 
           accadere sempre per evitare che l'utente rimanga bloccato 
           da una rotellina infinita in caso di errore del server.
           ------------------------------------------------------------ */
        filesLoading.hidden = true;
    }
}


/* ------------------------------------------------------------
   HELPERS
   ------------------------------------------------------------ */

/* Converte i byte in una stringa leggibile */
function formattaDimensione(bytes) {
    if (!bytes) return '';
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
}

/* Restituisce un'emoji in base al tipo MIME */
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
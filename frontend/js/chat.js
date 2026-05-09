/* ============================================================
   js/chat.js
   Logica della pagina chat — carica la cronologia dall'API,
   gestisce invio messaggi, mostra le bolle di risposta,
   gestisce i suggerimenti e la cancellazione della cronologia.
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
    if (link.dataset.page === 'chat') link.classList.add('active');
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
const chatMessages     = document.getElementById('chat-messages');
const chatEmpty        = document.getElementById('chat-empty');
const chatSuggerimenti = document.getElementById('chat-suggerimenti');
const chatInput        = document.getElementById('chat-input');
const btnInvia         = document.getElementById('btn-invia');
const toastContainer   = document.getElementById('toast-container');

/* Modal cancella cronologia */
const modalClear      = document.getElementById('modal-clear');
const modalClearClose = document.getElementById('modal-clear-close');
const btnClear        = document.getElementById('btn-clear');
const btnClearAnnulla = document.getElementById('btn-clear-annulla');
const btnClearConferma = document.getElementById('btn-clear-conferma');


/* ------------------------------------------------------------
   AUTO-RESIZE TEXTAREA
   La textarea si espande automaticamente in base al contenuto —
   resettiamo l'altezza a 'auto' prima di leggere scrollHeight,
   altrimenti il valore non diminuisce quando si cancella testo.
   ------------------------------------------------------------ */
chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = chatInput.scrollHeight + 'px';

    /* Abilitiamo il bottone invio solo se c'è del testo */
    btnInvia.disabled = chatInput.value.trim() === '';
});


/* ------------------------------------------------------------
   INVIO CON ENTER
   Enter invia il messaggio, Shift+Enter va a capo.
   Questo è il comportamento standard delle chat moderne.
   ------------------------------------------------------------ */
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        /* Preveniamo il comportamento default di Enter
           che aggiungerebbe un a capo nella textarea */
        e.preventDefault();
        if (!btnInvia.disabled) {
            inviaMessaggio();
        }
    }
});

btnInvia.addEventListener('click', inviaMessaggio);


/* ------------------------------------------------------------
   SUGGERIMENTI
   Quando l'utente clicca su un suggerimento, il testo
   viene copiato nell'input e inviato automaticamente.
   I suggerimenti spariscono dopo il primo messaggio.
   ------------------------------------------------------------ */
function usaSuggerimento(btn) {
    chatInput.value = btn.textContent.trim();
    /* Aggiorniamo manualmente l'altezza della textarea */
    chatInput.style.height = 'auto';
    chatInput.style.height = chatInput.scrollHeight + 'px';
    btnInvia.disabled = false;
    inviaMessaggio();
}


/* ------------------------------------------------------------
   INVIO MESSAGGIO
   Sequenza di operazioni:
   1. leggi il testo dall'input
   2. mostra subito la bolla dell'utente (feedback immediato)
   3. mostra lo spinner di digitazione del bot
   4. chiama l'API e aspetta la risposta
   5. sostituisci lo spinner con la bolla del bot
   ------------------------------------------------------------ */
async function inviaMessaggio() {
    const testo = chatInput.value.trim();
    if (!testo) return;

    /* Puliamo l'input e disabilitiamo il bottone subito —
       non aspettiamo la risposta del server */
    chatInput.value        = '';
    chatInput.style.height = 'auto';
    btnInvia.disabled      = true;

    /* Nascondiamo lo stato vuoto e i suggerimenti al primo messaggio —
       non servono più una volta che la conversazione è iniziata */
    chatEmpty.hidden        = true;
    chatSuggerimenti.hidden = true;

    /* Aggiungiamo subito la bolla dell'utente — non aspettiamo
       la risposta del server per dare feedback immediato */
    aggiungiBolla(testo, 'user');

    /* Mostriamo lo spinner di digitazione del bot */
    const typing = aggiungiTyping();

    try {
        /* Chiamiamo l'API e aspettiamo la risposta */
        const data = await api.sendMsg(testo);

        /* Rimuoviamo lo spinner */
        typing.remove();

        if (data && data.risposta) {
            /* Aggiungiamo la bolla del bot con la risposta */
            aggiungiBolla(data.risposta, 'bot');
        } else {
            showToast('Errore nella risposta del bot', 'danger');
        }

    } catch (err) {
        console.error(err);
        typing.remove();
        showToast('Errore di connessione', 'danger');
    }
}


/* ------------------------------------------------------------
   AGGIUNGI BOLLA
   Crea e inserisce una bolla messaggio nell'area chat.
   mittente può essere 'user' o 'bot'.
   Dopo ogni inserimento scrolliamo automaticamente in fondo.
   ------------------------------------------------------------ */
function aggiungiBolla(testo, mittente) {
    const isUser   = mittente === 'user';
    const avatarTesto = isUser ? iniziali : '🤖';

    /* Formattiamo il timestamp in ore:minuti */
    const ora = new Date().toLocaleTimeString('it-IT', {
        hour:   '2-digit',
        minute: '2-digit'
    });

    const bolla = document.createElement('div');
    bolla.className = `chat-bolla ${mittente}`;
    bolla.innerHTML = `
        <div class="chat-bolla-header">
            <div class="chat-bolla-avatar">${avatarTesto}</div>
            <span class="chat-bolla-nome">${isUser ? nome.split(' ')[0] : 'Assistente AI'}</span>
        </div>
        <div class="chat-testo">${testo}</div>
        <div class="chat-timestamp">${ora}</div>
    `;

    chatMessages.appendChild(bolla);

    /* Scrolliamo in fondo — scrollTop = scrollHeight porta
       sempre all'ultimo messaggio aggiunto */
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return bolla;
}


/* ------------------------------------------------------------
   SPINNER DI DIGITAZIONE
   Tre puntini animati mostrati mentre il bot sta elaborando.
   Restituiamo il riferimento all'elemento così il chiamante
   può rimuoverlo quando arriva la risposta.
   ------------------------------------------------------------ */
function aggiungiTyping() {
    const typing = document.createElement('div');
    typing.className = 'chat-bolla bot';
    typing.innerHTML = `
        <div class="chat-bolla-header">
            <div class="chat-bolla-avatar">🤖</div>
            <span class="chat-bolla-nome">Assistente AI</span>
        </div>
        <div class="chat-typing">
            <div class="chat-typing-dot"></div>
            <div class="chat-typing-dot"></div>
            <div class="chat-typing-dot"></div>
        </div>
    `;

    chatMessages.appendChild(typing);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return typing;
}


/* ------------------------------------------------------------
   CARICAMENTO CRONOLOGIA
   All'avvio della pagina carichiamo i messaggi precedenti
   dal server e li mostriamo nella chat — così la conversazione
   continua da dove l'utente si era fermato.
   ------------------------------------------------------------ */
async function caricaCronologia() {
    try {
        const messaggi = await api.getChat();

        if (messaggi.length === 0) return;

        /* Se ci sono messaggi nascondiamo lo stato vuoto
           e i suggerimenti */
        chatEmpty.hidden        = true;
        chatSuggerimenti.hidden = true;

        /* Aggiungiamo ogni messaggio come bolla */
        messaggi.forEach(m => {
            aggiungiBolla(m.testo, m.mittente === 'user' ? 'user' : 'bot');
        });

    } catch (err) {
        console.error(err);
        showToast('Errore nel caricamento della cronologia', 'danger');
    }
}


/* ------------------------------------------------------------
   MODAL CANCELLA CRONOLOGIA
   ------------------------------------------------------------ */
function apriModalClear() {
    modalClear.classList.add('active');
}

function chiudiModalClear() {
    modalClear.classList.remove('active');
}

btnClear.addEventListener('click',        apriModalClear);
modalClearClose.addEventListener('click', chiudiModalClear);
btnClearAnnulla.addEventListener('click', chiudiModalClear);

modalClear.addEventListener('click', (e) => {
    if (e.target === modalClear) chiudiModalClear();
});

btnClearConferma.addEventListener('click', async () => {
    setLoading('btn-clear-conferma', true);

    try {
        await api.clearChat();
        showToast('Cronologia cancellata', 'success');
        chiudiModalClear();

        /* Rimuoviamo tutte le bolle dall'area messaggi —
           lasciamo solo lo stato vuoto e i suggerimenti */
        chatMessages.innerHTML = '';
        chatMessages.appendChild(chatEmpty);
        chatEmpty.hidden        = false;
        chatSuggerimenti.hidden = false;

    } catch (err) {
        console.error(err);
        showToast('Errore durante la cancellazione', 'danger');
    } finally {
        setLoading('btn-clear-conferma', false);
    }
});


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
caricaCronologia();
/* ============================================================
   js/api.js
   Centralizza tutte le chiamate fetch al backend.
   Va importato in OGNI pagina prima degli altri script,
   perché tutti i file JS usano le funzioni definite qui.

   Il vantaggio di centralizzare le fetch in un unico file è
   che il token JWT e l'header Authorization vengono aggiunti
   automaticamente a ogni richiesta — senza doverli ripetere
   in ogni file JS.
   ============================================================ */


/* ------------------------------------------------------------
   BASE URL
   Indirizzo base del backend. Usando un percorso relativo '/api'
   funziona sia in sviluppo che in produzione, perché Express
   serve il frontend sulla stessa porta del backend tramite
   express.static() — non c'è bisogno di specificare host e porta.
   ------------------------------------------------------------ */
const BASE_URL = '/api';


/* ------------------------------------------------------------
   FUNZIONE BASE — request()
   Tutte le funzioni dell'oggetto api usano questa funzione
   internamente. Si occupa di:
   - aggiungere il token JWT all'header Authorization
   - serializzare il body in JSON se presente
   - gestire il redirect al login se il token è scaduto
   - restituire la risposta già parsata come oggetto JavaScript
   ------------------------------------------------------------ */
async function request(method, endpoint, body = null) {
    /* Leggiamo il token dal localStorage — viene salvato lì
       al momento del login da auth.js */
    const token = localStorage.getItem('token');

    /* Costruiamo l'oggetto options per fetch() */
    const options = {
        method,
        headers: {
            /* Diciamo al server che mandiamo JSON */
            'Content-Type': 'application/json',
            /* Aggiungiamo il token JWT all'header Authorization.
               Il server lo legge in middleware/auth.js per
               verificare che l'utente sia autenticato.
               Se non c'è token (pagina pubblica), l'header
               viene omesso con una stringa vuota */
            'Authorization': token ? `Bearer ${token}` : ''
        }
    };

    /* Aggiungiamo il body solo se presente — le richieste GET
       e DELETE non hanno body, solo POST e PUT ce l'hanno.
       JSON.stringify() converte l'oggetto JavaScript in una
       stringa JSON che il server può leggere con req.body */
    if (body) {
        options.body = JSON.stringify(body);
    }

    /* Eseguiamo la fetch verso il backend */
    const res = await fetch(BASE_URL + endpoint, options);

    /* Se il server risponde con 401 o 403, l'utente non è autenticato.
       ATTENZIONE: Non facciamo il redirect se l'errore avviene durante il LOGIN,
       perché in quel caso l'errore indica semplicemente 'credenziali errate' 
       e non una sessione scaduta. */
    if ((res.status === 401 || res.status === 403) && !endpoint.includes('/auth/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('nome');
        window.location.href = 'index.html';
        return null;
    }

    /* Convertiamo la risposta in oggetto JavaScript e la
       restituiamo al chiamante. res.json() è asincrono —
       quindi usiamo await */
    return res.json();
}


/* ------------------------------------------------------------
   FUNZIONE SPECIALE — requestFile()
   Usata solo per l'upload dei file in drive.js.
   È separata da request() perché l'upload usa FormData
   invece di JSON — non bisogna impostare Content-Type
   manualmente perché il browser lo fa da solo aggiungendo
   il boundary necessario per il multipart/form-data.
   ------------------------------------------------------------ */
async function requestFile(endpoint, formData) {
    const token = localStorage.getItem('token');

    const res = await fetch(BASE_URL + endpoint, {
        method: 'POST',
        headers: {
            /* NON impostiamo Content-Type qui — con FormData
               il browser lo imposta automaticamente a
               'multipart/form-data' con il boundary corretto.
               Se lo impostassimo noi, multer non riuscirebbe
               a leggere il file */
            'Authorization': token ? `Bearer ${token}` : ''
        },
        body: formData
    });

    if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('nome');
        window.location.href = 'index.html';
        return null;
    }

    return res.json();
}


/* ------------------------------------------------------------
   OGGETTO API
   Raccoglie tutte le funzioni per comunicare con il backend,
   organizzate per risorsa. Ogni funzione corrisponde a un
   endpoint del backend.

   Usando un oggetto invece di funzioni globali separate,
   evitiamo di inquinare il namespace globale — tutte le
   funzioni sono accessibili tramite api.nomeRisorsa()
   invece di essere sparse nel global scope.
   ------------------------------------------------------------ */
const api = {

    /* ----------------------------------------------------------
       AUTH
       Le uniche funzioni senza token — login e register sono
       endpoint pubblici che non richiedono autenticazione.
    ---------------------------------------------------------- */

    /* POST /api/auth/login — manda email e password,
       riceve token e nome utente */
    login: (email, password) =>
        request('POST', '/auth/login', { email, password }),

    /* POST /api/auth/register — manda nome, email e password,
       riceve messaggio di conferma */
    register: (nome, email, password) =>
        request('POST', '/auth/register', { nome, email, password }),


    /* ----------------------------------------------------------
       MATERIE
    ---------------------------------------------------------- */

    /* GET /api/materie — lista tutte le materie dell'utente */
    getMaterie: () =>
        request('GET', '/materie'),

    /* POST /api/materie — crea una nuova materia */
    creaMateria: (nome, colore) =>
        request('POST', '/materie', { nome, colore }),

    /* DELETE /api/materie/:id — elimina una materia */
    eliminaMateria: (id) =>
        request('DELETE', `/materie/${id}`),


    /* ----------------------------------------------------------
       EVENTI
    ---------------------------------------------------------- */

    /* GET /api/eventi — lista eventi dell'utente e dei suoi gruppi */
    getEventi: () =>
        request('GET', '/eventi'),

    /* POST /api/eventi — crea un nuovo evento.
       data è un oggetto con tutti i campi dell'evento */
    creaEvento: (data) =>
        request('POST', '/eventi', data),

    /* PUT /api/eventi/:id — aggiorna un evento esistente */
    aggiornaEvento: (id, data) =>
        request('PUT', `/eventi/${id}`, data),

    /* DELETE /api/eventi/:id — elimina un evento */
    eliminaEvento: (id) =>
        request('DELETE', `/eventi/${id}`),


    /* ----------------------------------------------------------
       FILES
    ---------------------------------------------------------- */

    /* GET /api/files — lista file dell'utente e dei suoi gruppi */
    getFiles: () =>
        request('GET', '/files'),

    /* POST /api/files — upload di un file.
       Usa requestFile() invece di request() perché manda
       FormData invece di JSON */
    uploadFile: (formData) =>
        requestFile('/files', formData),

    /* DELETE /api/files/:id — elimina un file */
    eliminaFile: (id) =>
        request('DELETE', `/files/${id}`),


    /* ----------------------------------------------------------
       GRUPPI
    ---------------------------------------------------------- */

    /* GET /api/gruppi — lista gruppi dell'utente */
    getGruppi: () =>
        request('GET', '/gruppi'),

    /* POST /api/gruppi — crea un nuovo gruppo */
    creaGruppo: (nome, descrizione) =>
        request('POST', '/gruppi', { nome, descrizione }),

    /* POST /api/gruppi/:id/membri — aggiunge un membro al gruppo */
    aggiungiMembro: (id, email) =>
        request('POST', `/gruppi/${id}/membri`, { email }),

    /* DELETE /api/gruppi/:id/membri/:utenteId — rimuove un membro */
    rimuoviMembro: (gruppoId, utenteId) =>
        request('DELETE', `/gruppi/${gruppoId}/membri/${utenteId}`),

    /* DELETE /api/gruppi/:id — elimina un gruppo */
    eliminaGruppo: (id) =>
        request('DELETE', `/gruppi/${id}`),


    /* ----------------------------------------------------------
       QUIZ
    ---------------------------------------------------------- */

    /* GET /api/quiz — lista tutti i quiz dell'utente */
    getQuiz: () =>
        request('GET', '/quiz'),

    /* POST /api/quiz — crea un nuovo quiz */
    creaQuiz: (titolo, materia_id) =>
        request('POST', '/quiz', { titolo, materia_id }),

    /* DELETE /api/quiz/:id — elimina un quiz e tutte le sue domande */
    eliminaQuiz: (id) =>
        request('DELETE', `/quiz/${id}`),

    /* GET /api/quiz/:id/domande — lista domande di un quiz */
    getDomande: (id) =>
        request('GET', `/quiz/${id}/domande`),

    /* POST /api/quiz/:id/domande — aggiunge una domanda al quiz */
    creaDomanda: (id, data) =>
        request('POST', `/quiz/${id}/domande`, data),

    /* POST /api/quiz/:id/generate — genera automaticamente domande per un quiz tramite AI */
generateQuizQuestions: (id, argomento, numero) => 
    request('POST', `/quiz/${id}/generate`, { argomento, numero }),
    
    /* DELETE /api/quiz/:id/domande/:domandaId — elimina una domanda */
    eliminaDomanda: (quizId, domandaId) =>
        request('DELETE', `/quiz/${quizId}/domande/${domandaId}`),

    /* ----------------------------------------------------------
       CHAT
    ---------------------------------------------------------- */

    /* GET /api/chat — recupera tutta la cronologia messaggi */
    getChat: () =>
        request('GET', '/chat'),

    /* POST /api/chat — manda un messaggio e riceve la risposta AI */
    sendMsg: (testo) =>
        request('POST', '/chat', { testo }),

    /* DELETE /api/chat — cancella tutta la cronologia */
    clearChat: () =>
        request('DELETE', '/chat'),
};
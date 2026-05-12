/* ============================================================
   js/auth.js
   Logica della pagina di login e registrazione.
   Gestisce: switch tra tab, validazione form, chiamate API,
   salvataggio token, redirect alla dashboard.
   ============================================================ */


/* ------------------------------------------------------------
   REDIRECT SE GIÀ LOGGATO
   Se l'utente ha già un token valido nel localStorage e apre
   index.html, lo mandiamo direttamente alla dashboard —
   non ha senso mostrare il login a chi è già autenticato.
   Questo controllo va fatto subito, prima di tutto il resto.
   ------------------------------------------------------------ */
if (localStorage.getItem('token')) {
    window.location.href = 'dashboard.html';
}


/* ------------------------------------------------------------
   SELEZIONE ELEMENTI DOM
   Salviamo tutti i riferimenti agli elementi HTML in variabili
   all'inizio del file. È più efficiente che chiamare
   document.getElementById() ogni volta che serve — il browser
   deve cercare l'elemento nel DOM una volta sola.
   ------------------------------------------------------------ */

/* Tab */
const tabs      = document.querySelectorAll('.auth-tab');
const formLogin = document.getElementById('form-login');
const formReg   = document.getElementById('form-register');

/* Campi login */
const loginEmail    = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError    = document.getElementById('login-error');

/* Campi registrazione */
const regNome     = document.getElementById('register-nome');
const regEmail    = document.getElementById('register-email');
const regPassword = document.getElementById('register-password');
const regError    = document.getElementById('register-error');

/* Bottoni mostra/nascondi password */
const toggleLoginPsw = document.getElementById('toggle-login-password');
const toggleRegPsw   = document.getElementById('toggle-register-password');

/* Toast container — dove vengono inserite le notifiche */
const toastContainer = document.getElementById('toast-container');


/* ------------------------------------------------------------
   SWITCH TAB
   Quando l'utente clicca su "Accedi" o "Registrati",
   mostriamo il form corrispondente e nascondiamo l'altro.
   Usiamo .style.display per assicurarci che il CSS non 
   sovrascriva l'attributo hidden.
   ------------------------------------------------------------ */
tabs.forEach(tab => {
    tab.addEventListener('click', () => {

        /* Rimuovi .active da tutte le tab e aggiungila
           solo a quella cliccata */
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        /* Gestione visibilità dei form */
        if (tab.dataset.tab === 'login') {
            // Mostra login, nascondi registrazione
            formLogin.style.display = 'block'; 
            formReg.style.display   = 'none';
        } else {
            // Mostra registrazione, nascondi login
            formLogin.style.display = 'none';
            formReg.style.display   = 'block';
        }

        /* Pulisci gli errori quando si cambia tab */
        resetErrors();
    });
});


/* ------------------------------------------------------------
   MOSTRA / NASCONDI PASSWORD
   Cambia il type dell'input tra 'password' e 'text'.
   L'icona cambia per comunicare lo stato attuale.
   ------------------------------------------------------------ */
toggleLoginPsw.addEventListener('click', () => {
    togglePasswordVisibility(loginPassword, toggleLoginPsw);
});

toggleRegPsw.addEventListener('click', () => {
    togglePasswordVisibility(regPassword, toggleRegPsw);
});

function togglePasswordVisibility(input, btn) {
    /* Se il tipo è 'password' lo cambiamo in 'text' per mostrare
       i caratteri, e viceversa */
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    /* Aggiorniamo l'icona per riflettere lo stato attuale */
    btn.textContent = isHidden ? '🙈' : '👁';
}


/* ------------------------------------------------------------
   SUBMIT LOGIN
   Intercettiamo il submit del form con addEventListener invece
   di usare l'attributo onsubmit nell'HTML — è più pulito e
   permette di usare preventDefault() per impedire il
   comportamento di default del browser (ricaricare la pagina).
   ------------------------------------------------------------ */
formLogin.addEventListener('submit', async (e) => {
    /* Impedisce il comportamento di default del form —
       senza questa riga il browser ricaricherebbe la pagina */
    e.preventDefault();

    /* Leggi i valori dai campi, rimuovendo spazi iniziali/finali
       con .trim() — un utente potrebbe incollare accidentalmente
       uno spazio prima dell'email */
    const email    = loginEmail.value.trim();
    const password = loginPassword.value;

    /* Validazione lato client — controlla i campi prima di
       fare la chiamata API. Risparmia una richiesta al server
       per errori banali come campi vuoti */
    if (!validateLogin(email, password)) return;

    /* Mostra lo spinner e disabilita il bottone durante la
       chiamata API — impedisce doppi submit accidentali */
    setLoading('btn-login', true);

    try {
        /* Chiamata all'API di login tramite api.js —
           non scriviamo fetch() direttamente qui perché
           api.js centralizza headers e BASE_URL */
        const data = await api.login(email, password);

        if (data.token) {
            /* Salviamo il token nel localStorage — così rimane
               disponibile anche dopo aver chiuso il browser.
               Il token viene letto da api.js ad ogni richiesta
               e aggiunto all'header Authorization */
            localStorage.setItem('token', data.token);
            /* Salviamo anche il nome per mostrarlo nella navbar */
            localStorage.setItem('nome', data.nome);

            /* Redirect alla dashboard — il login è completato */
            window.location.href = 'dashboard.html';
        } else {
            /* Il server ha risposto senza token — credenziali errate */
            showFormError(loginError, data.error || 'Credenziali non valide');
            
            /* AGGIUNTA: Mostriamo anche un toast per dare un feedback più forte */
            showToast(data.error || 'Credenziali non valide', 'danger');
        }

    } catch (err) {
        /* Errore di rete o server non raggiungibile */
        showFormError(loginError, 'Errore di connessione. Riprova.');
    } finally {
        /* finally viene eseguito sempre — sia in caso di successo
           che di errore. Serve per ripristinare il bottone */
        setLoading('btn-login', false);
    }
});


/* ------------------------------------------------------------
   SUBMIT REGISTRAZIONE
   Stesso pattern del login — preventDefault, validazione,
   chiamata API, gestione risposta.
   ------------------------------------------------------------ */
formReg.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome     = regNome.value.trim();
    const email    = regEmail.value.trim();
    const password = regPassword.value;

    if (!validateRegister(nome, email, password)) return;

    setLoading('btn-register', true);

    try {
        const data = await api.register(nome, email, password);

        if (data.message) {
            /* Registrazione avvenuta — mostriamo un toast di successo
               e switchiamo automaticamente alla tab di login */
            showToast('Registrazione completata! Ora accedi.', 'success');

            /* Simuliamo il click sulla tab login per mostrare
               il form di login con i dati già inseriti */
            tabs[0].click();

            /* Pre-compiliamo l'email nel form di login —
               piccola comodità per l'utente che non deve
               reinserirla */
            loginEmail.value = email;
            loginPassword.focus();

        } else {
            showFormError(regError, data.error || 'Errore durante la registrazione');
        }

    } catch (err) {
        showFormError(regError, 'Errore di connessione. Riprova.');
    } finally {
        setLoading('btn-register', false);
    }
});


/* ------------------------------------------------------------
   VALIDAZIONE
   Funzioni di validazione lato client.
   Controllano i campi prima di fare la chiamata API.
   Mostrano messaggi di errore sotto i singoli campi.
   Restituiscono true se tutto è ok, false altrimenti —
   così il chiamante sa se procedere o fermarsi.
   ------------------------------------------------------------ */
function validateLogin(email, password) {
    let valid = true;

    /* Resettiamo gli errori prima di ogni validazione —
       così non si accumulano errori vecchi */
    resetErrors();

    if (!email) {
        showFieldError('login-email-error', 'Email obbligatoria');
        showFieldError('login-email', null, true);
        valid = false;
    } else if (!isValidEmail(email)) {
        showFieldError('login-email-error', 'Inserisci un\'email valida');
        valid = false;
    }

    if (!password) {
        showFieldError('login-password-error', 'Password obbligatoria');
        valid = false;
    }

    return valid;
}

function validateRegister(nome, email, password) {
    let valid = true;
    resetErrors();

    if (!nome) {
        showFieldError('register-nome-error', 'Nome obbligatorio');
        valid = false;
    }

    if (!email) {
        showFieldError('register-email-error', 'Email obbligatoria');
        valid = false;
    } else if (!isValidEmail(email)) {
        showFieldError('register-email-error', 'Inserisci un\'email valida');
        valid = false;
    }

    if (!password) {
        showFieldError('register-password-error', 'Password obbligatoria');
        valid = false;
    } else if (password.length < 8) {
        /* Controlliamo la lunghezza minima lato client —
           il server la controlla comunque, ma è più veloce
           dare feedback immediato senza aspettare la risposta */
        showFieldError('register-password-error', 'Minimo 8 caratteri');
        valid = false;
    }

    return valid;
}

/* Regex per validare il formato email —
   controlla che ci sia qualcosa@qualcosa.qualcosa */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


/* ------------------------------------------------------------
   HELPERS UI
   Funzioni di supporto per aggiornare l'interfaccia.
   Centralizzarle evita di ripetere lo stesso codice
   in ogni evento.
   ------------------------------------------------------------ */

/* Mostra un messaggio di errore sotto un singolo campo */
function showFieldError(errorId, message) {
    const el = document.getElementById(errorId);
    if (el) el.textContent = message;
}

/* Mostra un messaggio di errore a livello di form intero */
function showFormError(el, message) {
    el.textContent = message;
    el.hidden = false;
}

/* Pulisce tutti i messaggi di errore */
function resetErrors() {
    /* Seleziona tutti gli elementi con classe form-error
       e svuota il loro contenuto */
    document.querySelectorAll('.form-error').forEach(el => {
        el.textContent = '';
    });
    /* Nasconde i messaggi di errore globali del form */
    loginError.hidden = true;
    regError.hidden   = true;
}

/* Mostra/nasconde lo spinner nel bottone durante le chiamate API */
function setLoading(btnId, loading) {
    const btn     = document.getElementById(btnId);
    const text    = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');

    /* Disabilita il bottone per impedire doppi submit */
    btn.disabled      = loading;
    /* Alterna la visibilità di testo e spinner */
    text.hidden       = loading;
    spinner.hidden    = !loading;
}

/* Mostra una notifica toast temporanea
   type può essere: 'success', 'danger', 'warning' o default */
function showToast(message, type = '') {
    const toast = document.createElement('div');
    toast.className = `toast ${type ? 'toast-' + type : ''}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    /* Rimuove automaticamente il toast dopo 3 secondi —
       prima aggiunge la classe .removing per l'animazione
       di uscita, poi lo rimuove dal DOM */
    setTimeout(() => {
        toast.classList.add('removing');
        /* Aspetta che l'animazione CSS finisca (0.3s)
           prima di rimuovere il nodo dal DOM */
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
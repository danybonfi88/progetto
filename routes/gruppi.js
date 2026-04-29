// IMPORTO LE LIBRERIE
/* express */
const express = require('express');
/* db: importa il file db.js, salvato in un'altra cartella del progetto*/
const db = require('../config/db');
/* auth: importa il file auth.js, salvato in un'altra cartella del progetto*/
const auth = require('../middleware/auth');
/* router: creo il Router specifico di questa rotta, su cui registro gli endpoint specifici*/
const router = express.Router();


// Tutte le route qui sotto richiedono il login
router.use(auth);


// GET /api/gruppi
router.get('/', async (req, res) => {
    try {
        /* COSA ESTRAGGO: // estraggo tutti i campi da gruppi, il ruolo dell'utente che sta facendo la richiesta, da utenti_gruppi, e il numero di membri per ogni gruppo */
        /* DA DOVE ESTRAGGO: 
        - dalla tabella gruppi, collegata alla tabella utenti_gruppi in base all'id gruppo e all'i utente di chi sta facendo la richiesta
        - il secondo join collega nuovamente utenti_gruppi, ma senza filtrare per un utente specifico, per avere tutte le righe di tutti i membri di ogni gruppo
        /* RAGGRUPPAMENTO: raggruppo secondo id del gruppo*/
        /* ORDINE: ordino per nome degli utenti, in ordine crescente */
        const [rows] = await db.query(`
        SELECT g.*,
                ug.ruolo,
                COUNT(ug2.utente_id) AS numero_membri
        FROM gruppi g
        JOIN utenti_gruppi ug  ON g.id = ug.gruppo_id AND ug.utente_id = ?
        JOIN utenti_gruppi ug2 ON g.id = ug2.gruppo_id
        GROUP BY g.id, ug.ruolo
        ORDER BY g.nome ASC
        `, [req.user.id]); // req.user viene dal middleware di autenticazione!
        
        // restituisco il risulato della query (res.json() usa 200 di default)
        res.json(rows);

    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});


// POST /api/gruppi
router.post('/', async (req, res) => {
    // estraggo tutti i campi dal body per creare il nuovo gruppo
    const { nome, descrizione } = req.body;

    // verifico se i campi obbligatori esistono
    if (!nome) {
        return res.status(400).json({ error: 'Nome obbligatorio' });
    }

    // Creare un gruppo richiede due INSERT in sequenza:
    /* 1. INSERT INTO gruppi → crea il gruppo
    /* 2. INSERT INTO utenti_gruppi → aggiunge il creatore come admin
    Il problema è: cosa succede se la prima va a buon fine ma la seconda fallisce? Il gruppo esiste nel database ma non ha nessun membro — nemmeno il creatore. È un dato corrotto, inutilizzabile.
    La soluzione è la transazione. */
    // Una transazione è un gruppo di operazioni che vengono trattate come una cosa sola. Vale la regola del tutto o niente:
    /* se tutte le operazioni vanno a buon fine → COMMIT  (salva tutto)
    /* se anche solo una fallisce → ROLLBACK (annulla tutto) */

    // fin'ora si era usato db.query() -> prende automaticamente una connessione dal pool, esegue la query, e la rilascia
    // db.getConnection() prende una connessione dal pool e te la consegna, senza rilasciarla automaticamente, cosicché le due insert vengano eseguite sulla stessa connessione
    const conn = await db.getConnection();
    try {
        // apre la transazione -> da qui MySQL sa chele query successive fanno parte di un "gruppo", e non le salva finché non riceve il COMMIT
        await conn.beginTransaction();

        // invece di db.query(), uso conn.query(), inserendo il nuovo elemento gruppo
        const [result] = await conn.query(
        'INSERT INTO gruppi (nome, descrizione, creatore_id) VALUES (?, ?, ?)',
        [nome, descrizione || null, req.user.id] // req.user viene dal middleware di autenticazione!
        );

        // sempre con conn.query(), inserisco ora il creatore come admin
        await conn.query(
        'INSERT INTO utenti_gruppi (utente_id, gruppo_id, ruolo) VALUES (?, ?, ?)',
        [req.user.id, result.insertId, 'admin'] // req.user viene dal middleware di autenticazione!
        );

        // se entrabe le query sono andate a buon fine -> chiudo la transazione con conn.commit()
        await conn.commit();

        // l'inserimento ha avuto successo -> 201 + infromazioni della nuova materia (insertId è l'id che MySQL ha assegnato alla nuova materia tramite AUTO_INCREMENT.)
        res.status(201).json({ id: result.insertId, nome, descrizione });
    
    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        // Se qualcosa è andato storto nel try, il catch esegue il rollback — annulla tutto quello che era 
        // stato fatto dall'inizio della transazione. Il database torna esattamente com'era prima
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    
    // alla fine di tutto, rilascio e termino la connessione con conn.release()
    // il blocco finally viene eseguito sempre, sia che try vada a buon fine, sia che finisca nel catch
    } finally {
        conn.release();
    }
});


// POST /api/gruppi/:id/membri
router.post('/:id/membri', async (req, res) => {
    // estraggo tutti i campi dal body per aggiungere nuovo membro al gruppo
    const { email } = req.body;

    // verifico se i campi obbligatori esistono
    if (!email) {
        return res.status(400).json({ error: 'Email obbligatoria' });
    }

    // Questa route è diversa da tutte le precedenti perché prima di fare l'INSERT esegue tre controlli in sequenza. 
    // Ogni controllo è un possibile punto di blocco con il suo codice di errore.
    try {

        // estraggo il ruolo dell'utente, in base al suo id (derivato dal middleware di autenticazione) e all'id gruppo preso dall'url
        const [admin] = await db.query(
        'SELECT ruolo FROM utenti_gruppi WHERE gruppo_id = ? AND utente_id = ?',
        [req.params.id, req.user.id]
        );
        // 1 CONTROLLO - verifico che l'utente che sta facendo la richiesta fa parte del gruppo, e che il suo ruolo sia admin
        if (admin.length === 0 || admin[0].ruolo !== 'admin') {
            // se non lo è -> 403: Forbidden
            return res.status(403).json({ error: 'Solo gli admin possono aggiungere membri' });
        }

        // estraggo l'id utente corrispondente alla mail passata nel body 
        const [utenti] = await db.query(
        'SELECT id FROM utenti WHERE email = ?',
        [email]
        );
        // 2 CONTROLLO - verifico che l'utente da aggiungere esiste
        // Cerchi l'utente da aggiungere tramite email — è più pratico che passare l'id direttamente, perché l'admin conosce l'email del compagno ma probabilmente non il suo id nel database.
        if (utenti.length === 0) {
            // se non esiste -> 404: Not found
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        // creo una variabile d'appoggio, a cui assegno l'id dell'utente che ho estratto prima
        const nuovoMembro = utenti[0].id;
        // estraggo ora l'id utente da utente_gruppi, per verificare non solo che l'utente esista, ma che non faccia gia parte del gruppo
        const [esistente] = await db.query(
        'SELECT utente_id FROM utenti_gruppi WHERE gruppo_id = ? AND utente_id = ?',
        [req.params.id, nuovoMembro]
        );
        // 3 CONTROLLO - se le righe estratte sono > 0 (la SELECT ha ritornato un risultato), l'utente è gia presente nel gruppo
        if (esistente.length > 0) {
            // se è gia presente -> 409: Conflict
            return res.status(409).json({ error: 'Utente già nel gruppo' });
        }

        // infine, dopo tutti i controlli, inserisco in utenti_gruppi, il nuovo utente con il ruolo 'membro'
        await db.query(
        'INSERT INTO utenti_gruppi (utente_id, gruppo_id, ruolo) VALUES (?, ?, ?)',
        [nuovoMembro, req.params.id, 'membro']
        );

        // l'inserimento ha avuto successo -> 201
        res.status(201).json({ message: 'Membro aggiunto' });
    
    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});


// DELETE /api/gruppi/:id/membri/:utenteId
router.delete('/:id/membri/:utenteId', async (req, res) => {
    try {
        // estraggo il ruolo dell'utente (appartenente alla tabella utenti_gruppi) in base all'id gruppo e l'id utente che vuole eliminare ( per verificare se l'utente appartiene a quel gruppo)
        const [admin] = await db.query(
        'SELECT ruolo FROM utenti_gruppi WHERE gruppo_id = ? AND utente_id = ?',
        [req.params.id, req.user.id]
        // l'id della risorsa da eliminare è preso dal parametro dinamico della query, l'id utente dalla req (ovvero quello verificato del JWT)
        );

        // se la query SELECT non ha trovato nessun risultato significha che: 1) l'id gruppo non esiste, 2) l'utente non è parte del gruppo
        // se la query SELECT ha trovato un risultato (ruolo), 3) ma esso non è = a 'admin'
        // -> non si puo eliminare il gruppo -> 403 Forbidden: accesso risorsa proibito
        if (admin.length === 0 || admin[0].ruolo !== 'admin') {
        return res.status(403).json({ error: 'Solo gli admin possono rimuovere membri' });
        }
        
        // se la SELECT ottiene un risultato e il ruolo è = 'admin', allora posso eliminare la risorsa:
        // 1) elimino il gruppo per id
        // 2) elimino l'utente dal gruppo (lo rimuovo dal gruppo), controllando che non sia anch'esso un admin
        await db.query('DELETE FROM gruppi WHERE id = ?', [req.params.id]);
        await db.query(
        'DELETE FROM utenti_gruppi WHERE gruppo_id = ? AND utente_id = ? AND ruolo != ?',
        [req.params.id, req.params.utenteId, 'admin']
        );

        // l'eliminazione ha avuto successo -> 200 (automatico con json()) e messaggio di successo
        res.json({ message: 'Membro rimosso' });

    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});


// DELETE /api/gruppi/:id
router.delete('/:id', async (req, res) => {
    try {
        // seleziono la risorsa gruppo in base all'id gruppo e l'id utente che ha creato il gruppo
        const [rows] = await db.query(
        'SELECT id FROM gruppi WHERE id = ? AND creatore_id = ?',
        [req.params.id, req.user.id]
        // l'id della risorsa da eliminare è preso dal parametro dinamico della query, l'id utente dalla req (ovvero quello verificato del JWT)
        );

        // se la query SELECT non ha trovato nessun risultato significha che: 1) l'id gruppo non esiste, 2) l'utente non è il creatore del gruppo
        // -> non si puo eliminare il gruppo -> 403 Forbidden: accesso risorsa proibito
        if (rows.length === 0) {
        return res.status(403).json({ error: 'Solo il creatore può eliminare il gruppo' });
        }

        // se la SELECT ottiene un risultato, allora posso eliminare la risorsa, in base all'id indicato nel parametro dinamico dell'URL
        await db.query('DELETE FROM gruppi WHERE id = ?', [req.params.id]);

        // l'eliminazione ha avuto successo -> 200 (automatico con json()) e messaggio di successo
        res.json({ message: 'Gruppo eliminato' });

    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});

// esporto il Router specifico di files.js, rendendo questa rotta disponibile negli altri file (in modo da poterlo montare in server.js)
module.exports = router;

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

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [result] = await conn.query(
        'INSERT INTO gruppi (nome, descrizione, creatore_id) VALUES (?, ?, ?)',
        [nome, descrizione || null, req.user.id]
        );

        await conn.query(
        'INSERT INTO utenti_gruppi (utente_id, gruppo_id, ruolo) VALUES (?, ?, ?)',
        [req.user.id, result.insertId, 'admin']
        );

        await conn.commit();

        res.status(201).json({ id: result.insertId, nome, descrizione });
    
    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });

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

    try {
        const [admin] = await db.query(
        'SELECT ruolo FROM utenti_gruppi WHERE gruppo_id = ? AND utente_id = ?',
        [req.params.id, req.user.id]
        );

        if (admin.length === 0 || admin[0].ruolo !== 'admin') {
        return res.status(403).json({ error: 'Solo gli admin possono aggiungere membri' });
        }

        const [utenti] = await db.query(
        'SELECT id FROM utenti WHERE email = ?',
        [email]
        );

        if (utenti.length === 0) {
        return res.status(404).json({ error: 'Utente non trovato' });
        }

        const nuovoMembro = utenti[0].id;

        const [esistente] = await db.query(
        'SELECT utente_id FROM utenti_gruppi WHERE gruppo_id = ? AND utente_id = ?',
        [req.params.id, nuovoMembro]
        );

        if (esistente.length > 0) {
        return res.status(409).json({ error: 'Utente già nel gruppo' });
        }

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
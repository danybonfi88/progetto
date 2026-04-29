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


// GET /api/eventi
router.get('/', async (req, res) => {
    try {
        // come solito, uso il metodo query con la scrittura [rows], per estrarre solo le righe, senza metadata
        /* COSA ESTRAGGO: estraggo tutti gli attributi di eventi, nome e colore materia */
        /* DA DOVE ESTRAGGO: dalla tabella eventi, collegata alla tabella materie in base all'id materia.
        LEFT JOIN -> se le righe di eventi non hanno corrispondenza in materie, gli attributi di materie sono impostati a null*/
        /* CONDIZIONE: se vale una delle due condizioni 
        - e.utente_id = ? — l'evento è stato creato dall'utente loggato
        - e.gruppo_id IN (...) — l'evento appartiene a un gruppo di cui l'utente fa parte */
        /* ORDINE: ordino per data degli eventi, crescente */
        const [rows] = await db.query(`
        SELECT e.*,
                m.nome  AS materia_nome,
                m.colore AS materia_colore
        FROM eventi e
        LEFT JOIN materie m ON e.materia_id = m.id
        WHERE e.utente_id = ?
            OR e.gruppo_id IN (
                SELECT gruppo_id
                FROM utenti_gruppi
                WHERE utente_id = ?
            )
        ORDER BY e.data ASC
        `, [req.user.id, req.user.id]); // req.user viene dal middleware di autenticazione!

        // restituisco il risulato della query (res.json() usa 200 di default)
        res.json(rows);
    
    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});


// POST /api/eventi
router.post('/', async (req, res) => {
    // estraggo tutti i campi dal body per creare il nuovo evento
    const { titolo, tipo, data, ora, note, materia_id, gruppo_id } = req.body;
    // verifico se i campi obbligatori esistono
    if (!titolo || !tipo || !data) {
        return res.status(400).json({ error: 'Titolo, tipo e data sono obbligatori' });
    }

    try {
        // inserisco il nuo evento nella tabella eventi tramite query (per i parametri non obbligatori: se non presenti, inserisco null)
        const [result] = await db.query(
        `INSERT INTO eventi
            (utente_id, materia_id, gruppo_id, titolo, tipo, data, ora, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, materia_id || null, gruppo_id || null,
        titolo, tipo, data, ora || null, note || null]
        );

        // l'inserimento ha avuto successo -> 201 + informazioni della nuova materia (insertId è l'id che MySQL ha assegnato al nuovo evento tramite AUTO_INCREMENT.)
        // non invio tutti i campi dell'evento creato, solo i principali
        res.status(201).json({ id: result.insertId, titolo, tipo, data });
    
    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});


// PUT /api/eventi/:id
router.put('/:id', async (req, res) => {
    // estraggo tutti i campi dal body per creare il nuovo evento
    const { titolo, tipo, data, ora, note, completato, materia_id, gruppo_id } = req.body;

    try {
        // La struttura è diversa da INSERT. Con SET elenci i campi da aggiornare uno per uno
        // Il campo 'completato' usa la dicitura "?? false" ->  il valore di default (false) scatta solo se il valore di 'completato' è null o undefined, non se è false o 0.
        const [result] = await db.query(
        `UPDATE eventi
        SET titolo = ?, tipo = ?, data = ?, ora = ?, note = ?,
            completato = ?, materia_id = ?, gruppo_id = ?
        WHERE id = ? AND utente_id = ?`,
        [titolo, tipo, data, ora || null, note || null,
        completato ?? false, materia_id || null, gruppo_id || null,
        req.params.id, req.user.id]
        // l'id della risorsa da aggiornare è preso dal parametro dinamico della query, l'id utente dalla req (ovvero quello verificato del JWT)
        );

        // Qui a differenza della DELETE di materie lo controlli esplicitamente. Se affectedRows è 0 significa che non è stata aggiornata
        // nessuna riga — o l'evento non esiste, o non appartiene all'utente loggato. In entrambi i casi rispondi con 404 Not Found.
        if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Evento non trovato' });
        }

        // l'aggiornamento della risorsa ha avuto successo -> 200 (automatico con json()) e messaggio di successo
        res.json({ message: 'Evento aggiornato' });

    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});


// DELETE /api/eventi/:id
router.delete('/:id', async (req, res) => {
    try {
        // elimino la risorsa evento in base all'id risorsa e l'id utente a cui appartiene l'evento
        const [result] = await db.query(
        'DELETE FROM eventi WHERE id = ? AND utente_id = ?',
        [req.params.id, req.user.id]
        );
        // l'id della risorsa da eliminare è preso dal parametro dinamico della query, l'id utente dalla req (ovvero quello verificato del JWT)

        // Qui a differenza della DELETE di materie lo controlli esplicitamente. Se affectedRows è 0 significa che non è stata eliminata
        // nessuna riga — o l'evento non esiste, o non appartiene all'utente loggato. In entrambi i casi rispondi con 404 Not Found.
        if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Evento non trovato' });
        }
        
        // l'eliminazione ha avuto successo -> 200 (automatico con json()) e messaggio di successo
        res.json({ message: 'Evento eliminato' });
    
    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});

// esporto il Router specifico di eventi.js, rendendo questa rotta disponibile negli altri file (in modo da poterlo montare in server.js)
module.exports = router;
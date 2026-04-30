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


// GET /api/chat
router.get('/', async (req, res) => {
    try {
        // estraggo solo le righe della query, senza metadati (come solito)
        // estraggo tutti i campi di messaggi, appartenenti all'utente che fa la richiesta GET, ordinati per data crescente
        const [rows] = await db.query(
        `SELECT * FROM messaggi
        WHERE utente_id = ?
        ORDER BY timestamp ASC`,
        [req.user.id] // req.user viene dal middleware di autenticazione!
        );

        // restituisco il risulato della query (res.json() usa 200 di default)
        res.json(rows);
    
    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});


// POST /api/chat
router.post('/', async (req, res) => {
    // estraggo i campi dal body per creare il nuovo messaggio (il testo)
    const { testo } = req.body;

    // verifico che il body abbia effettivamente mandato un body, se no -> 400
    if (!testo) {
        return res.status(400).json({ error: 'Messaggio obbligatorio' });
    }

    try {
        // 1. Salva il messaggio dell'utente nel DB
        await db.query(
        'INSERT INTO messaggi (utente_id, testo, mittente) VALUES (?, ?, ?)',
        [req.user.id, testo, 'user']
        );

        // 2. Recupera la cronologia per darla come contesto a Claude
        const [cronologia] = await db.query(
        `SELECT testo, mittente FROM messaggi
        WHERE utente_id = ?
        ORDER BY timestamp ASC`,
        [req.user.id]
        );

        // 3. Trasforma la cronologia nel formato che si aspetta l'API
        const messaggi = cronologia.map(m => ({
        role:    m.mittente === 'user' ? 'user' : 'assistant',
        content: m.testo
        }));

        // 4. Chiama l'API di Claude
        const risposta = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type':      'application/json',
            'x-api-key':         process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model:      'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system:     'Sei un assistente per lo studio. Aiuta lo studente in modo chiaro e conciso.',
            messages:   messaggi
        })
        });

        const data = await risposta.json();
        const testoBot = data.content[0].text;

        // 5. Salva la risposta del bot nel DB
        await db.query(
        'INSERT INTO messaggi (utente_id, testo, mittente) VALUES (?, ?, ?)',
        [req.user.id, testoBot, 'bot']
        );

        // 6. Risponde al client
        res.json({ risposta: testoBot });
    
    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});


// DELETE /api/chat
router.delete('/', async (req, res) => {
    try {
        // elimino tutti i messaggi appartenenti all'utente che fa la richiesta DELETE
        await db.query(
        'DELETE FROM messaggi WHERE utente_id = ?',
        [req.user.id] // req.user viene dal middleware di autenticazione!
        );

        // l'eliminazione ha avuto successo -> 200 (automatico con json()) e messaggio di successo
        res.json({ message: 'Cronologia eliminata' });
    
    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});

// esporto il Router specifico di chat.js, rendendo questa rotta disponibile negli altri file (in modo da poterlo montare in server.js)
module.exports = router;
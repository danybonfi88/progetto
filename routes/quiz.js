// IMPORTO LE LIBRERIE
/* express */const express = require('express');
/* db: importa il file db.js, salvato in un'altra cartella del progetto*/
const db = require('../config/db');
/* auth: importa il file auth.js, salvato in un'altra cartella del progetto*/
const auth = require('../middleware/auth');
/* router: creo il Router specifico di questa rotta, su cui registro gli endpoint specifici*/
const router = express.Router();

// Tutte le route qui sotto richiedono il login
router.use(auth);


// GET /api/quiz
router.get('/', async (req, res) => {
    try {
        // estraggo solo le righe della query, senza metadati (come solito)
        /* COSA ESTRAGGO: tutti gli attributi di quiz, il nome e colore materia e il numero di domande corrispondenti ad ogni quiz (grazie al GROUP BY)
        /* DA DOVE ESTRAGGO: dalla tabella quiz 
        - LEFT JOINED (associo i valori della tabella di destra a quelli di quiz, se non ci sono metto null) su materie in base all'id materia
        - LEFT JOINED anche su domande, in base all'id domanda
        /* CONDIZIONE: dov'è l'id utente della tabella quiz corrisponde all'utente che sta facendo richiesta di GET
        /* RAGGRUPPO: per ogni quiz conto il numero delle domande e il nome e colore della materia*/
        /* ORDINE: per data dii creazione decrescente (dal piu nuovo) */
        const [rows] = await db.query(`
        SELECT q.*,
                m.nome AS materia_nome,
                m.colore AS materia_colore,
                COUNT(d.id) AS numero_domande
        FROM quiz q
        LEFT JOIN materie m ON q.materia_id = m.id
        LEFT JOIN domande d ON q.id = d.quiz_id
        WHERE q.utente_id = ?
        GROUP BY q.id, m.nome, m.colore
        ORDER BY q.data_creazione DESC
        `, [req.user.id]); // req.user viene dal middleware di autenticazione!

        // restituisco il risulato della query (res.json() usa 200 di default)
            res.json(rows);
        
    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});


// POST /api/quiz
router.post('/', async (req, res) => {
    // recupero dal body i dati per creare una nuova risorsa quiz
    const { titolo, materia_id } = req.body;

    // verifico se i dati necessari sono presenti, se no -> 400
    if (!titolo) {
        return res.status(400).json({ error: 'Titolo obbligatorio' });
    }


    try {
        // inserisco la nuova risorsa
        const [result] = await db.query(
        'INSERT INTO quiz (utente_id, materia_id, titolo) VALUES (?, ?, ?)',
        [req.user.id, materia_id || null, titolo] // req.user viene dal middleware di autenticazione!
        );

        // l'inserimento ha avuto successo -> 201 + informazioni della nuova materia (insertId è l'id che MySQL ha assegnato al nuovo evento tramite AUTO_INCREMENT.)
        res.status(201).json({ id: result.insertId, titolo, materia_id });
    
    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});


// DELETE /api/quiz/:id
router.delete('/:id', async (req, res) => {
    try {
        // elimino la risorsa in base all'id passato tramite parametro dinamico dell'url, se l'utente che fa richiesta è quello che l'ha creata
        const [result] = await db.query(
        'DELETE FROM quiz WHERE id = ? AND utente_id = ?',
        [req.params.id, req.user.id] // req.user viene dal middleware di autenticazione!
        );

        // Se affectedRows è 0 significa che non è stata eliminata
        // nessuna riga — o il quiz non esiste, o non appartiene all'utente loggato. In entrambi i casi rispondi con 404 Not Found.
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Quiz non trovato' });
        }

        // l'eliminazione ha avuto successo -> 200 (automatico con json()) e messaggio di successo
        res.json({ message: 'Quiz eliminato' });
    
    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});


// GET /api/quiz/:id/domande
router.get('/:id/domande', async (req, res) => {
    try {
        // estraggo solo le righe della query, senza metadati (come solito)
        /* COSA ESTRAGGO: tutti gli attributi di domande
        - JOINED a quiz, in base all'id del quiz
        /* CONDIZIONE: dove l'id quiz delle domande è quello del quiz richiesto dall'utente (passato tramite parametro dinamico dell'url), e l'id utente della tabella quiz corrisponde all'utente che sta facendo richiesta di GET */
        const [rows] = await db.query(`
        SELECT d.*
        FROM domande d
        JOIN quiz q ON d.quiz_id = q.id
        WHERE d.quiz_id = ? AND q.utente_id = ?
        `, [req.params.id, req.user.id]); // req.user viene dal middleware di autenticazione!
        
        // restituisco il risulato della query (res.json() usa 200 di default)
        res.json(rows);
    
    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});


// POST /api/quiz/:id/domande
router.post('/:id/domande', async (req, res) => {
    // recupero dal body i dati per creare una nuova risorsa domanda
    const { testo, risposta_corretta, risposte_errate, tipo } = req.body;

    // verifico se i dati necessari sono presenti, se no -> 400
    if (!testo || !risposta_corretta) {
        return res.status(400).json({ error: 'Testo e risposta corretta sono obbligatori' });
    }

    try {
        // verifico che esista il quiz (il cui id è passato tramite parametro dinamico nell'URL) a cui l'utente vuole aggiungere una domanda
        const [quiz] = await db.query(
        'SELECT id FROM quiz WHERE id = ? AND utente_id = ?',
        [req.params.id, req.user.id]
        );
        // se il risultato della SELECT ha lunghezza 0 righe, il quiz non esiste già -> 404: Not Founf
        if (quiz.length === 0) {
            return res.status(404).json({ error: 'Quiz non trovato' });
        }

        // se invece il quiz esiste, inserisco la nuova risorsa
        const [result] = await db.query(
        `INSERT INTO domande
            (quiz_id, testo, risposta_corretta, risposte_errate, tipo)
        VALUES (?, ?, ?, ?, ?)`,
        [
            req.params.id,
            testo,
            risposta_corretta,
            risposte_errate ? JSON.stringify(risposte_errate) : null,
            tipo || 'multipla'
        ]
        );
        /* Nel database il campo risposte_errate è di tipo JSON. Il frontend ti manda un array JavaScript:
        javascript["risposta B", "risposta C", "risposta D"]
        Il problema è che MySQL non può ricevere un array JavaScript direttamente — si aspetta una stringa. 
        JSON.stringify() converte l'array in una stringa JSON*/
        // L'operatore ? prima è un controllo: se risposte_errate non è stato mandato dal frontend, salvi null invece di chiamare JSON.stringify(undefined) che darebbe problemi.
        // se il tipo non è indicato, si sceglie domanda 'multipla' di default

        // l'inserimento ha avuto successo -> 201 + informazioni della nuova materia (insertId è l'id che MySQL ha assegnato al nuovo evento tramite AUTO_INCREMENT.)
        res.status(201).json({ id: result.insertId, testo, risposta_corretta });
    
    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});


// DELETE /api/quiz/:id/domande/:domandaId
router.delete('/:id/domande/:domandaId', async (req, res) => {
    try {
        // elimino la domanda in base all'id domanda (passato dal parametro dinamico dell'URL) e l'id utente a cui appartiene l'evento in cui si trova la domanda
        const [result] = await db.query(
        `DELETE d FROM domande d
        JOIN quiz q ON d.quiz_id = q.id
        WHERE d.id = ? AND q.utente_id = ?`,
        [req.params.domandaId, req.user.id] // req.user viene dal middleware di autenticazione!
        );

        // Se affectedRows è 0 significa che non è stata eliminata
        // nessuna riga — o la domanda non esiste, non fa parte del quiz, o non appartiene all'utente loggato. In entrambi i casi rispondi con 404 Not Found.
        if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Domanda non trovata' });
        }

        // l'eliminazione ha avuto successo -> 200 (automatico con json()) e messaggio di successo
        res.json({ message: 'Domanda eliminata' });
    
    // se la query fallisce per qualsiasi motivo, l'errore viene intercettato -> 500
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno' });
    }
});

// esporto il Router specifico di quiz.js, rendendo questa rotta disponibile negli altri file (in modo da poterlo montare in server.js)
module.exports = router;
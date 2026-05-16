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

// PUT /api/quiz/:id — Permette di modificare il titolo e la materia di un quiz esistente
router.put('/:id', async (req, res) => {
    // Estraggo i dati dal body della richiesta
    const { titolo, materia_id } = req.body;

    // Validazione: il titolo è obbligatorio per evitare quiz senza nome
    if (!titolo) {
        return res.status(400).json({ error: 'Il titolo del quiz è obbligatorio' });
    }

    try {
        /* 
           Eseguiamo l'UPDATE della tabella quiz.
           Filtriamo per ID e per utente_id per garantire la sicurezza: 
           solo il proprietario può modificare il proprio quiz.
        */
        const [result] = await db.query(
            'UPDATE quiz SET titolo = ?, materia_id = ? WHERE id = ? AND utente_id = ?',
            [titolo, materia_id || null, req.params.id, req.user.id]
        );

        // Se affectedRows è 0, significa che il quiz non esiste o non appartiene all'utente
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Quiz non trovato o non autorizzato' });
        }

        // Risposta di successo
        res.json({ message: 'Quiz aggiornato con successo' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno del server' });
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

// POST /api/quiz/:id/generate — Genera automaticamente domande per un quiz esistente tramite AI
router.post('/:id/generate', async (req, res) => {
    const quizId = req.params.id;
    // Estraiamo argomento E numero dal body
    const { argomento, numero } = req.body;

    if (!argomento) {
        return res.status(400).json({ error: 'L\'argomento per le domande è obbligatorio' });
    }

    // Se l'utente non ha mandato un numero, usiamo 5 come default
    const quantita = numero || 5;

    try {
        const [quiz] = await db.query(
            'SELECT titolo FROM quiz WHERE id = ? AND utente_id = ?', 
            [quizId, req.user.id]
        );

        if (quiz.length === 0) {
            return res.status(404).json({ error: 'Quiz non trovato o non autorizzato' });
        }

        // 2. CHIAMATA ALL'AI (GROQ)
        /* Definisco un prompt di sistema molto rigoroso per costringere l'AI a non "chiacchierare" 
           ma a restituire solo un formato dati che il computer può leggere (JSON) */
        const promptSistema = `
            Sei un esperto creatore di quiz didattici. 
            Genera un set di ${quantita} domande basate sull'argomento fornito.
            Devi rispondere ESCLUSIVAMENTE con un array JSON, senza alcun testo prima o dopo.
            Ogni oggetto nell'array deve avere esattamente questa struttura:
            {
                "testo": "Testo della domanda",
                "risposta_corretta": "La risposta esatta",
                "risposte_errate": ["Sbagliata1", "Sbagliata2", "Sbagliata3"],
                "tipo": "multipla"
            }
        `;

        // Eseguo la fetch verso l'API di Groq
        const rispostaAI = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}` // Chiave segreta dal file .env
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: promptSistema },
                    { role: 'user', content: `Genera domande per il quiz "${quiz[0].titolo}". Argomento specifico: ${argomento}` }
                ]
            })
        });

        // estraggo il contenuto della risposta
        const data = await rispostaAI.json();
        let contenuto = data.choices[0].message.content;

        // PULIZIA DEL JSON: a volte l'AI avvolge il JSON in blocchi di codice markdown (es: ```json ... ```)
        // uso .replace() con una regex per rimuovere questi simboli, altrimenti JSON.parse() darebbe errore
        contenuto = contenuto.replace(/```json|```/g, '').trim();
        
        // trasformo la stringa JSON in un vero array di oggetti JavaScript
        const domandeAI = JSON.parse(contenuto); 
        
        // Gestione flessibile: se l'AI ha restituito l'array direttamente o dentro un oggetto (es. { "domande": [...] })
        const listaDomande = Array.isArray(domandeAI) ? domandeAI : (domandeAI.domande || domandeAI.quiz);

        // se dopo il parsing non abbiamo un array valido di domande -> 500
        if (!listaDomande || !Array.isArray(listaDomande)) {
            throw new Error('L\'AI non ha restituito un formato di domande valido');
        }

        // 3. SALVATAGGIO NEL DATABASE
        // Uso una transazione perché l'inserimento di più domande deve essere un'operazione "tutto o niente"
        const conn = await db.getConnection();
        try {
            // avvio la transazione
            await conn.beginTransaction();

            // ciclo attraverso l'array di domande generate dall'AI e le inserisco una per una nel DB
            for (const d of listaDomande) {
                await conn.query(
                    `INSERT INTO domande (quiz_id, testo, risposta_corretta, risposte_errate, tipo) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        quizId, 
                        d.testo, 
                        d.risposta_corretta, 
                        JSON.stringify(d.risposte_errate), // l'array delle risposte errate va convertito in stringa JSON per MySQL
                        d.tipo || 'multipla'
                    ]
                );
            }

            // se tutte le inserzioni sono andate a buon fine, confermo i cambiamenti nel DB
            await conn.commit();
            
            // restituisco 201 (Created) con il numero di domande generate
            res.status(201).json({ 
                message: 'Domande generate e inserite con successo!', 
                numero_domande: listaDomande.length 
            });

        } catch (dbErr) {
            // se avviene un errore durante l'inserimento di una qualsiasi domanda, annullo tutto (rollback)
            // così non rimaniamo con un quiz a metà (es. solo 2 domande su 5)
            await conn.rollback();
            throw dbErr; // lancio l'errore per farlo catturare dal catch esterno
        } finally {
            // rilascio la connessione al pool di MySQL
            conn.release();
        }

    // Se qualcosa va storto in qualsiasi punto del try (errore API, errore Parsing, errore DB), l'errore viene catturato qui
    } catch (err) {
        console.error("Errore generazione quiz:", err);
        res.status(500).json({ error: 'Errore interno durante la generazione automatica delle domande' });
    }
});

// PUT /api/quiz/:id — modifica un quiz esistente
router.put('/:id', async (req, res) => {
    // estraggo dal body i nuovi valori per il titolo e la materia
    const { titolo, materia_id } = req.body;

    // verifico che il titolo sia presente: non posso avere un quiz senza nome -> 400
    if (!titolo) {
        return res.status(400).json({ error: 'Il titolo è obbligatorio' });
    }

    try {
        /* 
           Aggiorno i dati nel DB. 
           IMPORTANTE: aggiungo la condizione "AND utente_id = ?" per sicurezza.
           In questo modo impedisco che un utente malintenzionato modifichi 
           il quiz di un altro semplicemente indovinando l'ID nell'URL.
        */
        const [result] = await db.query(
            'UPDATE quiz SET titolo = ?, materia_id = ? WHERE id = ? AND utente_id = ?',
            [titolo, materia_id || null, req.params.id, req.user.id]
        );

        // se affectedRows è 0, significa che il quiz con quell'ID non esiste 
        // oppure non appartiene all'utente che ha fatto la richiesta -> 404
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Quiz non trovato o non autorizzato' });
        }

        // l'aggiornamento ha avuto successo -> 200 + messaggio
        res.json({ message: 'Quiz aggiornato con successo' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore interno del server' });
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
// IMPORTO LE LIBRERIE
/* importo express */
const express = require('express');
/* importo cors, che permette al front'end di chiamare l'API */
const cors = require('cors');
/* importo dotenv, utile per leggere file .env */
const dotenv = require('dotenv');
/* leggo il file.env e carico le variabili in process.env */
dotenv.config();


// CREO IL SERVER
const app = express();


// MIDDLEWARE GLOBALI
/* aggiunge degli header HTTP alla risposta del server che dicono al browser "va bene, accetto
richieste da altre origini". Il browser legge quegli header e lascia passare la richiesta. */
app.use(cors());
/* express.json() legge la stringa della richiesta HTTP, la
trasforma in un oggetto JavaScript, e la mette in req.body */
app.use(express.json());


// MIDDLEWARE x SINGOLE ROTTE
/* Express ti dà uno strumento chiamato Router che è essenzialmente una mini-app Express
autonoma. Ogni file di route crea il suo router, ci registra i suoi endpoint, e lo esporta: */
/* i  middleware delle singole rotte non vengono gestiti in questo file,ma inviati al router specifico per ognuna */
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/materie', require('./routes/materie'));
app.use('/api/eventi',  require('./routes/eventi'));
app.use('/api/files',   require('./routes/files'));
app.use('/api/gruppi',  require('./routes/gruppi'));
app.use('/api/quiz',    require('./routes/quiz'));
app.use('/api/chat',    require('./routes/chat'));


// AVVIO SERVER
/* recupero il numero della porta dalfile .env */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});

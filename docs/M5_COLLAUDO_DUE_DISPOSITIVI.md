# M5 — Collaudo identità su due dispositivi

Il test automatico `sharing-two-device.test.mjs` simula il trasferimento serializzato dal dispositivo A al dispositivo B e dimostra che la chiave privata resta cifrata, l'identità può essere riaperta con la stessa Vault Key e il destinatario può decifrare la chiave per-record. Un dispositivo con materiale Vault errato viene respinto.

## Prova fisica non produttiva

1. usare due account e due dispositivi dedicati al collaudo, senza dati reali;
2. creare sul dispositivo A l'identità del destinatario e verificare che Firebase riceva soltanto la chiave pubblica;
3. accedere allo stesso account sul dispositivo B e riaprire la busta privata con la Vault Key corretta;
4. condividere un record fixture dal proprietario e verificarne la decifratura sul dispositivo B;
5. provare Vault Key errata, UID differente, busta alterata e chiave pubblica sostituita: tutti devono essere bloccati;
6. revocare il destinatario, ruotare la chiave per-record e verificare che il nuovo contenuto non sia leggibile dalla vecchia sessione offline;
7. cambiare Master Password senza cambiare la Vault Key e ripetere la riapertura;
8. registrare soltanto esito, versione schema e codice errore, mai chiavi o contenuti.

Il test fisico non autorizza il cutover. L'attivazione resta separata e richiede backup M8 realmente ripristinato e approvazione delle Rules di produzione.

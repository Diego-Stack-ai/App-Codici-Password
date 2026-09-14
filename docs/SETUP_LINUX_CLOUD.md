# Setup riproducibile del laboratorio Linux cloud

Lo script `scripts/setup-linux-cloud.sh` prepara esclusivamente directory locali al workspace: dipendenze dai due lock npm, Chrome, Edge e cache dei JAR Firestore e Storage richiesti dalla suite completa. Non usa `sudo`, non modifica repository di sistema e non accede ad alcun progetto Firebase. Il runner applicativo continua ad accettare soltanto `demo-vault-shell`.

## Uso nella fase di setup con rete

```bash
bash scripts/setup-linux-cloud.sh
source .codex-tmp/cloud-tools/environment.sh
npm run test:vault-emulators
npm run test:vault-emulators -- --fenced-browser
```

`--check` esegue soltanto l'inventario, senza installazioni o download:

```bash
bash scripts/setup-linux-cloud.sh --check
```

Sono richiesti Linux x86_64, Node/npm, Java, `curl`, `dpkg-deb` e `md5sum`. Browser e cache sono salvati sotto `.codex-tmp`, già esclusa da Git. I percorsi possono essere forniti con `CLOUD_TOOLS_DIR`, `CHROME_PATH`, `EDGE_PATH` e `FIREBASE_EMULATORS_PATH`; gli URL dei pacchetti possono essere fissati dal runner con `CHROME_DEB_URL` ed `EDGE_DEB_URL`.

## Accesso rete necessario

La configurazione della fase di setup deve consentire HTTPS verso:

- `registry.npmjs.org`, per `npm ci` root e Functions;
- `dl.google.com`, per il pacchetto Chrome Linux;
- `go.microsoft.com` e il dominio di destinazione indicato dal redirect Microsoft, per Edge Linux;
- `storage.googleapis.com`, per il file Firestore dichiarato dalla versione bloccata di `firebase-tools`.

Alla versione corrente i file richiesti dalla CLI sono `firebase-preview-drop/emulator/cloud-firestore-emulator-v1.22.0.jar` e `firebase-preview-drop/emulator/cloud-storage-rules-runtime-v1.1.3.jar`. URL, dimensioni e checksum autorevoli non sono duplicati nello script: vengono letti da `node_modules/firebase-tools/lib/emulator/downloadableEmulatorInfo.json`, e i comandi ufficiali `setup:emulators:firestore` e `setup:emulators:storage` ne effettuano la validazione. Se un proxy o allowlist impedisce il download, l'intervento va fatto nella configurazione rete della fase di setup, non nello script o nei permessi globali del container.

La presenza dei file non certifica i test. I comandi emulator/browser devono essere eseguiti separatamente e i loro esiti riportati senza riutilizzare risultati storici.

## Revisione locale della PR #59 — 14/09/2026

Base pubblicata verificata: `a3f7f28be5c6f8ff511616f880f2d312f151359f`, ramo `codex/trasferire-codici-e-password-su-cloud`, destinazione `experiment/vault-shell-v124`. I checkpoint cloud `3018e202` e `5920b727` sono contenuti nello snapshot pubblicato; non occorre ricrearli o importare i rami documentali `3a8e5a2`/`973ed3f` o la patch `851b788`.

Corretto il setup: inizializzazione delle variabili Bash sotto `set -u`, quotatura dei percorsi e degli export, rifiuto degli argomenti sconosciuti. Nessuna cancellazione ricorsiva; un percorso browser personalizzato deve già esistere ed essere eseguibile. La fixture `node --test tests/setup-linux-cloud.test.mjs` verifica installazione simulata, seconda esecuzione, percorsi con spazi/apostrofi, inventario e rifiuto dei percorsi mancanti. Richiede Bash (`BASH_PATH` opzionale) e non prova download, librerie Linux o avvio reale dei browser.

Il setup deve essere configurato nella fase dedicata dell'ambiente, prima delle restrizioni di rete dell'agente. Gli export non persistono automaticamente tra setup e task: caricare `environment.sh` nella stessa shell dei test. Il checkout della task deve contenere la PR consolidata; un vecchio clone basato su master non è una base equivalente. Vedere la [documentazione ufficiale degli ambienti cloud](https://learn.chatgpt.com/docs/environments/cloud-environment).

Il collaudo locale Windows ha superato `npm test` e il runner `--fenced-browser` con Chrome/Edge e backend originali emulati. L'installazione effettiva e il collaudo Linux cloud restano da verificare: questi esiti locali non li sostituiscono. Nessun bump, master, deploy, migrazione o dato reale coinvolto.

Primo setup cloud reale dopo consolidamento: completati entrambi gli `npm ci` e download Chrome; avvio interrotto da `libatk-1.0.so.0` assente nell'immagine universal Ubuntu 24.04. Il setup prepara gli indici Ubuntu firmati in directory locali del workspace e li usa per scaricare le dipendenze browser mancanti ed estrarle sotto `.codex-tmp/cloud-tools/browser-libraries`, senza `apt install`, `sudo` o scritture di sistema. Gli avviatori generati applicano `LD_LIBRARY_PATH` soltanto ai processi browser; Node e Java non lo ereditano dal file di ambiente. Se gli indici locali non possono essere preparati, il setup fallisce esplicitamente. Fixture estesa anche a questa installazione simulata; il nuovo tentativo cloud deve confermare le librerie effettive.


## Collaudo finale Linux cloud — 14/09/2026

Inventario positivo per Node 24.15.0, npm 11.4.2, OpenJDK 25.0.2, Chrome 153.0.8010.36, Edge 153.0.4234.32 e JAR Firestore. La fixture setup è passata. La suite completa ha raggiunto il gate Storage, rilevando che lo script non ne precaricava il JAR; con rete agente disattivata il download è rimasto concretamente bloccato. Il setup prepara ora entrambe le cache.

Il runner browser aggiunge `--no-sandbox` esclusivamente quando gira come root su Linux, requisito dei browser estratti nel container; non disattiva la sandbox negli ambienti non-root. Dopo la correzione il runner Chrome/Edge con Auth e Firestore sul solo progetto `demo-vault-shell` è passato: 5 scenari generici e 12 privati per browser. La suite completa resta da rieseguire dopo un nuovo setup con rete che popoli la cache Storage.


## Chiusura del trasferimento nell’ambiente nuovo — 14/09/2026

Base iniziale verificata: HEAD `3070d01db3786463c4f7dc833af0c92e4eb7671c`, working tree pulito e ascendenza richiesta confermata. Nella stessa shell persistente usata per i test è stato caricato `.codex-tmp/cloud-tools/environment.sh`; `bash scripts/setup-linux-cloud.sh --check` ha rilevato Node 24.15.0, npm 11.4.2, OpenJDK 25.0.2, Chrome 153.0.8010.36, Edge 153.0.4234.32 e le cache Firestore 1.22.0 e Storage 1.1.3. I due JAR effettivi misurano rispettivamente 136707194 e 52892936 byte. La fixture setup, la suite completa e il runner fenced Chrome/Edge sono passati su sole fixture sintetiche ed emulatori.

La suite completa ha esposto un blocco reale specifico del container: le variabili proxy ereditate intercettavano le richieste loopback usate da `firestore.get()`/`firestore.exists()` nel runtime delle Storage Rules. Una entry locale caricata soltanto dal runner Storage intercetta la costruzione del dispatcher della CLI: usa una connessione diretta esclusivamente per gli host esatti `127.0.0.1`, `[::1]` e `localhost`, mentre ogni altra destinazione resta delegata al `ProxyAgent` originale con tutte le variabili proxy intatte. Non modifica `node_modules`, configurazioni globali o accesso a servizi reali. Test con dispatcher finti verificano anche domini esterni, suffissi che somigliano a localhost, indirizzi non ammessi e protocolli diversi. Dopo la correzione sono passati sia i cinque casi Storage applicativi sia i cinque casi Storage della condivisione candidata.

Questo checkpoint conclude il **trasferimento e collaudo dell’ambiente Linux cloud**. Non chiude M6: provider protetto nel bootstrap della shell persistente, trasporto autenticato/App Check, recupero della coda dopo riapertura, rollout dello schema e prove fisiche restano gate separati. La Vault Key resta soltanto in memoria. Nessun account reale, deploy, migrazione, bump o modifica a master.

Un follow-up può riutilizzare l’ambiente assegnato: non riesegue automaticamente uno script di setup cambiato nel frattempo. Quando il checkout modifica `scripts/setup-linux-cloud.sh` o i relativi artefatti, il setup va quindi rilanciato esplicitamente nella fase prevista e `environment.sh` va nuovamente caricato nella shell dei test; la sola presenza di una task successiva non aggiorna cache o browser.

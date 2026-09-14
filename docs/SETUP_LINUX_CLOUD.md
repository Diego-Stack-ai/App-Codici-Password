# Setup riproducibile del laboratorio Linux cloud

Lo script `scripts/setup-linux-cloud.sh` prepara esclusivamente directory locali al workspace: dipendenze dai due lock npm, Chrome, Edge e cache del JAR Firestore. Non usa `sudo`, non modifica repository di sistema e non accede ad alcun progetto Firebase. Il runner applicativo continua ad accettare soltanto `demo-vault-shell`.

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

Alla versione corrente il file richiesto dalla CLI è `firebase-preview-drop/emulator/cloud-firestore-emulator-v1.22.0.jar`. URL, dimensione e checksum autorevoli non sono duplicati nello script: vengono letti da `node_modules/firebase-tools/lib/emulator/downloadableEmulatorInfo.json`, e il comando ufficiale `setup:emulators:firestore` ne effettua la validazione. Se un proxy o allowlist impedisce il download, l'intervento va fatto nella configurazione rete della fase di setup, non nello script o nei permessi globali del container.

La presenza dei file non certifica i test. I comandi emulator/browser devono essere eseguiti separatamente e i loro esiti riportati senza riutilizzare risultati storici.

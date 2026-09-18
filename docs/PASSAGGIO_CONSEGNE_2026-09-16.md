# Passaggio di consegne — Codici & Password

Data: 16 settembre 2026. Relazione verificata su Git, cartelle locali, test e PR. Documento di consegna, non nuovo piano né autorizzazione al rilascio. Prevalgono baseline sicurezza e contratti specialistici.

## 1. Punto di partenza per il nuovo agente

- Repository GitHub: https://github.com/Diego-Stack-ai/App-Codici-Password
- **Cartella principale per continuare il programma MD:** `C:/Users/Diego/Documents/Progetti/App-Codici-Password`.
- Ramo di lavoro: `integration/vault-shell-v127-security`.
- Ultimo commit applicativo della candidata: **`ebf1b1fad55af1434cc202ed49d93354d4152e51`**, già inviato su GitHub. Ultimo checkpoint documentale precedente a questo aggiornamento: **`68678e79`**. Usare sempre `git log -1` per il checkpoint effettivo.
- PR sperimentale **#67**, ancora bozza: https://github.com/Diego-Stack-ai/App-Codici-Password/pull/67. Base **`experiment/m6-private-note-provider`**, NON master. Non cambiare base o unire tutta la PR per pubblicare una sola funzione.
- Versione realmente online: **1.2.128**, Hosting `https://appcodici-password.web.app`.
- Master remoto: **`4efda528b418d7cc15ad653ad179aaa55a2f396e`**, merge della PR #68; commit funzionale PDF **`9d0f70658e0d220ecb6c7404e6e2a76ce0749cf0`**.
- La candidata conserva numero 1.2.127: non è la versione online e non deve ricevere un bump solo per uniformare il numero.
- Ripresa automatica `completa-programma-md-codici-password` messa in **PAUSA** durante questa consegna per evitare due agenti scriventi. Riattivare solo dopo aver concordato chi controlla il ramo.

## 2. Scopo e obiettivo

L'app custodisce credenziali, profili personali/aziendali, Widget, dati bancari, documenti e allegati. Il programma MD serve a farla evolvere conservando le funzioni esistenti e rendendo verificabili sicurezza, autorizzazioni, scritture, disponibilità offline e recupero.

La direzione già approvata è una **shell persistente**: il documento rimane caricato durante la navigazione interna e la Vault Key resta esclusivamente nella memoria della sessione. Non è da ridiscutere come semplice scelta di stile e non si deve reintrodurre il wrapping della chiave in sessionStorage nella candidata.

L'obiettivo finale non è accumulare controlli o cambiare solo l'aspetto grafico: è sostituire gradualmente il percorso multipagina con un percorso completo, sicuro e collaudato, senza perdere dati o funzioni. Gli MD distinguono contratti, piani, prove e cronologia; non tutti i file Markdown rappresentano lavori indipendenti.

## 3. Cosa è già pubblicato

Non è corretto dire che non è stato pubblicato nulla. Durante il programma sono stati rilasciati correttivi isolati, mentre la migrazione complessiva è rimasta separata.

- Versioni precedenti: interventi su Account/Widget/banca/note e interfaccia; successive correzioni del bootstrap offline iPhone, preparazione offline di profilo/Widget/credenziali e protezione delle pagine private. La cronologia dettagliata è nel registro aggiornamenti e in master.
- **1.2.127:** protezione iniziale delle pagine private fino alla conferma Auth; PR #66, master precedente `0ba2332b`.
- **1.2.128:** scheda PDF aziendale, PR **#68** unita e pubblicata il 16/09/2026. Porting selettivo del PDF sperimentale `a2a0252a` sulla versione produttiva; non include la PR #67.
- Percorso PDF online: Azienda → Dati azienda → Scheda PDF. Scelta gruppi, anteprima, generazione sul dispositivo, download e condivisione su azione dell'utente. Password, PIN/PUK, note riservate, banca e allegati esclusi.
- Rilascio PDF: npm test completo, 23 test PDF, Chrome desktop/viewport mobile, download reale, documento sintetico multipagina renderizzato e ispezionato. CI **35071328912** superata. Asset online confrontati con SHA-256 locali; redirect anonimo della pagina aziendale al login verificato. Nessun accesso a dati reali.
- Safari iPhone e condivisione nativa WhatsApp/email restano da collaudare fisicamente; viewport mobile Chrome non li certifica. Il download è l'alternativa disponibile.

## 4. Cosa contiene la candidata non ancora pubblicata

Questi sono cambiamenti reali di codice, accompagnati da test: non soltanto analisi.

| Area | Implementato nella candidata | Limite da conservare |
|---|---|---|
| Shell e sessione | Navigazione interna, chiave RAM, revoca di viste/capability al blocco/logout/cambio UID | Percorso completo produttivo non ancora sostituito |
| Profili | Vista comune privato/azienda, panoramica, anagrafica, contatti, indirizzi, documenti e directory aziende | Parità completa degli editor ancora aperta |
| Offline | Preparazione automatica dei domini testuali allo sblocco, consultazione senza visita preventiva, riavvio offline e nuovo sblocco | Foto e byte degli allegati esclusi; eviction/disco/grandi archivi da collaudare |
| Account | Consultazione Widget, credenziali comuni e dati bancari; Widget legati al conto sopra le carte | Editor completi, ordine e altri flussi non tutti montati |
| Anagrafica | Modifica/svuotamento testi e note cifrati, conferma e refresh senza reload | Writer/trasporto candidati di laboratorio |
| Note Account | Editor della sola nota per Account collegati/aziendali, preservazione degli altri campi; percorso M6 di recupero coda mantenuto | Nuovo editor offline consultivo; parità UI completa ancora aperta |
| Collegamenti | Collega/Cambia/Scollega con ricerca personale/azienda, destinazioni riutilizzabili, riferimenti inversi atomici, UID/revisione/impronta/ricevuta | Origini solo con identità canonica supportata; code pendenti bloccano la mutazione |
| QR/vCard | Generazione da selezione esplicita, proiezione minima, editor privato e flag fissi aziendali | Extra/ID legacy e collaudo importazione foto su dispositivo aperti |
| PDF | Generatore locale e vista della candidata | Funzione già portata separatamente in produzione; non duplicare il rilascio |
| Excel | Proiezione revocabile e mascheramento corretti nella candidata | XLSX completo, UI, consenso/riautenticazione e download da integrare |

Ultime prove della candidata `ebf1b1fa`: npm test completo, **513 test shell**, emulatori e **109 verifiche browser Chrome** (77 entry online/offline + 32 arresto/riapertura). CI **35070097640** superata. Sono prove su fixture/progetto `demo-vault-shell`, non certificazione della produzione o di Safari.

Commit recenti utili: `ebf1b1fa` montaggio collegamenti; `781c7974` note e recupero coda; `e21202ac` provider note; `713127a1` servizio note; `053440f7` selettore Account; `8d5be66d` mutazioni atomiche dei collegamenti; `520aafd2` editor anagrafica; `a2a0252a` PDF sperimentale.

## 5. Perché non si pubblicano insieme tutti i commit

1. **Parità incompleta:** rilasciare tutta la shell ora potrebbe rendere indisponibili flussi di modifica/creazione o pagine ancora sul percorso precedente.
2. **Confine di laboratorio:** nuovi servizi usano bridge loopback e App Check sintetico negli emulatori. Non equivalgono a callable e attestazione produttivi.
3. **Transizione delle scritture:** occorre coordinare writer legacy, revisioni/ricevute, riferimenti e code pendenti. Non basta copiare la UI o allentare le Rules.
4. **Sicurezza della sessione:** **VS-P0-01 resta aperto in produzione** finché il wrapping legacy non viene realmente sostituito, con migrazione, revoca e rollback verificati. Il PDF non chiude questo problema.
5. **Gate reali aperti:** iPhone/Safari, Edge attuale, grandi archivi, eviction/disco, recuperi M5–M10 e audit indipendente.

Commit significa lavoro registrato in Git; push significa copia su GitHub; PR significa proposta di integrazione; merge significa integrazione del ramo; deploy significa pubblicazione online. Nessuno di questi passaggi implica automaticamente il successivo. Il workflow di produzione prevede deploy manuale; il rilascio PDF è stato eseguito esplicitamente, solo Hosting.

La PR #67 e il ramo di integrazione hanno una storia molto più ampia di master e non sono una coda lineare di funzioni da pubblicare. Il confronto verificato il 16/09/2026 indicava anche commit produttivi mancanti nella candidata, inclusa la release PDF 1.2.128. Ricalcolare sempre la divergenza dopo `git fetch`: il numero di commit include merge, laboratori, documentazione e lavori già portati selettivamente, quindi non misura la percentuale di completamento.

## 6. Prossime attività, in ordine

1. **Riconciliare il rilascio PDF 1.2.128 con la candidata:** confrontare `4efda528`/`9d0f7065`, senza merge/cherry-pick cieco. Il generatore ora esiste anche nel percorso produttivo; condividere o riallineare selettivamente moduli/test preservando la chiave RAM della shell. Non copiare l'adapter legacy nella shell. Preparare integrazione/versione futura solo nel ramo sperimentale, senza nuovo deploy.
2. Completare editor contatti/indirizzi/documenti e creazione Account dal collegamento. Gestire ID persistiti, righe extra/legacy, utenze e documenti aziendali non ancora coperti. Nessun ID inventato da indici di lista.
3. Completare editor Account, Widget e banca mantenendo relazione conto/Widget/carte, credenziali condivise, cifratura e compatibilità della coda. Integrare scadenze, impostazioni, archivio, backup e salute credenziali nella shell.
4. Integrare Excel selettivamente: identità composta dominio/azienda/Account, filtraggio selettori, PUK/valueEnc mascherati prima di decifrare, consenso/riautenticazione, formula injection, revoca fino al download e parità dei metadati allegati. Non confondere Excel con backup cifrato.
5. Chiudere i gate tecnici M5–M10 ancora autonomi: staging/ripresa backup, retry, orfani e concorrenza su copie sintetiche; callable/Auth/App Check, transizione writer e Rules produttive da progettare/testare prima di attivare.
6. Eseguire i collaudi fisici/esterni rimasti, poi preparare cutover della shell e piano di rollback. Solo dopo parità e gate soddisfatti proporre un rilascio complessivo. Il programma NON è concluso.

Quando una voce dipende da Diego, registrarla e proseguire una voce indipendente. Nuovo ramo solo se serve un isolamento reale; evitare altri rami per il solo fatto di aver terminato un turno.

## 7. Cartelle locali dopo il riordino

Il riordino locale è stato completato il 16/09/2026. La sola cartella operativa di questo progetto è:

`C:/Users/Diego/Documents/Progetti/App-Codici-Password`

La vecchia copia `Documents/Progetti/Codici&Password`, i worktree temporanei e le cartelle datate di Codex sono stati rimossi dopo la creazione e verifica di un archivio locale. Non cercare né ricreare il progetto sotto `Documents/Codex`.

L'archivio del riordino si trova sotto `_archivio_locale/` nella cartella principale ed è escluso localmente da Git. Il file ZIP è stato verificato con SHA-256 `3E328786B9B861498D4A63487655172B9B8FEC193F9D1FE74B72A8CFFA33A692`. Contiene le copie precedenti e i materiali locali; non va importato nel ramo né pubblicato.

Il codice Excel resta recuperabile dal ramo remoto `origin/codex/real-excel-export-preview`, commit `40052515dd493279c0f49118205b9405eef05376`. Non è montato integralmente nella shell e non è online. Gli output dimostrativi e le configurazioni locali del vecchio clone sono conservati soltanto nell'archivio verificato.

Gli altri progetti locali sono separati in `Documents/Progetti/LogiDesk`, `Documents/Progetti/Traduttore` e `Documents/Progetti/auditkit`; non fanno parte di Codici & Password.

La cartella principale contiene la candidata più avanzata, non il codice identico all'app online. Per un correttivo produttivo partire da `origin/master` aggiornato in un worktree dedicato. Per il programma MD continuare sul ramo di integrazione dopo aver verificato lo stato remoto e la PR.

## 8. Come leggere e aggiornare gli MD

1. `docs/GUIDA_PROGETTO.md`: indice e gerarchia.
2. `docs/ARCHITETTURA_SICUREZZA_V1.md`: baseline vincolante, invariata.
3. `docs/PIANO_MATURITA_PROFESSIONALE.md`: stato attuale e ordine dei lavori; le sezioni precedenti sono cronologia.
4. Contratti dell'area: `VAULT_KEY_CONTRACT.md`, `DATA_ACCESS_CONTRACT.md`, `FUNCTIONAL_DATA_CONTRACT.md`, `PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md`, M5–M10 secondo attività.
5. `Frontend/GUIDA.md` e `Frontend/GUIDA_AGGIORNAMENTI.md`: regole applicative, UI e diario.
6. Verificare sempre codice, Rules, Functions e test; un checkbox storico non certifica il nuovo percorso.

Prima della relazione risultavano 39 MD tracciati: comprendono guide, audit, inventari e contratti, non 39 programmi. Questa relazione aggiunge un documento di consegna, non una seconda roadmap. Le sezioni storiche conservano versione/data originali; lo stato corrente in testa prevale sulla vecchia lista operativa, senza derogare alla baseline.

## 9. Ambiente, test e limiti operativi

Windows/PowerShell, Node 24 locale; CI Node 22 e Java 21. Emulatori solo progetto `demo-vault-shell` per la candidata. Eseguire suite che usano gli stessi emulatori in sequenza, non in parallelo. Chrome 152 verificato; Edge locale nella candidata termina prima di DevTools, non attribuirgli successi non eseguiti. Nessun test qui autorizza l'accesso ai dati reali.

Comandi dalla cartella principale: `npm test`, `node scripts/run-vault-session-emulators.mjs --entry-browser`, `node scripts/run-vault-session-emulators.mjs --crash-browser` con `VAULT_SHELL_BROWSER=chrome`; `git diff --check`, `node scripts/audit-project-inventory.mjs`. Adattare i test al cambiamento; evitare ripetizioni senza nuove modifiche o dubbi.

I vecchi log locali sono nell'archivio del riordino, non più nella cartella datata `co/work`. Non allegare log grezzi senza controllare eventuali segreti. Non stampare l'output JSON di login Firebase: può includere token; usare soltanto stato filtrato.

Prima di lavorare: controllare directory, branch, status e processi propri. Non modificare master/deploy nella prosecuzione MD; il consenso del PDF riguardava quel rilascio isolato. Non integrare ramo documentale cloud `3a8e5a2` o patch `851b788` come base della shell. Non fare nuove migrazioni/distruzioni né cancellare code senza autorizzazione specifica. Commit coerenti e push sulla PR #67, documentando test e limiti. Il nuovo agente deve riferire prima ciò che ha verificato, poi proseguire il blocco concordato.

## 10. Comando pronto per il nuovo agente

```text
Lavora sul progetto Codici & Password nella sola cartella C:/Users/Diego/Documents/Progetti/App-Codici-Password. Prima di modificare file verifica directory, git status, ramo, ultimo commit, origin e stato della PR #67. Leggi integralmente docs/PASSAGGIO_CONSEGNE_2026-09-16.md, poi docs/GUIDA_PROGETTO.md, docs/ARCHITETTURA_SICUREZZA_V1.md e docs/PIANO_MATURITA_PROFESSIONALE.md; consulta i contratti specialistici indicati per l'area che tocchi. La direzione approvata è la shell persistente con Vault Key solo in RAM.

Produzione è 1.2.128 su origin/master, con PDF aziendale già pubblicato separatamente. La candidata integration/vault-shell-v127-security è pubblicata su GitHub ma non distribuita: contiene molto lavoro sperimentale e non ha ancora parità completa, trasporto produttivo/App Check, transizione dei writer, migrazione/rollback e collaudi fisici sufficienti. Non confondere commit o push con merge e deploy. Non modificare master, non fare bump e non distribuire Hosting, Functions o Rules senza nuova autorizzazione esplicita.

Aggiorna prima i riferimenti remoti e confronta selettivamente origin/master con la candidata, iniziando dalla riconciliazione della release PDF 1.2.128 senza merge o cherry-pick cieco. Poi prosegui il primo blocco autonomo ancora aperto nel piano: parità degli editor profilo e Account, contatti/indirizzi/documenti, Widget/banca e creazione Account dal collegamento. Conserva sicurezza, compatibilità legacy, UID, revisioni, ricevute, riferimenti inversi e code pendenti. Il ramo Excel origin/codex/real-excel-export-preview@40052515 è materiale da integrare selettivamente più avanti; non è online.

Usa soltanto dati sintetici ed emulatori. Non leggere o modificare dati reali. Esegui test proporzionati al blocco, poi suite completa e browser/emulatori quando il cambiamento lo richiede. Aggiorna nello stesso commit gli MD autorevoli interessati, distinguendo fatto verificato, laboratorio, produzione e gate aperti. Crea commit piccoli e coerenti e pubblicali sul ramo sperimentale/PR #67. Se una prova richiede Diego o un dispositivo reale, registrala come gate e continua con un'attività indipendente. Fermati prima di qualsiasi merge in master, deploy, migrazione o operazione distruttiva e riferisci esattamente il risultato.
```

# A4 — censimento documenti del profilo

Il profilo privato conserva i documenti nell'array `users/{uid}.documenti[]`. Il writer reale assegna alle nuove righe `document-<uuid>`; `profile-model.js` sintetizza invece `document-legacy-<hash>` quando manca l'ID, usando contenuto e posizione. Quell'identità derivata non è persistita: la riga resta consultabile ma non è modificabile né eliminabile.

I campi cifrati dal writer `profilo-sync.js` sono `num_serie`, `cf_value`, `id_number`, `license_number`, `cf`, `rilasciato_da`, `luogo_rilascio`, `username`, `password`, `pin`, `puk`, `codice_app`, `note`, `categoria` e `home_page`. `type`, `name`, `data_rilascio`, `expiry_date` e `isPrimary` restano in chiaro. Il contratto A4 ammette soltanto questi campi e conserva byte per byte chiavi sconosciute, `linkedAccountId`, `linkedAccountCompanyId` ed `expiryReference`.

Il collegamento Account è nella riga documento e usa il servizio profilo già esistente. Gli allegati immagine sono record distinti in `users/{uid}/profileDocumentAttachments/{attachmentId}` e il loro flusso DS-002 non viene duplicato. Una cancellazione legge quei record nella stessa transazione e si arresta se ne esiste almeno uno. Il QR non contiene un elenco di documenti: `qr_code_utils-v2.js` ricava il codice fiscale dalla prima riga il cui tipo contiene “fiscale” quando `settings/qrCodeInclusions.cf` è vero. Perciò l'eliminazione di quella riga è bloccata; una configurazione non canonica blocca ogni eliminazione in fail-closed.

Il profilo aziendale non espone una collezione equivalente a `documenti[]`. Conserva soltanto `allegati[]` nell'anagrafica azienda, con writer e Storage legacy separati. A4 non converte quegli allegati in documenti privati, non inventa ID o campi e non monta un editor documenti aziendale.

La mutazione candidata aggiorna l'intero array soltanto dentro una transazione con revisione, impronta della riga e ricevuta idempotente. La sorgente rilegge il profilo confermato prima di preparare, cifra localmente i soli campi classificati, revoca su lock/logout/cambio UID/cambio sezione e non consente scritture offline.

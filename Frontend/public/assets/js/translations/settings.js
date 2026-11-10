const it = {
  frame_diag_title: "Cornice",
  frame_diag_description: "Registro locale di questa scheda, spento per impostazione predefinita. Nessun invio di rete. Disattivarlo elimina gli eventi.",
  frame_diag_logging: "Registra eventi della cornice",
  frame_diag_active: "Cornice attiva",
  frame_diag_permit: "Permesso valido",
  frame_diag_expiry: "Scadenza permesso",
  frame_diag_idle: "Inattività in uso",
  frame_diag_worker: "Worker notifiche pronto",
  frame_diag_last_lock: "Ultimo blocco",
  frame_diag_unavailable: "Non disponibile",
  frame_diag_none: "Nessuno",
  frame_diag_count: "{count}/200 eventi · massimo 7 giorni",
  frame_diag_yes: "Sì",
  frame_diag_no: "No",
  frame_diag_copy: "Copia rapporto",
  frame_diag_clear: "Cancella",
  frame_diag_version: "Versione",

  settings_digital_card_manage: 'Gestisci Tessera digitale',
  settings_company_area_title: 'Mostra area Azienda', settings_company_area_desc: 'Nasconde o mostra l’area aziendale senza eliminare i dati',
  settings_shared_credentials_title: 'Credenziali comuni', settings_shared_credentials_desc: 'Dati protetti richiamabili da più Account',
  settings_backup_export_title: 'Backup cifrato', settings_backup_export_desc: 'Esporta Vault e allegati con una Recovery Key separata',
  settings_portable_export_title: 'Esporta archivio portabile', settings_portable_export_desc: 'Crea una copia consultabile fuori dall’app, protetta da una password dedicata',
  settings_backup_restore_title: 'Ripristina backup', settings_backup_restore_desc: 'Verifica prima il file e blocca qualsiasi collisione',
  settings_credential_health_title: 'Salute credenziali', settings_credential_health_desc: 'Controlla localmente password deboli, duplicate o datate',
  settings_field_usage_title: 'Utilizzo campi Account', settings_field_usage_desc: 'Conta localmente soltanto i campi realmente compilati',
  settings_manage_lists_desc: 'Gestisci liste e tipologie', settings_totp_desc: 'Codice tramite app Authenticator (TOTP)',
  settings_recovery_codes_title: 'Codici di recupero 2FA', settings_recovery_codes_desc: "Generazione temporaneamente non disponibile", settings_recovery_codes_help: "Per problemi di accesso 2FA, contatta l’assistenza. Non inviare password o codici.",
  settings_master_password_title: 'Master Password della Vault', settings_master_password_desc: 'Cambia la Master Password senza modificare la password di login',
  settings_inactivity_desc: 'Blocca la Vault dopo il periodo scelto',
  settings_revoke_sessions_title: 'Disconnetti tutte le postazioni', settings_revoke_sessions_desc: 'Revoca le sessioni Firebase su PC, tablet e telefono, inclusa questa',
  settings_deadline_notifications_title: 'Notifiche scadenze', settings_check_availability: 'Verifica disponibilità…',
  settings_deadline_notifications_aria: 'Notifiche Push per le scadenze', settings_test_notification: 'Invia notifica di prova su questo dispositivo',
  settings_shared_notifications_title: 'Notifiche inviti condivisi', settings_shared_notifications_aria: 'Notifiche Push per gli inviti condivisi',
  settings_diagnostics_heading: 'Diagnostica', settings_diagnostics_title: 'Diagnostica App e motori',
  settings_diagnostics_desc: 'Misura velocità e controlla servizi essenziali e stato dei motori. Nessun dato della Vault.',
  settings_diagnostics_aria: 'Misura velocità app', settings_run_diagnostics: 'Esegui controlli app',
  settings_refresh: 'Aggiorna', settings_copy_report: 'Copia report', settings_clear_measurements: 'Cancella misure'
};

const en = {
  frame_diag_title: "Frame",
  frame_diag_description: "Local log for this tab, disabled by default. Nothing is sent over the network. Disabling it deletes the events.",
  frame_diag_logging: "Record frame events",
  frame_diag_active: "Frame active",
  frame_diag_permit: "Authorization valid",
  frame_diag_expiry: "Authorization expiry",
  frame_diag_idle: "Current inactivity timeout",
  frame_diag_worker: "Notification worker ready",
  frame_diag_last_lock: "Last lock",
  frame_diag_unavailable: "Unavailable",
  frame_diag_none: "None",
  frame_diag_count: "{count}/200 events · up to 7 days",
  frame_diag_yes: "Yes",
  frame_diag_no: "No",
  frame_diag_copy: "Copy report",
  frame_diag_clear: "Clear",
  frame_diag_version: "Version",

  settings_digital_card_manage: 'Manage digital card',
  settings_company_area_title: 'Show Company area', settings_company_area_desc: 'Show or hide the company area without deleting data',
  settings_shared_credentials_title: 'Shared credentials', settings_shared_credentials_desc: 'Protected data reusable across multiple Accounts',
  settings_backup_export_title: 'Encrypted backup', settings_backup_export_desc: 'Export Vault and attachments with a separate Recovery Key',
  settings_portable_export_title: 'Export portable archive', settings_portable_export_desc: 'Create a copy readable outside the app, protected by a dedicated password',
  settings_backup_restore_title: 'Restore backup', settings_backup_restore_desc: 'Validate the file first and block every collision',
  settings_credential_health_title: 'Credential health', settings_credential_health_desc: 'Check weak, duplicate, or old passwords locally',
  settings_field_usage_title: 'Account field usage', settings_field_usage_desc: 'Locally count only fields that are actually filled in',
  settings_manage_lists_desc: 'Manage lists and types', settings_totp_desc: 'Code from an Authenticator app (TOTP)',
  settings_recovery_codes_title: '2FA recovery codes', settings_recovery_codes_desc: "Generation temporarily unavailable", settings_recovery_codes_help: "For 2FA sign-in problems, contact support. Do not send passwords or codes.",
  settings_master_password_title: 'Vault Master Password', settings_master_password_desc: 'Change the Master Password without changing the login password',
  settings_inactivity_desc: 'Lock the Vault after the selected period',
  settings_revoke_sessions_title: 'Sign out all devices', settings_revoke_sessions_desc: 'Revoke Firebase sessions on PC, tablet, and phone, including this one',
  settings_deadline_notifications_title: 'Deadline notifications', settings_check_availability: 'Checking availability…',
  settings_deadline_notifications_aria: 'Push notifications for deadlines', settings_test_notification: 'Send a test notification to this device',
  settings_shared_notifications_title: 'Shared-invitation notifications', settings_shared_notifications_aria: 'Push notifications for shared invitations',
  settings_diagnostics_heading: 'Diagnostics', settings_diagnostics_title: 'App and engine diagnostics',
  settings_diagnostics_desc: 'Measure speed and check essential services and engine status. No Vault data.',
  settings_diagnostics_aria: 'Measure app speed', settings_run_diagnostics: 'Run app checks',
  settings_refresh: 'Refresh', settings_copy_report: 'Copy report', settings_clear_measurements: 'Clear measurements'
};

const es = {
  frame_diag_title: "Marco",
  frame_diag_description: "Registro local de esta pestaña, desactivado de forma predeterminada. No se envía nada por la red. Al desactivarlo se eliminan los eventos.",
  frame_diag_logging: "Registrar eventos del marco",
  frame_diag_active: "Marco activo",
  frame_diag_permit: "Permiso válido",
  frame_diag_expiry: "Vencimiento del permiso",
  frame_diag_idle: "Tiempo de inactividad actual",
  frame_diag_worker: "Worker de notificaciones listo",
  frame_diag_last_lock: "Último bloqueo",
  frame_diag_unavailable: "No disponible",
  frame_diag_none: "Ninguno",
  frame_diag_count: "{count}/200 eventos · máximo 7 días",
  frame_diag_yes: "Sí",
  frame_diag_no: "No",
  frame_diag_copy: "Copiar informe",
  frame_diag_clear: "Borrar",
  frame_diag_version: "Versión",

  settings_digital_card_manage: 'Gestionar tarjeta digital',
  settings_company_area_title: 'Mostrar área Empresa', settings_company_area_desc: 'Muestra u oculta el área empresarial sin eliminar datos',
  settings_shared_credentials_title: 'Credenciales compartidas', settings_shared_credentials_desc: 'Datos protegidos reutilizables en varias Cuentas',
  settings_backup_export_title: 'Copia de seguridad cifrada', settings_backup_export_desc: 'Exporta la Bóveda y los adjuntos con una Clave de recuperación separada',
  settings_portable_export_title: 'Exportar archivo portátil', settings_portable_export_desc: 'Crea una copia consultable fuera de la app, protegida por una contraseña específica',
  settings_backup_restore_title: 'Restaurar copia de seguridad', settings_backup_restore_desc: 'Valida primero el archivo y bloquea cualquier colisión',
  settings_credential_health_title: 'Estado de las credenciales', settings_credential_health_desc: 'Comprueba localmente contraseñas débiles, duplicadas o antiguas',
  settings_field_usage_title: 'Uso de campos de Cuenta', settings_field_usage_desc: 'Cuenta localmente solo los campos realmente completados',
  settings_manage_lists_desc: 'Gestionar listas y tipos', settings_totp_desc: 'Código mediante una app Authenticator (TOTP)',
  settings_recovery_codes_title: 'Códigos de recuperación 2FA', settings_recovery_codes_desc: "Generación temporalmente no disponible", settings_recovery_codes_help: "Si tienes problemas para acceder con 2FA, contacta con soporte. No envíes contraseñas ni códigos.",
  settings_master_password_title: 'Contraseña maestra de la Bóveda', settings_master_password_desc: 'Cambia la contraseña maestra sin cambiar la contraseña de acceso',
  settings_inactivity_desc: 'Bloquea la Bóveda tras el periodo elegido', settings_revoke_sessions_title: 'Cerrar sesión en todos los dispositivos', settings_revoke_sessions_desc: 'Revoca las sesiones de Firebase en PC, tableta y teléfono, incluida esta',
  settings_deadline_notifications_title: 'Notificaciones de vencimientos', settings_check_availability: 'Comprobando disponibilidad…', settings_deadline_notifications_aria: 'Notificaciones push de vencimientos', settings_test_notification: 'Enviar una notificación de prueba a este dispositivo',
  settings_shared_notifications_title: 'Notificaciones de invitaciones compartidas', settings_shared_notifications_aria: 'Notificaciones push de invitaciones compartidas',
  settings_diagnostics_heading: 'Diagnóstico', settings_diagnostics_title: 'Diagnóstico de la app y motores', settings_diagnostics_desc: 'Mide la velocidad y comprueba los servicios esenciales y el estado de los motores. Sin datos de la Bóveda.', settings_diagnostics_aria: 'Medir velocidad de la app', settings_run_diagnostics: 'Ejecutar controles de la app', settings_refresh: 'Actualizar', settings_copy_report: 'Copiar informe', settings_clear_measurements: 'Borrar mediciones'
};

const fr = {
  frame_diag_title: "Cadre",
  frame_diag_description: "Journal local de cet onglet, désactivé par défaut. Aucun envoi sur le réseau. Le désactiver supprime les événements.",
  frame_diag_logging: "Enregistrer les événements du cadre",
  frame_diag_active: "Cadre actif",
  frame_diag_permit: "Autorisation valide",
  frame_diag_expiry: "Expiration de l’autorisation",
  frame_diag_idle: "Délai d’inactivité actuel",
  frame_diag_worker: "Worker de notifications prêt",
  frame_diag_last_lock: "Dernier verrouillage",
  frame_diag_unavailable: "Indisponible",
  frame_diag_none: "Aucun",
  frame_diag_count: "{count}/200 événements · 7 jours maximum",
  frame_diag_yes: "Oui",
  frame_diag_no: "Non",
  frame_diag_copy: "Copier le rapport",
  frame_diag_clear: "Effacer",
  frame_diag_version: "Version",

  settings_digital_card_manage: 'Gérer la carte numérique', settings_company_area_title: 'Afficher l’espace Entreprise', settings_company_area_desc: 'Affiche ou masque l’espace entreprise sans supprimer les données', settings_shared_credentials_title: 'Identifiants partagés', settings_shared_credentials_desc: 'Données protégées réutilisables dans plusieurs Comptes', settings_backup_export_title: 'Sauvegarde chiffrée', settings_backup_export_desc: 'Exporte le Coffre et les pièces jointes avec une Clé de récupération distincte', settings_portable_export_title: 'Exporter l’archive portable', settings_portable_export_desc: 'Crée une copie consultable hors de l’app, protégée par un mot de passe dédié', settings_backup_restore_title: 'Restaurer la sauvegarde', settings_backup_restore_desc: 'Valide d’abord le fichier et bloque toute collision', settings_credential_health_title: 'État des identifiants', settings_credential_health_desc: 'Vérifie localement les mots de passe faibles, dupliqués ou anciens', settings_field_usage_title: 'Utilisation des champs de Compte', settings_field_usage_desc: 'Compte localement uniquement les champs réellement renseignés', settings_manage_lists_desc: 'Gérer les listes et les types', settings_totp_desc: 'Code via une app Authenticator (TOTP)', settings_recovery_codes_title: 'Codes de récupération 2FA', settings_recovery_codes_desc: "Génération temporairement indisponible", settings_recovery_codes_help: "Pour un problème de connexion 2FA, contactez l’assistance. N’envoyez ni mots de passe ni codes.", settings_master_password_title: 'Mot de passe principal du Coffre', settings_master_password_desc: 'Modifie le mot de passe principal sans changer le mot de passe de connexion', settings_inactivity_desc: 'Verrouille le Coffre après la durée choisie', settings_revoke_sessions_title: 'Déconnecter tous les appareils', settings_revoke_sessions_desc: 'Révoque les sessions Firebase sur PC, tablette et téléphone, y compris celle-ci', settings_deadline_notifications_title: 'Notifications d’échéances', settings_check_availability: 'Vérification de la disponibilité…', settings_deadline_notifications_aria: 'Notifications push des échéances', settings_test_notification: 'Envoyer une notification de test à cet appareil', settings_shared_notifications_title: 'Notifications d’invitations partagées', settings_shared_notifications_aria: 'Notifications push des invitations partagées', settings_diagnostics_heading: 'Diagnostic', settings_diagnostics_title: 'Diagnostic de l’app et des moteurs', settings_diagnostics_desc: 'Mesure la vitesse et vérifie les services essentiels et l’état des moteurs. Aucune donnée du Coffre.', settings_diagnostics_aria: 'Mesurer la vitesse de l’app', settings_run_diagnostics: 'Exécuter les contrôles de l’app', settings_refresh: 'Actualiser', settings_copy_report: 'Copier le rapport', settings_clear_measurements: 'Effacer les mesures'
};

const de = {
  frame_diag_title: "Rahmen",
  frame_diag_description: "Lokales Protokoll dieses Tabs, standardmäßig deaktiviert. Keine Übertragung über das Netzwerk. Beim Deaktivieren werden die Ereignisse gelöscht.",
  frame_diag_logging: "Rahmenereignisse aufzeichnen",
  frame_diag_active: "Rahmen aktiv",
  frame_diag_permit: "Berechtigung gültig",
  frame_diag_expiry: "Ablauf der Berechtigung",
  frame_diag_idle: "Aktuelle Inaktivitätsdauer",
  frame_diag_worker: "Benachrichtigungs-Worker bereit",
  frame_diag_last_lock: "Letzte Sperrung",
  frame_diag_unavailable: "Nicht verfügbar",
  frame_diag_none: "Keine",
  frame_diag_count: "{count}/200 Ereignisse · höchstens 7 Tage",
  frame_diag_yes: "Ja",
  frame_diag_no: "Nein",
  frame_diag_copy: "Bericht kopieren",
  frame_diag_clear: "Löschen",
  frame_diag_version: "Version",

  settings_digital_card_manage: 'Digitale Karte verwalten', settings_company_area_title: 'Unternehmensbereich anzeigen', settings_company_area_desc: 'Blendet den Unternehmensbereich ein oder aus, ohne Daten zu löschen', settings_shared_credentials_title: 'Gemeinsame Zugangsdaten', settings_shared_credentials_desc: 'Geschützte Daten, die in mehreren Konten verwendet werden können', settings_backup_export_title: 'Verschlüsseltes Backup', settings_backup_export_desc: 'Tresor und Anhänge mit einem separaten Wiederherstellungsschlüssel exportieren', settings_portable_export_title: 'Portables Archiv exportieren', settings_portable_export_desc: 'Eine außerhalb der App lesbare Kopie mit eigenem Passwort erstellen', settings_backup_restore_title: 'Backup wiederherstellen', settings_backup_restore_desc: 'Datei zuerst prüfen und jede Kollision blockieren', settings_credential_health_title: 'Zustand der Zugangsdaten', settings_credential_health_desc: 'Schwache, doppelte oder alte Passwörter lokal prüfen', settings_field_usage_title: 'Nutzung der Kontofelder', settings_field_usage_desc: 'Nur tatsächlich ausgefüllte Felder lokal zählen', settings_manage_lists_desc: 'Listen und Typen verwalten', settings_totp_desc: 'Code über eine Authenticator-App (TOTP)', settings_recovery_codes_title: '2FA-Wiederherstellungscodes', settings_recovery_codes_desc: "Generierung vorübergehend nicht verfügbar", settings_recovery_codes_help: "Wenden Sie sich bei Problemen mit der 2FA-Anmeldung an den Support. Senden Sie keine Passwörter oder Codes.", settings_master_password_title: 'Tresor-Master-Passwort', settings_master_password_desc: 'Master-Passwort ändern, ohne das Anmeldepasswort zu ändern', settings_inactivity_desc: 'Tresor nach dem gewählten Zeitraum sperren', settings_revoke_sessions_title: 'Alle Geräte abmelden', settings_revoke_sessions_desc: 'Firebase-Sitzungen auf PC, Tablet und Telefon widerrufen, einschließlich dieser', settings_deadline_notifications_title: 'Fristbenachrichtigungen', settings_check_availability: 'Verfügbarkeit wird geprüft…', settings_deadline_notifications_aria: 'Push-Benachrichtigungen für Fristen', settings_test_notification: 'Testbenachrichtigung an dieses Gerät senden', settings_shared_notifications_title: 'Benachrichtigungen zu geteilten Einladungen', settings_shared_notifications_aria: 'Push-Benachrichtigungen für geteilte Einladungen', settings_diagnostics_heading: 'Diagnose', settings_diagnostics_title: 'App- und Moduldiagnose', settings_diagnostics_desc: 'Misst die Geschwindigkeit und prüft wichtige Dienste und den Modulstatus. Keine Tresordaten.', settings_diagnostics_aria: 'App-Geschwindigkeit messen', settings_run_diagnostics: 'App-Prüfungen ausführen', settings_refresh: 'Aktualisieren', settings_copy_report: 'Bericht kopieren', settings_clear_measurements: 'Messwerte löschen'
};

const zh = {
  frame_diag_title: "框架",
  frame_diag_description: "此标签页的本地日志，默认关闭。不会通过网络发送任何内容。关闭后会删除事件记录。",
  frame_diag_logging: "记录框架事件",
  frame_diag_active: "框架已启用",
  frame_diag_permit: "权限有效",
  frame_diag_expiry: "权限到期时间",
  frame_diag_idle: "当前非活动超时",
  frame_diag_worker: "通知工作线程已就绪",
  frame_diag_last_lock: "上次锁定",
  frame_diag_unavailable: "不可用",
  frame_diag_none: "无",
  frame_diag_count: "{count}/200 条事件 · 最长保留 7 天",
  frame_diag_yes: "是",
  frame_diag_no: "否",
  frame_diag_copy: "复制报告",
  frame_diag_clear: "清除",
  frame_diag_version: "版本",

  settings_digital_card_manage: '管理数字卡片', settings_company_area_title: '显示企业区域', settings_company_area_desc: '显示或隐藏企业区域，不删除数据', settings_shared_credentials_title: '共享凭据', settings_shared_credentials_desc: '可供多个账户使用的受保护数据', settings_backup_export_title: '加密备份', settings_backup_export_desc: '使用独立恢复密钥导出保险库和附件', settings_portable_export_title: '导出便携归档', settings_portable_export_desc: '创建可在应用外查看且由专用密码保护的副本', settings_backup_restore_title: '恢复备份', settings_backup_restore_desc: '先验证文件并阻止任何冲突', settings_credential_health_title: '凭据安全状况', settings_credential_health_desc: '在本地检查弱密码、重复密码或旧密码', settings_field_usage_title: '账户字段使用情况', settings_field_usage_desc: '仅在本地统计实际填写的字段', settings_manage_lists_desc: '管理列表和类型', settings_totp_desc: '通过身份验证器应用获取代码（TOTP）', settings_recovery_codes_title: '2FA 恢复代码', settings_recovery_codes_desc: "暂时无法生成", settings_recovery_codes_help: "如果遇到双因素认证登录问题，请联系支持人员。请勿发送密码或代码。", settings_master_password_title: '保险库主密码', settings_master_password_desc: '更改主密码而不更改登录密码', settings_inactivity_desc: '在所选时长后锁定保险库', settings_revoke_sessions_title: '退出所有设备', settings_revoke_sessions_desc: '撤销电脑、平板和手机上的 Firebase 会话，包括当前会话', settings_deadline_notifications_title: '到期提醒', settings_check_availability: '正在检查可用性…', settings_deadline_notifications_aria: '到期事项推送通知', settings_test_notification: '向此设备发送测试通知', settings_shared_notifications_title: '共享邀请通知', settings_shared_notifications_aria: '共享邀请推送通知', settings_diagnostics_heading: '诊断', settings_diagnostics_title: '应用和引擎诊断', settings_diagnostics_desc: '测量速度并检查关键服务和引擎状态。不读取保险库数据。', settings_diagnostics_aria: '测量应用速度', settings_run_diagnostics: '运行应用检查', settings_refresh: '刷新', settings_copy_report: '复制报告', settings_clear_measurements: '清除测量结果'
};

const hi = {
  frame_diag_title: "फ़्रेम",
  frame_diag_description: "इस टैब का स्थानीय लॉग, जो डिफ़ॉल्ट रूप से बंद है। नेटवर्क पर कुछ नहीं भेजा जाता। इसे बंद करने पर घटनाओं के रिकॉर्ड मिट जाते हैं।",
  frame_diag_logging: "फ़्रेम की घटनाएँ रिकॉर्ड करें",
  frame_diag_active: "फ़्रेम सक्रिय है",
  frame_diag_permit: "अनुमति मान्य है",
  frame_diag_expiry: "अनुमति की समाप्ति",
  frame_diag_idle: "वर्तमान निष्क्रियता समय सीमा",
  frame_diag_worker: "सूचना वर्कर तैयार है",
  frame_diag_last_lock: "पिछला लॉक",
  frame_diag_unavailable: "उपलब्ध नहीं",
  frame_diag_none: "कोई नहीं",
  frame_diag_count: "{count}/200 घटनाएँ · अधिकतम 7 दिन",
  frame_diag_yes: "हाँ",
  frame_diag_no: "नहीं",
  frame_diag_copy: "रिपोर्ट कॉपी करें",
  frame_diag_clear: "मिटाएँ",
  frame_diag_version: "संस्करण",

  settings_digital_card_manage: 'डिजिटल कार्ड प्रबंधित करें', settings_company_area_title: 'कंपनी क्षेत्र दिखाएँ', settings_company_area_desc: 'डेटा हटाए बिना कंपनी क्षेत्र दिखाएँ या छिपाएँ', settings_shared_credentials_title: 'साझा क्रेडेंशियल', settings_shared_credentials_desc: 'कई खातों में उपयोग योग्य सुरक्षित डेटा', settings_backup_export_title: 'एन्क्रिप्टेड बैकअप', settings_backup_export_desc: 'अलग रिकवरी कुंजी के साथ वॉल्ट और अटैचमेंट निर्यात करें', settings_portable_export_title: 'पोर्टेबल संग्रह निर्यात करें', settings_portable_export_desc: 'ऐप के बाहर पढ़ी जा सकने वाली, समर्पित पासवर्ड से सुरक्षित प्रति बनाएँ', settings_backup_restore_title: 'बैकअप पुनर्स्थापित करें', settings_backup_restore_desc: 'पहले फ़ाइल सत्यापित करें और हर टकराव रोकें', settings_credential_health_title: 'क्रेडेंशियल की स्थिति', settings_credential_health_desc: 'कमज़ोर, दोहराए गए या पुराने पासवर्ड स्थानीय रूप से जाँचें', settings_field_usage_title: 'खाता फ़ील्ड उपयोग', settings_field_usage_desc: 'केवल वास्तव में भरे गए फ़ील्ड स्थानीय रूप से गिनें', settings_manage_lists_desc: 'सूचियाँ और प्रकार प्रबंधित करें', settings_totp_desc: 'Authenticator ऐप से कोड (TOTP)', settings_recovery_codes_title: '2FA रिकवरी कोड', settings_recovery_codes_desc: "अभी कोड बनाना उपलब्ध नहीं है", settings_recovery_codes_help: "2FA लॉगिन की समस्या के लिए सहायता से संपर्क करें। पासवर्ड या कोड न भेजें।", settings_master_password_title: 'वॉल्ट मास्टर पासवर्ड', settings_master_password_desc: 'लॉगिन पासवर्ड बदले बिना मास्टर पासवर्ड बदलें', settings_inactivity_desc: 'चुनी अवधि के बाद वॉल्ट लॉक करें', settings_revoke_sessions_title: 'सभी डिवाइस से साइन आउट करें', settings_revoke_sessions_desc: 'PC, टैबलेट और फ़ोन पर Firebase सत्र रद्द करें, इस सत्र सहित', settings_deadline_notifications_title: 'समय-सीमा सूचनाएँ', settings_check_availability: 'उपलब्धता जाँची जा रही है…', settings_deadline_notifications_aria: 'समय-सीमा के लिए पुश सूचनाएँ', settings_test_notification: 'इस डिवाइस पर परीक्षण सूचना भेजें', settings_shared_notifications_title: 'साझा आमंत्रण सूचनाएँ', settings_shared_notifications_aria: 'साझा आमंत्रणों के लिए पुश सूचनाएँ', settings_diagnostics_heading: 'निदान', settings_diagnostics_title: 'ऐप और इंजन निदान', settings_diagnostics_desc: 'गति मापें और आवश्यक सेवाओं व इंजन की स्थिति जाँचें। वॉल्ट डेटा नहीं।', settings_diagnostics_aria: 'ऐप की गति मापें', settings_run_diagnostics: 'ऐप जाँच चलाएँ', settings_refresh: 'रीफ़्रेश करें', settings_copy_report: 'रिपोर्ट कॉपी करें', settings_clear_measurements: 'माप हटाएँ'
};

const pt = {
  frame_diag_title: "Moldura",
  frame_diag_description: "Registo local deste separador, desativado por predefinição. Nada é enviado pela rede. Desativá-lo elimina os eventos.",
  frame_diag_logging: "Registar eventos da moldura",
  frame_diag_active: "Moldura ativa",
  frame_diag_permit: "Permissão válida",
  frame_diag_expiry: "Validade da permissão",
  frame_diag_idle: "Tempo de inatividade atual",
  frame_diag_worker: "Worker de notificações pronto",
  frame_diag_last_lock: "Último bloqueio",
  frame_diag_unavailable: "Indisponível",
  frame_diag_none: "Nenhum",
  frame_diag_count: "{count}/200 eventos · máximo de 7 dias",
  frame_diag_yes: "Sim",
  frame_diag_no: "Não",
  frame_diag_copy: "Copiar relatório",
  frame_diag_clear: "Limpar",
  frame_diag_version: "Versão",

  settings_digital_card_manage: 'Gerir cartão digital', settings_company_area_title: 'Mostrar área Empresa', settings_company_area_desc: 'Mostra ou oculta a área empresarial sem eliminar dados', settings_shared_credentials_title: 'Credenciais partilhadas', settings_shared_credentials_desc: 'Dados protegidos reutilizáveis em várias Contas', settings_backup_export_title: 'Cópia de segurança cifrada', settings_backup_export_desc: 'Exporta o Cofre e os anexos com uma Chave de recuperação separada', settings_portable_export_title: 'Exportar arquivo portátil', settings_portable_export_desc: 'Cria uma cópia consultável fora da app, protegida por uma palavra-passe dedicada', settings_backup_restore_title: 'Restaurar cópia de segurança', settings_backup_restore_desc: 'Valida primeiro o ficheiro e bloqueia qualquer colisão', settings_credential_health_title: 'Estado das credenciais', settings_credential_health_desc: 'Verifica localmente palavras-passe fracas, duplicadas ou antigas', settings_field_usage_title: 'Utilização dos campos da Conta', settings_field_usage_desc: 'Conta localmente apenas os campos realmente preenchidos', settings_manage_lists_desc: 'Gerir listas e tipos', settings_totp_desc: 'Código através de uma app Authenticator (TOTP)', settings_recovery_codes_title: 'Códigos de recuperação 2FA', settings_recovery_codes_desc: "Geração temporariamente indisponível", settings_recovery_codes_help: "Para problemas ao entrar com 2FA, contacte o suporte. Não envie palavras-passe nem códigos.", settings_master_password_title: 'Palavra-passe principal do Cofre', settings_master_password_desc: 'Altera a palavra-passe principal sem alterar a palavra-passe de acesso', settings_inactivity_desc: 'Bloqueia o Cofre após o período escolhido', settings_revoke_sessions_title: 'Terminar sessão em todos os dispositivos', settings_revoke_sessions_desc: 'Revoga sessões Firebase no PC, tablet e telefone, incluindo esta', settings_deadline_notifications_title: 'Notificações de prazos', settings_check_availability: 'A verificar disponibilidade…', settings_deadline_notifications_aria: 'Notificações push de prazos', settings_test_notification: 'Enviar uma notificação de teste para este dispositivo', settings_shared_notifications_title: 'Notificações de convites partilhados', settings_shared_notifications_aria: 'Notificações push de convites partilhados', settings_diagnostics_heading: 'Diagnóstico', settings_diagnostics_title: 'Diagnóstico da app e motores', settings_diagnostics_desc: 'Mede a velocidade e verifica serviços essenciais e o estado dos motores. Sem dados do Cofre.', settings_diagnostics_aria: 'Medir velocidade da app', settings_run_diagnostics: 'Executar verificações da app', settings_refresh: 'Atualizar', settings_copy_report: 'Copiar relatório', settings_clear_measurements: 'Apagar medições'
};

const portable = {
  it: { portable_password_placeholder: 'Password archivio robusta (almeno 14 caratteri)', portable_password_aria: 'Password archivio portabile', portable_confirm_placeholder: 'Ripeti la password', portable_confirm_aria: 'Conferma password archivio portabile', portable_create: 'Crea archivio', portable_title: 'Esporta archivio portabile', portable_intro: 'Stai creando una copia leggibile dei tuoi dati, utilizzabile anche al di fuori di questa app.', portable_warning: 'La copia può contenere dati personali, credenziali e allegati sensibili. Conservala in un luogo sicuro e non condividerla con persone non autorizzate.', portable_include_attachments: 'Includi gli allegati', portable_acknowledge: 'Ho compreso che questo file non è un backup reimportabile.', portable_password_required: 'Inserisci una password dedicata per l’archivio.', portable_password_short: 'Usa almeno 14 caratteri.', portable_password_long: 'Usa al massimo 256 caratteri.', portable_password_common: 'Evita parole o sequenze comuni e scegli una password unica.', portable_password_repetitive: 'Evita caratteri o schemi ripetuti.', portable_password_weak: 'Combina almeno tre tipi tra maiuscole, minuscole, numeri e simboli, oppure usa una frase di almeno 24 caratteri.', portable_password_strong: 'Password robusta.', portable_working_title: 'Creazione archivio portabile…', portable_working_desc: 'I dati vengono decifrati soltanto in memoria, cifrati a blocchi e scritti progressivamente.' },
  en: { portable_password_placeholder: 'Strong archive password (at least 14 characters)', portable_password_aria: 'Portable archive password', portable_confirm_placeholder: 'Repeat the password', portable_confirm_aria: 'Confirm portable archive password', portable_create: 'Create archive', portable_title: 'Export portable archive', portable_intro: 'You are creating a readable copy of your data that can also be used outside this app.', portable_warning: 'The copy may contain personal data, credentials, and sensitive attachments. Store it securely and do not share it with unauthorized people.', portable_include_attachments: 'Include attachments', portable_acknowledge: 'I understand that this file is not a restorable backup.', portable_password_required: 'Enter a dedicated password for the archive.', portable_password_short: 'Use at least 14 characters.', portable_password_long: 'Use no more than 256 characters.', portable_password_common: 'Avoid common words or sequences and choose a unique password.', portable_password_repetitive: 'Avoid repeated characters or patterns.', portable_password_weak: 'Combine at least three types among uppercase, lowercase, numbers, and symbols, or use a phrase of at least 24 characters.', portable_password_strong: 'Strong password.', portable_working_title: 'Creating portable archive…', portable_working_desc: 'Data is decrypted only in memory, encrypted in chunks, and written progressively.' },
  es: { portable_password_placeholder: 'Contraseña robusta del archivo (al menos 14 caracteres)', portable_password_aria: 'Contraseña del archivo portátil', portable_confirm_placeholder: 'Repite la contraseña', portable_confirm_aria: 'Confirma la contraseña del archivo portátil', portable_create: 'Crear archivo', portable_title: 'Exportar archivo portátil', portable_intro: 'Estás creando una copia legible de tus datos que también puede utilizarse fuera de esta app.', portable_warning: 'La copia puede contener datos personales, credenciales y adjuntos sensibles. Guárdala de forma segura y no la compartas con personas no autorizadas.', portable_include_attachments: 'Incluir adjuntos', portable_acknowledge: 'Entiendo que este archivo no es una copia de seguridad restaurable.', portable_password_required: 'Introduce una contraseña específica para el archivo.', portable_password_short: 'Usa al menos 14 caracteres.', portable_password_long: 'Usa como máximo 256 caracteres.', portable_password_common: 'Evita palabras o secuencias comunes y elige una contraseña única.', portable_password_repetitive: 'Evita caracteres o patrones repetidos.', portable_password_weak: 'Combina al menos tres tipos entre mayúsculas, minúsculas, números y símbolos, o usa una frase de al menos 24 caracteres.', portable_password_strong: 'Contraseña robusta.', portable_working_title: 'Creando archivo portátil…', portable_working_desc: 'Los datos se descifran solo en memoria, se cifran por bloques y se escriben progresivamente.' },
  fr: { portable_password_placeholder: 'Mot de passe robuste pour l’archive (au moins 14 caractères)', portable_password_aria: 'Mot de passe de l’archive portable', portable_confirm_placeholder: 'Répétez le mot de passe', portable_confirm_aria: 'Confirmer le mot de passe de l’archive portable', portable_create: 'Créer l’archive', portable_title: 'Exporter l’archive portable', portable_intro: 'Vous créez une copie lisible de vos données, utilisable également hors de cette app.', portable_warning: 'La copie peut contenir des données personnelles, des identifiants et des pièces jointes sensibles. Conservez-la en lieu sûr et ne la partagez pas avec des personnes non autorisées.', portable_include_attachments: 'Inclure les pièces jointes', portable_acknowledge: 'Je comprends que ce fichier n’est pas une sauvegarde restaurable.', portable_password_required: 'Saisissez un mot de passe dédié à l’archive.', portable_password_short: 'Utilisez au moins 14 caractères.', portable_password_long: 'Utilisez au maximum 256 caractères.', portable_password_common: 'Évitez les mots ou suites courants et choisissez un mot de passe unique.', portable_password_repetitive: 'Évitez les caractères ou motifs répétés.', portable_password_weak: 'Combinez au moins trois types parmi majuscules, minuscules, chiffres et symboles, ou utilisez une phrase d’au moins 24 caractères.', portable_password_strong: 'Mot de passe robuste.', portable_working_title: 'Création de l’archive portable…', portable_working_desc: 'Les données sont déchiffrées uniquement en mémoire, chiffrées par blocs et écrites progressivement.' },
  de: { portable_password_placeholder: 'Starkes Archivpasswort (mindestens 14 Zeichen)', portable_password_aria: 'Passwort des portablen Archivs', portable_confirm_placeholder: 'Passwort wiederholen', portable_confirm_aria: 'Passwort des portablen Archivs bestätigen', portable_create: 'Archiv erstellen', portable_title: 'Portables Archiv exportieren', portable_intro: 'Sie erstellen eine lesbare Kopie Ihrer Daten, die auch außerhalb dieser App verwendet werden kann.', portable_warning: 'Die Kopie kann persönliche Daten, Zugangsdaten und vertrauliche Anhänge enthalten. Bewahren Sie sie sicher auf und geben Sie sie nicht an Unbefugte weiter.', portable_include_attachments: 'Anhänge einschließen', portable_acknowledge: 'Ich verstehe, dass diese Datei kein wiederherstellbares Backup ist.', portable_password_required: 'Geben Sie ein eigenes Passwort für das Archiv ein.', portable_password_short: 'Verwenden Sie mindestens 14 Zeichen.', portable_password_long: 'Verwenden Sie höchstens 256 Zeichen.', portable_password_common: 'Vermeiden Sie gängige Wörter oder Folgen und wählen Sie ein eindeutiges Passwort.', portable_password_repetitive: 'Vermeiden Sie wiederholte Zeichen oder Muster.', portable_password_weak: 'Kombinieren Sie mindestens drei Typen aus Großbuchstaben, Kleinbuchstaben, Zahlen und Symbolen oder verwenden Sie einen Satz mit mindestens 24 Zeichen.', portable_password_strong: 'Starkes Passwort.', portable_working_title: 'Portables Archiv wird erstellt…', portable_working_desc: 'Daten werden nur im Arbeitsspeicher entschlüsselt, blockweise verschlüsselt und fortlaufend geschrieben.' },
  zh: { portable_password_placeholder: '高强度归档密码（至少 14 个字符）', portable_password_aria: '便携归档密码', portable_confirm_placeholder: '再次输入密码', portable_confirm_aria: '确认便携归档密码', portable_create: '创建归档', portable_title: '导出便携归档', portable_intro: '你正在创建一份可读的数据副本，也可在此应用之外使用。', portable_warning: '副本可能包含个人数据、凭据和敏感附件。请安全保存，不要与未经授权的人分享。', portable_include_attachments: '包含附件', portable_acknowledge: '我了解此文件不是可恢复的备份。', portable_password_required: '请输入归档专用密码。', portable_password_short: '至少使用 14 个字符。', portable_password_long: '最多使用 256 个字符。', portable_password_common: '请避免常见词语或序列，并选择唯一密码。', portable_password_repetitive: '请避免重复字符或模式。', portable_password_weak: '请在大写字母、小写字母、数字和符号中至少组合三类，或使用至少 24 个字符的短语。', portable_password_strong: '密码强度高。', portable_working_title: '正在创建便携归档…', portable_working_desc: '数据只在内存中解密，分块加密并逐步写入。' },
  hi: { portable_password_placeholder: 'मज़बूत संग्रह पासवर्ड (कम से कम 14 वर्ण)', portable_password_aria: 'पोर्टेबल संग्रह पासवर्ड', portable_confirm_placeholder: 'पासवर्ड दोहराएँ', portable_confirm_aria: 'पोर्टेबल संग्रह पासवर्ड की पुष्टि करें', portable_create: 'संग्रह बनाएँ', portable_title: 'पोर्टेबल संग्रह निर्यात करें', portable_intro: 'आप अपने डेटा की पढ़ी जा सकने वाली प्रति बना रहे हैं, जिसका उपयोग इस ऐप के बाहर भी हो सकता है।', portable_warning: 'प्रति में व्यक्तिगत डेटा, क्रेडेंशियल और संवेदनशील अटैचमेंट हो सकते हैं। इसे सुरक्षित रखें और अनधिकृत लोगों से साझा न करें।', portable_include_attachments: 'अटैचमेंट शामिल करें', portable_acknowledge: 'मैं समझता हूँ कि यह फ़ाइल पुनर्स्थापित की जा सकने वाली बैकअप नहीं है।', portable_password_required: 'संग्रह के लिए समर्पित पासवर्ड दर्ज करें।', portable_password_short: 'कम से कम 14 वर्ण उपयोग करें।', portable_password_long: 'अधिकतम 256 वर्ण उपयोग करें।', portable_password_common: 'सामान्य शब्दों या क्रमों से बचें और अनूठा पासवर्ड चुनें।', portable_password_repetitive: 'दोहराए गए वर्णों या पैटर्न से बचें।', portable_password_weak: 'बड़े अक्षर, छोटे अक्षर, अंक और चिह्नों में से कम से कम तीन प्रकार मिलाएँ, या कम से कम 24 वर्णों का वाक्यांश उपयोग करें।', portable_password_strong: 'मज़बूत पासवर्ड।', portable_working_title: 'पोर्टेबल संग्रह बनाया जा रहा है…', portable_working_desc: 'डेटा केवल मेमोरी में डिक्रिप्ट होता है, ब्लॉकों में एन्क्रिप्ट होकर क्रमशः लिखा जाता है।' },
  pt: { portable_password_placeholder: 'Palavra-passe forte do arquivo (pelo menos 14 caracteres)', portable_password_aria: 'Palavra-passe do arquivo portátil', portable_confirm_placeholder: 'Repita a palavra-passe', portable_confirm_aria: 'Confirmar palavra-passe do arquivo portátil', portable_create: 'Criar arquivo', portable_title: 'Exportar arquivo portátil', portable_intro: 'Está a criar uma cópia legível dos seus dados, que também pode ser utilizada fora desta app.', portable_warning: 'A cópia pode conter dados pessoais, credenciais e anexos sensíveis. Guarde-a em segurança e não a partilhe com pessoas não autorizadas.', portable_include_attachments: 'Incluir anexos', portable_acknowledge: 'Compreendo que este ficheiro não é uma cópia de segurança restaurável.', portable_password_required: 'Introduza uma palavra-passe dedicada para o arquivo.', portable_password_short: 'Use pelo menos 14 caracteres.', portable_password_long: 'Use no máximo 256 caracteres.', portable_password_common: 'Evite palavras ou sequências comuns e escolha uma palavra-passe única.', portable_password_repetitive: 'Evite caracteres ou padrões repetidos.', portable_password_weak: 'Combine pelo menos três tipos entre maiúsculas, minúsculas, números e símbolos, ou use uma frase com pelo menos 24 caracteres.', portable_password_strong: 'Palavra-passe forte.', portable_working_title: 'A criar arquivo portátil…', portable_working_desc: 'Os dados são decifrados apenas em memória, cifrados em blocos e escritos progressivamente.' }
};

const portableLarge = {
  it: {
    portable_large_note: 'Gli allegati a blocchi, compresi i video fino a 512 MiB, richiedono il salvataggio progressivo di un browser desktop compatibile.',
    portable_capacity_error: 'Un singolo allegato può occupare al massimo 512 MiB e gli allegati complessivi 1 GiB. Riduci i file oppure esporta senza allegati.',
    portable_inventory_error: 'Il manifest o i blocchi degli allegati non corrispondono alle schede. L’archivio è stato interrotto senza creare una copia parziale.',
    portable_decrypt_error: 'Un dato non è decifrabile: archivio interrotto senza creare una copia incompleta.',
    portable_attachment_decrypt_error: 'Un allegato o uno dei suoi blocchi non è autenticabile o decifrabile. L’archivio incompleto è stato eliminato.',
    portable_streaming_error: 'Questo browser non può salvare progressivamente un archivio di queste dimensioni. Usa un browser desktop Chromium oppure ripeti senza allegati.',
    portable_generic_error: 'Archivio non creato. Nessun dato è stato modificato.'
  },
  en: {
    portable_large_note: 'Chunked attachments, including videos up to 512 MiB, require progressive saving in a compatible desktop browser.',
    portable_capacity_error: 'One attachment may be at most 512 MiB and all attachments together 1 GiB. Reduce the files or export without attachments.',
    portable_inventory_error: 'The attachment manifest or chunks do not match the records. Export stopped without creating a partial archive.',
    portable_decrypt_error: 'A value cannot be decrypted. Export stopped without creating an incomplete archive.',
    portable_attachment_decrypt_error: 'An attachment or one of its chunks cannot be authenticated or decrypted. The incomplete archive was removed.',
    portable_streaming_error: 'This browser cannot progressively save an archive of this size. Use a desktop Chromium browser or export without attachments.',
    portable_generic_error: 'Archive not created. No data was changed.'
  },
  es: {
    portable_large_note: 'Los adjuntos por bloques, incluidos vídeos de hasta 512 MiB, requieren guardado progresivo en un navegador de escritorio compatible.',
    portable_capacity_error: 'Cada adjunto puede ocupar hasta 512 MiB y el total 1 GiB. Reduce los archivos o exporta sin adjuntos.',
    portable_inventory_error: 'El manifiesto o los bloques no coinciden con las fichas. La exportación se detuvo sin crear un archivo parcial.',
    portable_decrypt_error: 'Un dato no puede descifrarse. La exportación se detuvo sin crear una copia incompleta.',
    portable_attachment_decrypt_error: 'Un adjunto o uno de sus bloques no puede autenticarse o descifrarse. Se eliminó el archivo incompleto.',
    portable_streaming_error: 'Este navegador no puede guardar progresivamente un archivo de este tamaño. Usa Chromium de escritorio o exporta sin adjuntos.',
    portable_generic_error: 'No se creó el archivo. No se modificó ningún dato.'
  },
  fr: {
    portable_large_note: 'Les pièces jointes en blocs, dont les vidéos jusqu’à 512 Mio, nécessitent l’enregistrement progressif d’un navigateur de bureau compatible.',
    portable_capacity_error: 'Une pièce jointe peut atteindre 512 Mio et l’ensemble 1 Gio. Réduisez les fichiers ou exportez sans pièces jointes.',
    portable_inventory_error: 'Le manifeste ou les blocs ne correspondent pas aux fiches. L’export s’est arrêté sans archive partielle.',
    portable_decrypt_error: 'Une donnée ne peut pas être déchiffrée. L’export s’est arrêté sans copie incomplète.',
    portable_attachment_decrypt_error: 'Une pièce jointe ou un bloc ne peut pas être authentifié ou déchiffré. L’archive incomplète a été supprimée.',
    portable_streaming_error: 'Ce navigateur ne peut pas enregistrer progressivement une archive de cette taille. Utilisez Chromium sur ordinateur ou exportez sans pièces jointes.',
    portable_generic_error: 'Archive non créée. Aucune donnée n’a été modifiée.'
  },
  de: {
    portable_large_note: 'Blockweise Anhänge, einschließlich Videos bis 512 MiB, benötigen progressives Speichern in einem kompatiblen Desktop-Browser.',
    portable_capacity_error: 'Ein Anhang darf 512 MiB, alle Anhänge zusammen 1 GiB groß sein. Dateien verkleinern oder ohne Anhänge exportieren.',
    portable_inventory_error: 'Manifest oder Blöcke stimmen nicht mit den Einträgen überein. Der Export wurde ohne Teilarchiv beendet.',
    portable_decrypt_error: 'Ein Wert kann nicht entschlüsselt werden. Der Export wurde ohne unvollständige Kopie beendet.',
    portable_attachment_decrypt_error: 'Ein Anhang oder Block kann nicht authentifiziert oder entschlüsselt werden. Das unvollständige Archiv wurde entfernt.',
    portable_streaming_error: 'Dieser Browser kann ein Archiv dieser Größe nicht progressiv speichern. Desktop-Chromium verwenden oder ohne Anhänge exportieren.',
    portable_generic_error: 'Archiv nicht erstellt. Keine Daten wurden geändert.'
  },
  zh: {
    portable_large_note: '分块附件（包括最大 512 MiB 的视频）需要兼容的桌面浏览器进行渐进式保存。',
    portable_capacity_error: '单个附件最大 512 MiB，附件总计最大 1 GiB。请减少文件或不含附件导出。',
    portable_inventory_error: '附件清单或分块与记录不一致。导出已停止，未创建不完整归档。',
    portable_decrypt_error: '某项数据无法解密。导出已停止，未创建不完整副本。',
    portable_attachment_decrypt_error: '某个附件或分块无法验证或解密。不完整归档已删除。',
    portable_streaming_error: '此浏览器无法渐进式保存这么大的归档。请使用桌面 Chromium，或不含附件导出。',
    portable_generic_error: '未创建归档，未更改任何数据。'
  },
  hi: {
    portable_large_note: '512 MiB तक के वीडियो सहित ब्लॉक वाले अटैचमेंट के लिए संगत डेस्कटॉप ब्राउज़र में क्रमिक सहेजना आवश्यक है।',
    portable_capacity_error: 'एक अटैचमेंट अधिकतम 512 MiB और सभी अटैचमेंट कुल 1 GiB हो सकते हैं। फ़ाइलें घटाएँ या बिना अटैचमेंट निर्यात करें।',
    portable_inventory_error: 'अटैचमेंट मैनिफ़ेस्ट या ब्लॉक रिकॉर्ड से मेल नहीं खाते। अधूरा संग्रह बनाए बिना निर्यात रोक दिया गया।',
    portable_decrypt_error: 'एक डेटा मान डिक्रिप्ट नहीं हो सका। अधूरी प्रति बनाए बिना निर्यात रोक दिया गया।',
    portable_attachment_decrypt_error: 'एक अटैचमेंट या ब्लॉक प्रमाणित या डिक्रिप्ट नहीं हो सका। अधूरा संग्रह हटा दिया गया।',
    portable_streaming_error: 'यह ब्राउज़र इतने बड़े संग्रह को क्रमिक रूप से नहीं सहेज सकता। डेस्कटॉप Chromium उपयोग करें या बिना अटैचमेंट निर्यात करें।',
    portable_generic_error: 'संग्रह नहीं बना। कोई डेटा नहीं बदला गया।'
  },
  pt: {
    portable_large_note: 'Anexos em blocos, incluindo vídeos até 512 MiB, exigem gravação progressiva num navegador de computador compatível.',
    portable_capacity_error: 'Cada anexo pode ter até 512 MiB e o total 1 GiB. Reduza os ficheiros ou exporte sem anexos.',
    portable_inventory_error: 'O manifesto ou os blocos não correspondem aos registos. A exportação parou sem criar um arquivo parcial.',
    portable_decrypt_error: 'Um dado não pode ser decifrado. A exportação parou sem criar uma cópia incompleta.',
    portable_attachment_decrypt_error: 'Um anexo ou bloco não pode ser autenticado ou decifrado. O arquivo incompleto foi removido.',
    portable_streaming_error: 'Este navegador não consegue gravar progressivamente um arquivo deste tamanho. Use Chromium no computador ou exporte sem anexos.',
    portable_generic_error: 'Arquivo não criado. Nenhum dado foi alterado.'
  }
};

const supportDetails = {
  it: {
    settings_app_version_label: 'Versione',
    settings_privacy_summary: 'Consulta l’informativa completa per sapere come vengono trattati e protetti i dati personali.',
    settings_terms_summary: 'Consulta le condizioni complete che regolano l’utilizzo del servizio.'
  },
  en: {
    settings_app_version_label: 'Version',
    settings_privacy_summary: 'Read the full policy to learn how personal data is processed and protected.',
    settings_terms_summary: 'Read the full terms that govern use of the service.'
  },
  es: {
    settings_app_version_label: 'Versión',
    settings_privacy_summary: 'Consulta la política completa para saber cómo se tratan y protegen los datos personales.',
    settings_terms_summary: 'Consulta las condiciones completas que regulan el uso del servicio.'
  },
  fr: {
    settings_app_version_label: 'Version',
    settings_privacy_summary: 'Consultez la politique complète pour savoir comment les données personnelles sont traitées et protégées.',
    settings_terms_summary: 'Consultez les conditions complètes qui régissent l’utilisation du service.'
  },
  de: {
    settings_app_version_label: 'Version',
    settings_privacy_summary: 'Lesen Sie die vollständige Erklärung, um zu erfahren, wie personenbezogene Daten verarbeitet und geschützt werden.',
    settings_terms_summary: 'Lesen Sie die vollständigen Bedingungen für die Nutzung des Dienstes.'
  },
  zh: {
    settings_app_version_label: '版本',
    settings_privacy_summary: '请阅读完整政策，了解个人数据如何被处理和保护。',
    settings_terms_summary: '请阅读规范服务使用的完整条款。'
  },
  hi: {
    settings_app_version_label: 'संस्करण',
    settings_privacy_summary: 'व्यक्तिगत डेटा के संसाधन और संरक्षण की जानकारी के लिए पूरी नीति पढ़ें।',
    settings_terms_summary: 'सेवा के उपयोग को नियंत्रित करने वाले पूरे नियम पढ़ें।'
  },
  pt: {
    settings_app_version_label: 'Versão',
    settings_privacy_summary: 'Consulte a política completa para saber como os dados pessoais são tratados e protegidos.',
    settings_terms_summary: 'Consulte os termos completos que regulam a utilização do serviço.'
  }
};

export const settingsCatalogs = Object.fromEntries(Object.entries({ it, en, es, fr, de, zh, hi, pt })
  .map(([language, catalog]) => [language, {
    ...catalog,
    ...supportDetails[language],
    ...portable[language],
    ...portableLarge[language]
  }]));

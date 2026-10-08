import {signInWithEmailAndPassword} from 'firebase/auth';
import {createShellCommands} from './shell-commands.mjs';
import {httpsCallable} from 'firebase/functions';
import {mountPrivateQrEditor} from './private-qr-editor-provider.mjs';
import {mountCompanyQrEditor} from './company-qr-editor-provider.mjs';
import {mountProfileTextEditorProvider} from './profile-text-editor-provider.mjs';
import {mountProfileContactsEditorProvider} from './profile-contacts-editor-provider.mjs';
import {mountCompanyContactsEditorProvider} from './company-contacts-editor-provider.mjs';
import {mountPrivateAddressesEditorProvider} from './private-addresses-editor-provider.mjs';
import {mountCompanyAddressesEditorProvider} from './company-addresses-editor-provider.mjs';
import {mountPrivateDocumentsEditorProvider} from './private-documents-editor-provider.mjs';
import {createCompanySummaryReader} from './company-summary-reader.mjs';
import {mountCompanySummaryView} from './company-summary-view.mjs';
import {createCompanyPdfActions} from './company-summary-browser.mjs';
import {auth, db, functions, storage, requireEmulatorAppCheck} from './emulator-firebase.mjs';
import {createLocalPresentation} from './local-presentation.mjs';
import {createPrivateGatePresentation} from './private-gate-presentation.mjs';
import {createFirebaseAdmission} from './firebase-admission.mjs';
import {createFirebaseProfileDocumentAttachments} from './firebase-profile-document-attachments.mjs';
import {openEmulatorQueue} from './emulator-queue.mjs';
import {createFirebasePrivateNoteSource} from './firebase-private-note-source.mjs';
import {createPrivateNotePanelProvider} from './private-note-panel-provider.mjs';
import {createAccountNotePanelRouter} from './account-note-panel-router.mjs';
import {createProfileLinkOriginResolver} from './profile-link-origin.mjs';
import {mountProfileLinkEditor} from './profile-link-editor-provider.mjs';
import {createProfileAccountPickerReader} from './profile-account-picker-reader.mjs';
import {createAccountNoteQueueAccess} from './account-note-queue-access.mjs';
import {mountAccountStandardEditorProvider} from './account-standard-editor-provider.mjs';
import * as privateProfileModel from '../../Frontend/public/assets/js/modules/privato/profile-model.js';
import * as companyProfileModel from '../../Frontend/public/assets/js/modules/azienda/company-profile-model.js';
import {listPrivateAccounts, listPrivateAccountsConfirmed, listCompanyAccounts, listCompanyAccountsConfirmed} from '../../Frontend/public/assets/js/modules/data/vault-repository.js';
import {mountEmulatorList} from './emulator-list-view.mjs';
import {mountEmulatorDetail} from './emulator-detail-view.mjs';
import {createAccountDetailReader} from './account-detail-reader.mjs';
import {parseAccountDestination} from './account-route.mjs';
import {getPrivateAccount, getCompanyAccount, getPrivateAccountConfirmed, getCompanyAccountConfirmed} from '../../Frontend/public/assets/js/modules/data/vault-repository.js';
import * as cryptoApi from '../../Frontend/public/assets/js/modules/core/crypto-utils.js';
import {createFirebaseSession} from './firebase-session.mjs';
import {createProfileSectionReader} from './profile-section-reader.mjs';
import {createProfileOverviewReader} from './profile-overview-reader.mjs';
import {buildProfileOverview, resolvePrimary, validateProfileWidget} from '../../Frontend/public/assets/js/modules/privato/profile-model.js';
import {createProfileWidgetReader} from './profile-widget-reader.mjs';
import {mountProfileWidgetView} from './profile-widget-view.mjs';
import {listProfileWidgets, listProfileWidgetsConfirmed} from '../../Frontend/public/assets/js/modules/data/vault-repository.js';
import {getUserSetting, getUserSettingConfirmed} from '../../Frontend/public/assets/js/modules/data/vault-repository.js';
import {createPrivateDigitalCardReader} from './private-digital-card-reader.mjs';
import {createCompanyDigitalCardReader} from './company-digital-card-reader.mjs';
import {buildCompanyVCard} from '../../Frontend/public/assets/js/modules/azienda/company-vcard.js';
import {mountDigitalCardView} from './digital-card-view.mjs';
import {buildVCard, buildProfileQrPayload, ensureQRCodeLib, renderQRCode} from '../../Frontend/public/assets/js/modules/shared/qr_code_utils-v2.js';
import {mountProfileShell} from './profile-shell-view.mjs';
import {createProfileLinkedAccountReader} from './profile-linked-account.mjs';
import {createCompanyProfileSource} from './company-profile-source.mjs';
import {companyProfileContacts} from '../../Frontend/public/assets/js/modules/azienda/company-profile-model.js';
import {getCompany, getCompanyConfirmed} from '../../Frontend/public/assets/js/modules/data/vault-repository.js';
import {getUserProfile, getUserProfileConfirmed} from '../../Frontend/public/assets/js/modules/data/vault-repository.js';
import {requestMaster} from './master-prompt.mjs';
import {probeOfflineConsultation} from './offline-consultation-probe.mjs';
import {prepareOfflineData} from '../../Frontend/public/assets/js/offline-sync.js';
import {createShellOfflinePreparation} from './shell-offline-preparation.mjs';
import {createCompanyDirectoryReader, mountCompanyDirectory, validateCompanyId} from './company-directory.mjs';
import {listCompanies, listCompaniesConfirmed} from '../../Frontend/public/assets/js/modules/data/vault-repository.js';
import {readErrorMessage} from '../../Frontend/public/assets/js/modules/shared/read-error-message.js';
import {createAccountWidgetReader} from './account-widget-reader.mjs';
import {mountAccountWidgetView} from './account-widget-view.mjs';
import {createAccountWidgetEditorSource} from './account-widget-editor-source.mjs';
import {mountAccountWidgetEditor} from './account-widget-editor-view.mjs';
import {mountAccountWidgetCreate} from './account-widget-create-view.mjs';
import {createSharedWidgetEditorSource} from './shared-widget-editor-source.mjs';
import {createRestoreResumeSource} from './restore-resume-source.mjs';
import {mountRestoreResume} from './restore-resume-view.mjs';
import {createRestoreStageSource} from './restore-stage-source.mjs';
import {createRestoreStageUploadClient} from './restore-stage-upload-client.mjs';
import {createBankingEditSource} from './banking-edit-source.mjs';
import {mountBankingEditor} from './banking-edit-view.mjs';
import {createBankingLifecycleSource} from './banking-lifecycle-source.mjs';
import {mountBankingLifecycle} from './banking-lifecycle-view.mjs';
import {prepareEmbeddedAccountWidget, prepareSharedVaultData} from '../../Frontend/public/assets/js/modules/data/shared-vault-data-model.js';
import {createBankingReader} from './banking-reader.mjs';
import {mountBankingView} from './banking-view.mjs';
import {normalizeEditableBankingAccounts} from '../../Frontend/public/assets/js/modules/shared/banking-model.js';
import {listAccountWidgets, listAccountWidgetsConfirmed, listSharedVaultData, listSharedVaultDataConfirmed, listSharedVaultLinksConfirmed} from '../../Frontend/public/assets/js/modules/data/vault-repository.js';

const byId = id => document.getElementById(id);
const content = byId('content'), status = byId('status'), message = byId('message');
let selectedRoute = 'private', busy = false;
let selectedAccount = null, detailReturnRoute = 'private';
let selectedCompanyId = null;
let listStates = {};
let probeContext;
export const runOfflineConsultationProbe = (options = {}) => probeOfflineConsultation({context: probeContext, getUser: () => auth.currentUser, ...options});
const offlinePreparation = createShellOfflinePreparation({getUser: () => auth.currentUser, prepare: prepareOfflineData,
    onState(state) {
        byId('offline-status').dataset.state = state;
        byId('offline-status').textContent = {idle: '', preparing: 'Preparazione dei dati per uso offline…', ready: 'Dati testuali pronti per uso offline.', incomplete: 'Preparazione offline incompleta. Riconnettiti e riprova.', offline: 'Offline: puoi consultare i dati già scaricati.'}[state];
    }});
function refreshControls() {
    byId('login').disabled = busy || Boolean(auth.currentUser);
    byId('identity').disabled = busy || Boolean(auth.currentUser);
    byId('unlock').disabled = busy || !auth.currentUser;
    byId('logout').disabled = busy;
}
function showError(error) {
    const known = {INVALID_MASTER_PASSWORD: 'Master Password non corretta.', UNLOCK_CANCELLED: 'Sblocco annullato.', AUTH_REQUIRED: 'Accedi prima al laboratorio.'};
    message.textContent = known[error.message] || 'Operazione non riuscita. Verifica che gli emulatori siano attivi.';
}
function navigateList(domain) {
    selectedAccount = null; selectedRoute = domain;
    void session.navigate(domain);
}
function openDetail(destination) {
    try {
        selectedAccount = parseAccountDestination(destination, {uid: auth.currentUser?.uid, companyId: selectedCompanyId});
        detailReturnRoute = selectedAccount.domain; selectedRoute = 'detail'; void session.navigate('detail');
    } catch (error) { showError(error); }
}
const mount = context => { probeContext = context; const key = context.route === 'company' ? `company:${selectedCompanyId}` : context.route; return mountEmulatorList(content, context, {
    companyId: selectedCompanyId, state: listStates[key], onRemember: state => { listStates[key] = state; }, onOpen: openDetail
}); };
const mountCompanies = context => {
    probeContext = context;
    const open = (companyId, route) => { context.assertUnlocked(); if (context.signal.aborted) return; selectedCompanyId = validateCompanyId(context.user.uid, companyId); navigateList(route); };
    return mountCompanyDirectory(content, context, {
        readCompanies: createCompanyDirectoryReader({context, getUser: () => auth.currentUser, repository: {listCompanies, listCompaniesConfirmed}, isEncryptedValue: cryptoApi.isEncryptedValue}),
        onOpenProfile: id => open(id, 'companyProfile'), onOpenAccounts: id => open(id, 'company'), errorMessage: error => readErrorMessage(error, 'Elenco aziende non disponibile.')
    });
};
const mountDetail = context => {
    probeContext = context;
    if (!selectedAccount || !context.unlocked) { content.replaceChildren(); return; }
    const selection = selectedAccount;
    const openAccount = createAccountDetailReader({context, getUser: () => auth.currentUser,
        repository: {getPrivateAccount, getCompanyAccount, getPrivateAccountConfirmed, getCompanyAccountConfirmed}});
    const mountSavePanel = createPrivateNotePanelProvider({context, getUser: () => auth.currentUser,
        readSource: createFirebasePrivateNoteSource({auth, db}), deviceId: 'loopback-laboratory',
        openQueue: options => session.openMutationQueue(options)});
    const mountNotePanel = createAccountNotePanelRouter({context, getUser: () => auth.currentUser,
        openQueue: options => session.openMutationQueue(options), legacyProvider: mountSavePanel,
        repository: {getPrivateAccount, getCompanyAccount, getPrivateAccountConfirmed, getCompanyAccountConfirmed, getCompany, getCompanyConfirmed},
        isEncryptedValue: cryptoApi.isEncryptedValue,
        hash: async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join(''),
        submit: async request => {
            if (location.origin !== 'http://127.0.0.1:4188' || auth.app.options.projectId !== 'demo-vault-shell') throw Error('LOCAL_EMULATOR_ONLY');
            context.assertUnlocked(); if (context.signal.aborted || auth.currentUser?.uid !== context.user.uid) throw Error('VIEW_DISPOSED');
            return (await httpsCallable(functions, 'applyAccountNoteMutation')(request)).data;
        }});
    const widgetReader = createAccountWidgetReader({context, getUser: () => auth.currentUser, selection,
        repository: {getPrivateAccount, getCompanyAccount, getPrivateAccountConfirmed, getCompanyAccountConfirmed,
            listAccountWidgets, listAccountWidgetsConfirmed, listSharedVaultData, listSharedVaultDataConfirmed}});
    return mountEmulatorDetail(content, context, {selection, openAccount, mountNotePanel,
        mountAccountEditor: (root, {signal, onSaved, onCancel}) => {
            const scoped = {...context, signal}, getUser = () => auth.currentUser;
            return mountAccountStandardEditorProvider(root, scoped, {account: selection, getUser, onSaved, onCancel,
                repository: {getPrivateAccount, getCompanyAccount, getPrivateAccountConfirmed, getCompanyAccountConfirmed, getCompany, getCompanyConfirmed},
                isEncryptedValue: cryptoApi.isEncryptedValue,
                assertNoPendingMutation: async queueScope => (await createAccountNoteQueueAccess({context: scoped, getUser, account: queueScope.account,
                    openQueue: options => session.openMutationQueue(options)}).inspect()).status === 'clear',
                hash: async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join(''),
                submit: async request => {
                    if (location.origin !== 'http://127.0.0.1:4188' || auth.app.options.projectId !== 'demo-vault-shell') throw Error('LOCAL_EMULATOR_ONLY');
                    scoped.assertUnlocked(); if (signal.aborted || getUser()?.uid !== scoped.user.uid) throw Error('VIEW_DISPOSED');
                    return (await httpsCallable(functions, 'applyAccountStandardMutation')(request)).data;
                }});
        },
        mountWidgets: async root => {
            let editorCleanup, opening = false;
            const openWidgetEditor = async (widgetId, bankId) => {
                if (opening) return; opening = true;
                try {
                    editorCleanup?.();
                    const uid = context.user.uid;
                    const source = createAccountWidgetEditorSource({context, getUser: () => auth.currentUser,
                        account: {context: selection.domain, accountId: selection.id, ...(bankId ? {bankId} : {}), ...(selection.domain === 'company' ? {companyId: selection.companyId} : {})},
                        prepare: prepareEmbeddedAccountWidget, isEncryptedValue: cryptoApi.isEncryptedValue,
                        isOnline: () => navigator.onLine,
                        listConfirmed: () => listAccountWidgetsConfirmed(uid),
                        readAccount: () => selection.domain === 'private' ? getPrivateAccountConfirmed(uid, selection.id) : getCompanyAccountConfirmed(uid, selection.companyId, selection.id),
                        submit: async command => {
                            if (location.origin !== 'http://127.0.0.1:4188' || auth.app.options.projectId !== 'demo-vault-shell') throw Error('LOCAL_EMULATOR_ONLY');
                            return (await httpsCallable(functions, 'manageAccountWidget')(command)).data;
                        }});
                    editorCleanup = widgetId === undefined
                        ? mountAccountWidgetCreate(root, context, {source, onSaved: () => session.navigate('detail')})
                        : await mountAccountWidgetEditor(root, context, {source, widgetId, onSaved: () => session.navigate('detail')});
                } finally {opening = false;}
            };
            const editShared = async widgetId => {
                if (opening) return; opening = true;
                try {
                    editorCleanup?.(); const uid = context.user.uid;
                    const source = createSharedWidgetEditorSource({context, getUser: () => auth.currentUser,
                        account: {context: selection.domain, accountId: selection.id, ...(selection.domain === 'company' ? {companyId: selection.companyId} : {})},
                        readAccount: () => selection.domain === 'private' ? getPrivateAccountConfirmed(uid, selection.id) : getCompanyAccountConfirmed(uid, selection.companyId, selection.id),
                        listWidgets: () => listAccountWidgetsConfirmed(uid), listLinks: () => listSharedVaultLinksConfirmed(uid),
                        listShared: () => listSharedVaultDataConfirmed(uid), prepare: prepareSharedVaultData,
                        isEncryptedValue: cryptoApi.isEncryptedValue, isOnline: () => navigator.onLine,
                        submit: async command => {
                            if (location.origin !== 'http://127.0.0.1:4188' || auth.app.options.projectId !== 'demo-vault-shell') throw Error('LOCAL_EMULATOR_ONLY');
                            return (await httpsCallable(functions, 'manageSharedVaultData')(command)).data;
                        }});
                    editorCleanup = await mountAccountWidgetEditor(root, context, {source, widgetId,
                        notice: 'Salvare modifica la credenziale comune in tutti gli Account collegati. Scollegare rimuove solo il collegamento da questo Account, senza cancellare la credenziale comune.',
                        onSaved: () => session.navigate('detail')});
                } finally {opening = false;}
            };
            const generic = await mountAccountWidgetView(root, context, {onEdit: openWidgetEditor, onEditShared: editShared, onCreate: () => openWidgetEditor(), reader: {
                list: async () => (await widgetReader.list()).filter(widget => !widget.bankId), read: (...args) => widgetReader.read(...args)}});
            try {
                const banking = await mountBankingView(root, context, {widgetReader,
                    onLifecycle: typeof __EMULATOR_REAL_FUNCTIONS__ !== 'undefined' && __EMULATOR_REAL_FUNCTIONS__ ? undefined : async (action, target) => {
                        if (opening) return; opening = true;
                        try {
                            editorCleanup?.(); const uid = context.user.uid;
                            const source = createBankingLifecycleSource({context, getUser: () => auth.currentUser, account: selection,
                                assertCurrent: target.assertCurrent,
                                readRecord: () => selection.domain === 'private' ? getPrivateAccountConfirmed(uid, selection.id) : getCompanyAccountConfirmed(uid, selection.companyId, selection.id),
                                hash: async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join(''),
                                isEncryptedValue: cryptoApi.isEncryptedValue, isOnline: () => navigator.onLine,
                                submit: async data => (await httpsCallable(functions, 'applyBankingLifecycle')(data)).data});
                            editorCleanup = mountBankingLifecycle(root, context, {source, action, ...target, onSaved: () => session.navigate('detail')});
                        } finally {opening = false;}
                    },
                    onEditBank: typeof __EMULATOR_REAL_FUNCTIONS__ !== 'undefined' && __EMULATOR_REAL_FUNCTIONS__ ? undefined : async (bankId, cardIndex) => {
                        if (opening) return; opening = true;
                        try {
                            editorCleanup?.(); const uid = context.user.uid;
                            const source = createBankingEditSource({context, getUser: () => auth.currentUser, account: selection, bankId, cardIndex,
                                readRecord: () => selection.domain === 'private' ? getPrivateAccountConfirmed(uid, selection.id) : getCompanyAccountConfirmed(uid, selection.companyId, selection.id),
                                hash: async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join(''),
                                isEncryptedValue: cryptoApi.isEncryptedValue, isOnline: () => navigator.onLine,
                                submit: async data => (await httpsCallable(functions, 'applyBankingEdit')(data)).data});
                            editorCleanup = await mountBankingEditor(root, context, {source, onSaved: () => session.navigate('detail')});
                        } finally {opening = false;}
                    },
                    onEditWidget: openWidgetEditor, onCreateWidget: bankId => openWidgetEditor(undefined, bankId),
                    listBanks: createBankingReader({context, getUser: () => auth.currentUser, selection, normalize: normalizeEditableBankingAccounts,
                        isEncryptedValue: cryptoApi.isEncryptedValue, repository: {getPrivateAccount, getCompanyAccount, getPrivateAccountConfirmed, getCompanyAccountConfirmed}})});
                return () => {try {editorCleanup?.(); banking();} finally {generic();}};
            } catch (error) {editorCleanup?.(); generic(); throw error;}
        },
        backLabel: ['profile', 'companyProfile'].includes(detailReturnRoute) ? 'Torna al profilo' : 'Torna alla lista', onBack: () => navigateList(detailReturnRoute)});
};
const mountProfile = context => {
    probeContext = context;
    const company = context.route === 'companyProfile';
    const source = company ? createCompanyProfileSource({uid: context.user.uid, companyId: selectedCompanyId, repository: {getCompany, getCompanyConfirmed}, normalizeContacts: companyProfileContacts}) : undefined;
    const models = {...privateProfileModel, ...companyProfileModel};
    return mountProfileShell(content, context, {profileTitle: company ? 'Profilo aziendale' : 'Profilo utente', readSection: createProfileSectionReader({context, source,
        getUser: () => auth.currentUser, repository: {getUserProfile, getUserProfileConfirmed}, isEncryptedValue: cryptoApi.isEncryptedValue,
        resolveLinkOrigin: createProfileLinkOriginResolver({domain: company ? 'company' : 'private', companyId: source?.companyId, models})}),
        mountLinkEditor: (root, {signal, source: origin, mode, onSaved, onCancel}) => {
            const scoped = {...context, signal}, getUser = () => auth.currentUser;
            return mountProfileLinkEditor(root, scoped, {source: origin, models, mode, getUser, onSaved, onCancel,
                isEncryptedValue: cryptoApi.isEncryptedValue,
                readProfile: ({uid, confirmed}) => source ? source.read(uid, confirmed) : (confirmed ? getUserProfileConfirmed(uid) : getUserProfile(uid)),
                readAccounts: createProfileAccountPickerReader({context: scoped, getUser, isEncryptedValue: cryptoApi.isEncryptedValue,
                    repository: {listPrivateAccounts, listPrivateAccountsConfirmed, listCompanies, listCompaniesConfirmed, listCompanyAccounts, listCompanyAccountsConfirmed}}),
                assertNoPendingAccount: async account => (await createAccountNoteQueueAccess({context: scoped, getUser, account,
                    openQueue: options => session.openMutationQueue(options)}).inspect()).status === 'clear',
                hash: async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join(''),
                submit: async request => {
                    if (location.origin !== 'http://127.0.0.1:4188' || auth.app.options.projectId !== 'demo-vault-shell') throw Error('LOCAL_EMULATOR_ONLY');
                    scoped.assertUnlocked(); if (signal.aborted || getUser()?.uid !== scoped.user.uid) throw Error('VIEW_DISPOSED');
                    return (await httpsCallable(functions, 'applyProfileLinkMutation')(request)).data;
                }, submitCreate: async request => {
                    if (location.origin !== 'http://127.0.0.1:4188' || auth.app.options.projectId !== 'demo-vault-shell') throw Error('LOCAL_EMULATOR_ONLY');
                    scoped.assertUnlocked(); if (signal.aborted || getUser()?.uid !== scoped.user.uid) throw Error('VIEW_DISPOSED');
                    return (await httpsCallable(functions, 'applyProfileAccountCreate')(request)).data;
                }});
        },
        mountAnagraphicEditor: (root, {signal, onSaved, onCancel}) => {
            const scoped = {...context, signal};
            return mountProfileTextEditorProvider(root, scoped, {source, repository: {getUserProfile, getUserProfileConfirmed},
                getUser: () => auth.currentUser, isEncryptedValue: cryptoApi.isEncryptedValue, onSaved, onCancel,
                hash: async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join(''),
                submit: async request => {
                    if (location.origin !== 'http://127.0.0.1:4188' || auth.app.options.projectId !== 'demo-vault-shell') throw Error('LOCAL_EMULATOR_ONLY');
                    scoped.assertUnlocked(); if (scoped.signal.aborted || auth.currentUser?.uid !== scoped.user.uid) throw Error('VIEW_DISPOSED');
                    return (await httpsCallable(functions, 'applyProfileTextMutation')(request)).data;
                }});
        },
        mountContactsEditor: (root, {signal, onSaved, onCancel}) => {
            const scoped = {...context, signal}, getUser = () => auth.currentUser;
            const common = {getUser, isEncryptedValue: cryptoApi.isEncryptedValue, onSaved, onCancel,
                hash: async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join(''),
                submit: async request => {
                    if (location.origin !== 'http://127.0.0.1:4188' || auth.app.options.projectId !== 'demo-vault-shell') throw Error('LOCAL_EMULATOR_ONLY');
                    scoped.assertUnlocked(); if (signal.aborted || getUser()?.uid !== scoped.user.uid) throw Error('VIEW_DISPOSED');
                    return (await httpsCallable(functions, company ? 'applyCompanyContactsMutation' : 'applyProfileContactsMutation')(request)).data;
                }};
            // The company contacts editor writes the company schema only: e-mail
            // slots are emptied, telephone slots stay strings and a legacy row
            // without a stable identity is never targeted.
            return company ? mountCompanyContactsEditorProvider(root, scoped, {...common, source,
                createId: prefix => privateProfileModel.createProfileItemId(prefix)})
                : mountProfileContactsEditorProvider(root, scoped, {...common,
                    repository: {getUserProfile, getUserProfileConfirmed, getUserSetting, getUserSettingConfirmed},
                    createId: prefix => privateProfileModel.createProfileItemId(prefix)});
        },
        mountAddressesEditor: (root, {signal, onSaved, onCancel, onLink}) => {
            const scoped = {...context, signal}, getUser = () => auth.currentUser;
            const common = {getUser, onSaved, onCancel, isEncryptedValue: cryptoApi.isEncryptedValue,
                hash: async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join(''),
                submit: async request => {
                    if (location.origin !== 'http://127.0.0.1:4188' || auth.app.options.projectId !== 'demo-vault-shell') throw Error('LOCAL_EMULATOR_ONLY');
                    scoped.assertUnlocked(); if (signal.aborted || getUser()?.uid !== scoped.user.uid) throw Error('VIEW_DISPOSED');
                    return (await httpsCallable(functions, company ? 'applyCompanyAddressesMutation' : 'applyPrivateAddressesMutation')(request)).data;
                }};
            // The company addresses editor writes the legal seat and `altreSedi`
            // only; the private one writes `userAddresses` and leaves the nested
            // utilities untouched.
            return company ? mountCompanyAddressesEditorProvider(root, scoped, {...common, source,
                createId: prefix => privateProfileModel.createProfileItemId(prefix)})
                : mountPrivateAddressesEditorProvider(root, scoped, {...common,
                    repository: {getUserProfile, getUserProfileConfirmed, getUserSetting, getUserSettingConfirmed},
                    submitUtilities: async request => {
                        if (location.origin !== 'http://127.0.0.1:4188' || auth.app.options.projectId !== 'demo-vault-shell') throw Error('LOCAL_EMULATOR_ONLY');
                        scoped.assertUnlocked(); if (signal.aborted || getUser()?.uid !== scoped.user.uid) throw Error('VIEW_DISPOSED');
                        return (await httpsCallable(functions, 'applyPrivateUtilitiesMutation')(request)).data;
                    },
                    onUtilityLink: onLink,
                    createId: prefix => privateProfileModel.createProfileItemId(prefix)});
        },
        mountDocumentAttachments: company ? undefined : (root, {signal}) =>
            createFirebaseProfileDocumentAttachments({context: {...context, signal}, auth, db, storage, functions})(root, {signal}),
        mountDocumentsEditor: company ? undefined : (root, {signal, onSaved, onCancel, onLink}) => {
            const scoped = {...context, signal}, getUser = () => auth.currentUser;
            return mountPrivateDocumentsEditorProvider(root, scoped, {getUser, onSaved, onCancel, onLink,
                repository: {getUserProfile, getUserProfileConfirmed}, isEncryptedValue: cryptoApi.isEncryptedValue,
                createId: prefix => privateProfileModel.createProfileItemId(prefix),
                hash: async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join(''),
                submit: async request => {
                    if (location.origin !== 'http://127.0.0.1:4188' || auth.app.options.projectId !== 'demo-vault-shell') throw Error('LOCAL_EMULATOR_ONLY');
                    scoped.assertUnlocked(); if (signal.aborted || getUser()?.uid !== scoped.user.uid) throw Error('VIEW_DISPOSED');
                    return (await httpsCallable(functions, 'applyPrivateDocumentsMutation')(request)).data;
                }});
        },
        readOverview: createProfileOverviewReader({context, source, getUser: () => auth.currentUser,
            repository: {getUserProfile, getUserProfileConfirmed}, isEncryptedValue: cryptoApi.isEncryptedValue, buildProfileOverview, resolvePrimary}),
        mountCompanySummary: !company ? undefined : (root, {signal}) => {
            const scoped = {...context, signal};
            const actions = createCompanyPdfActions({assertActive() {scoped.assertUnlocked(); if (signal.aborted || auth.currentUser?.uid !== scoped.user.uid) throw Error('VIEW_DISPOSED');}});
            signal.addEventListener('abort', () => actions.dispose(), {once: true});
            const cleanup = mountCompanySummaryView(root, scoped, {...actions, read: createCompanySummaryReader({context: scoped,
                getUser: () => auth.currentUser, source, isEncryptedValue: cryptoApi.isEncryptedValue})});
            return () => {try {cleanup();} finally {actions.dispose();}};
        },
        mountWidgets: company ? undefined : (root, {section, signal}) => {
            const scoped = {...context, signal};
            return mountProfileWidgetView(root, scoped, {reader: createProfileWidgetReader({context: scoped, getUser: () => auth.currentUser,
                repository: {listProfileWidgets, listProfileWidgetsConfirmed}, tab: section, validateProfileWidget})});
        },
        mountDigitalCard: (root, {signal}) => {
            const scoped = {...context, signal};
            return mountDigitalCardView(root, scoped, {
                mountEditor: company ? target => mountCompanyQrEditor(target, scoped, {source, getUser: () => auth.currentUser,
                    submit: async request => {
                        if (location.origin !== 'http://127.0.0.1:4188' || auth.app.options.projectId !== 'demo-vault-shell') throw Error('LOCAL_EMULATOR_ONLY');
                        scoped.assertUnlocked(); if (scoped.signal.aborted || auth.currentUser?.uid !== scoped.user.uid) throw Error('VIEW_DISPOSED');
                        return (await httpsCallable(functions, 'applyCompanyQrSelection')(request)).data;
                    }}) : target => mountPrivateQrEditor(target, scoped, {
                    getUser: () => auth.currentUser, repository: {getUserProfile, getUserProfileConfirmed, getUserSetting, getUserSettingConfirmed},
                    isEncryptedValue: cryptoApi.isEncryptedValue, submit: async request => {
                        if (location.origin !== 'http://127.0.0.1:4188' || auth.app.options.projectId !== 'demo-vault-shell') throw Error('LOCAL_EMULATOR_ONLY');
                        scoped.assertUnlocked(); if (scoped.signal.aborted || auth.currentUser?.uid !== scoped.user.uid) throw Error('VIEW_DISPOSED');
                        return (await httpsCallable(functions, 'applyPrivateQrSelection')(request)).data;
                    }}),
                generate: company ? createCompanyDigitalCardReader({context: scoped, source, getUser: () => auth.currentUser,
                    isEncryptedValue: cryptoApi.isEncryptedValue, buildVCard: buildCompanyVCard}) : createPrivateDigitalCardReader({context: scoped, getUser: () => auth.currentUser,
                    repository: {getUserProfile, getUserProfileConfirmed, getUserSetting, getUserSettingConfirmed, listProfileWidgets, listProfileWidgetsConfirmed},
                    isEncryptedValue: cryptoApi.isEncryptedValue, buildVCard}),
                // The loopback lab has no public receiver. Photo-bearing QR
                // codes target the existing receiver; creating this fragment
                // performs no request, upload or publication.
                loadQr: ensureQRCodeLib, makePayload: card => company ? card : buildProfileQrPayload(card, 'https://appcodici-password.web.app'),
                renderQr: (target, payload) => renderQRCode(target, payload, {width: 220, height: 220}),
                download: async (card, check) => {
                    check(); const url = URL.createObjectURL(new Blob([card], {type: 'text/vcard;charset=utf-8'}));
                    const anchor = document.createElement('a');
                    try {check(); anchor.href = url; anchor.download = company ? 'contatto-azienda.vcf' : 'contatto.vcf'; anchor.click();}
                    finally {anchor.removeAttribute('href'); URL.revokeObjectURL(url);}
                }
            });
        },
        linkedAccounts: createProfileLinkedAccountReader({context, source, getUser: () => auth.currentUser,
            repository: {getUserProfile, getUserProfileConfirmed, getPrivateAccount, getCompanyAccount, getPrivateAccountConfirmed, getCompanyAccountConfirmed}}),
        onOpenAccount(selection) { context.assertUnlocked(); selectedAccount = selection; detailReturnRoute = context.route; selectedRoute = 'detail'; void session.navigate('detail'); }});
};
const usePrivateGate = new URL(location.href).searchParams.get('privateGate') === '1';
let session, activationEpoch = 0, gateAttempted = false;
const mountResume = context => {
    content.replaceChildren();
    if (typeof __EMULATOR_REAL_FUNCTIONS__ !== 'undefined' && __EMULATOR_REAL_FUNCTIONS__) {
        const notice = document.createElement('p');
        notice.textContent = 'Ripresa M8 disponibile solo sul bridge del laboratorio isolato, non sulle Functions5001. Nessuna richiesta inviata.';
        content.append(notice); return () => notice.remove();
    }
    const isActive = () => {
        try {context.assertUnlocked(); return !context.signal.aborted && auth.currentUser?.uid === context.user.uid;}
        catch {return false;}
    };
    const attachmentPreparer = createRestoreStageSource({uid: context.user.uid, isActive, signal: context.signal,
        submit: async data => (await httpsCallable(functions, 'manageRestoreStage')(data)).data,
        upload: createRestoreStageUploadClient({endpoint: `${location.origin}/restore-stage/upload`, origin: location.origin,
            fetchImpl: fetch, isActive, signal: context.signal,
            getCredentials: async () => ({idToken: await auth.currentUser.getIdToken(), appCheckToken: 'synthetic-app-check'})})});
    const source = createRestoreResumeSource({context, attachmentPreparer, getUser: () => auth.currentUser,
        isOnline: () => navigator.onLine, submit: async data => (await httpsCallable(functions, 'manageRestoreResume')(data)).data});
    return mountRestoreResume(content, context, {source});
};
function createSession(presentation) {
const admission = createFirebaseAdmission({auth, db, presentationGate: presentation,
    isOnline: () => navigator.onLine, enableAppCheck: requireEmulatorAppCheck, requiredPolicyVersion: 1});
return createFirebaseSession({auth, db, cryptoApi, presentation, admission,
    getTicket: presentation.getTicket, isTicketActive: presentation.active,
    createQueueClient: scope => openEmulatorQueue({auth, functions, ...scope}),
    requestPassword: options => requestMaster(byId('master-dialog'), options),
    routes: {overview: mount, private: mount, company: mount, detail: mountDetail, profile: mountProfile, companyProfile: mountProfile, companies: mountCompanies, resume: mountResume},
    onState({state}) {
        if (state === 'unlocked') void offlinePreparation.refresh();
        else offlinePreparation.clear();
        status.textContent = state === 'unlocked' ? 'Vault sbloccato' : state === 'locked' ? 'Accesso effettuato · Vault bloccato' : 'Accesso non effettuato';
        if (state !== 'unlocked') {
            probeContext = null;
            content.replaceChildren(); listStates = {};
            if (selectedRoute === 'detail') selectedRoute = selectedAccount?.domain || 'private';
            selectedAccount = null;
            selectedCompanyId = null;
            if (['company', 'companyProfile'].includes(selectedRoute)) selectedRoute = 'companies';
        }
        refreshControls();
    }, onError: showError
});
}
session = createSession(createLocalPresentation({origin: location.origin, getUser: () => auth.currentUser}));
async function activatePrivateGate() {
    if (gateAttempted) throw new Error('GATE_RELOAD_REQUIRED');
    gateAttempted = true;
    const mine = ++activationEpoch, uid = auth.currentUser?.uid;
    session.dispose();
    try {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/assets/js/private-auth-gate.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('PRIVATE_GATE_LOAD_FAILED'));
            document.head.append(script);
        });
        if (mine !== activationEpoch || !uid || auth.currentUser?.uid !== uid) throw new Error('AUTH_CHANGED');
        session = createSession(createPrivateGatePresentation({gate: window.privateAuthGate, getUser: () => auth.currentUser}));
        await session.navigate(selectedRoute);
    } catch (error) {
        try {session.dispose();} finally {window.privateAuthGate?.reject();}
        throw error;
    }
}
window.addEventListener('pagehide', () => {activationEpoch++;});
const commandSession = {
    navigate: (...args) => session.navigate(...args),
    unlock: (...args) => session.unlock(...args),
    lock() {activationEpoch++; return session.lock();},
    async logout() {
        activationEpoch++;
        try {return await session.logout();}
        finally {
            if (usePrivateGate && gateAttempted) {
                try {shellCommands.dispose();} finally {try {session.dispose();} finally {location.reload();}}
            }
        }
    }
};
const shellCommands = createShellCommands({
    session: commandSession,
    signIn: async () => {
        const mine = activationEpoch;
        await signInWithEmailAndPassword(auth, `${byId('identity').value}@example.invalid`, 'LOGIN-SOLO-EMULATORE!123');
        if (mine !== activationEpoch) throw new Error('AUTH_CHANGED');
        if (usePrivateGate) await activatePrivateGate();
    },
    getSelectedRoute: () => selectedRoute,
    navigateList,
    controls: Object.fromEntries(['login', 'unlock', 'lock', 'logout', 'private', 'profile', 'companies', 'resume'].map(name => [name, byId(name)])),
    setBusy: value => {busy = value;},
    clearMessage: () => {message.textContent = '';},
    showError, refreshControls
});
// Only detaches these command listeners; session lifecycle remains separately owned.
export const disposeShellCommands = () => shellCommands.dispose();
// Activity, background/bfcache locking and expiry checks are owned and disposed
// by the Firebase session boundary, not by this laboratory entry point.
refreshControls();

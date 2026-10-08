import {createAccountNoteHandler} from '../experiments/persistent-vault-shell/account-note-handler.mjs';
import {createAccountStandardHandler} from '../experiments/persistent-vault-shell/account-standard-handler.mjs';
import {createProfileLinkHandler} from '../experiments/persistent-vault-shell/profile-link-handler.mjs';
import {createProfileAccountCreateHandler} from '../experiments/persistent-vault-shell/profile-account-create-handler.mjs';
import {createProfileTextHandler} from '../experiments/persistent-vault-shell/profile-text-handler.mjs';
import {createPrivateQrSelectionHandler} from '../experiments/persistent-vault-shell/qr-selection-handler.mjs';
import {createCompanyQrSelectionHandler} from '../experiments/persistent-vault-shell/company-qr-selection-handler.mjs';
import {createPrivateDocumentsHandler} from '../experiments/persistent-vault-shell/private-documents-handler.mjs';
import {createPrivateUtilitiesHandler} from '../experiments/persistent-vault-shell/private-utilities-handler.mjs';
import {createProfileContactsHandler} from '../experiments/persistent-vault-shell/profile-contacts-handler.mjs';
import {createPrivateAddressesHandler} from '../experiments/persistent-vault-shell/private-addresses-handler.mjs';
import {createCompanyAddressesHandler} from '../experiments/persistent-vault-shell/company-addresses-handler.mjs';
import {createCompanyContactsHandler} from '../experiments/persistent-vault-shell/company-contacts-handler.mjs';
import {profileAccountItems, findProfileAccountItem, patchProfileAccountItem, profileAccountReferences} from '../Frontend/public/assets/js/modules/privato/profile-model.js';
import {companyProfileContacts, findCompanyProfileContact, companyContactLinkPatch, companyAccountReferences} from '../Frontend/public/assets/js/modules/azienda/company-profile-model.js';

// Build-time source only. The deployable bundle contains its complete dependency
// closure; it never imports the emulator bridge or accepts its synthetic header.
const reasons = new Set(['OWNER_MISMATCH', 'OPERATION_CONFLICT', 'ACCOUNT_UNAVAILABLE',
    'COMPANY_UNAVAILABLE', 'REVISION_CONFLICT', 'NOTE_CONFLICT', 'ACCOUNT_STANDARD_CONFLICT',
    'ACCOUNT_NOTE_INVALID', 'ACCOUNT_STANDARD_INVALID', 'ACCOUNT_STANDARD_REQUEST_INVALID',
    'ACCOUNT_STANDARD_RELATION_INVALID', 'PROFILE_LINK_INVALID', 'PROFILE_TEXT_INVALID',
    'PROFILE_UNAVAILABLE', 'LINK_CONFLICT', 'PROFILE_LINK_UNCHANGED', 'PROFILE_LINK_SOURCE_UNSUPPORTED',
    'PROFILE_ACCOUNT_CREATE_INVALID', 'ACCOUNT_EXISTS', 'LEGACY_PASSWORD_CHANGED', 'FIELD_CONFLICT',
    'INVALID_ARGUMENT', 'UNSUPPORTED_SETTING', 'COMPANY_QR_SELECTION_INVALID', 'QR_SELECTION_INVALID',
    'PROFILE_DOCUMENTS_INVALID', 'PROFILE_DOCUMENTS_SHAPE_INVALID', 'DOCUMENT_EXISTS', 'DOCUMENT_AMBIGUOUS',
    'DOCUMENT_MISSING', 'DOCUMENT_CONFLICT', 'DOCUMENT_ID_UNSTABLE', 'DOCUMENT_DEPENDENCIES_UNVERIFIABLE',
    'PROFILE_DOCUMENT_LINKED', 'PROFILE_DOCUMENT_QR_SELECTED', 'PROFILE_DOCUMENT_HAS_ATTACHMENTS',
    'PROFILE_UTILITIES_INVALID', 'PROFILE_UTILITIES_SHAPE_INVALID', 'UTILITY_PARENT_AMBIGUOUS', 'UTILITY_PARENT_MISSING',
    'UTILITIES_EXISTS', 'UTILITIES_AMBIGUOUS', 'UTILITIES_MISSING', 'UTILITIES_CONFLICT', 'PROFILE_UTILITY_LINKED',
    'UTILITY_ID_MISSING', 'UTILITY_ID_DERIVED', 'PROFILE_CONTACTS_INVALID', 'PROFILE_CONTACTS_UNAVAILABLE',
    'CONTACTS_QR_UNVERIFIABLE', 'CONTACTS_EXISTS', 'CONTACTS_AMBIGUOUS', 'CONTACTS_MISSING',
    'CONTACTS_CONFLICT', 'CONTACTS_LINKED', 'CONTACTS_QR_SELECTED', 'CONTACTS_QR_INDEXED',
    'PROFILE_ADDRESSES_INVALID', 'PROFILE_ADDRESSES_SHAPE_INVALID', 'PROFILE_ADDRESSES_UNVERIFIABLE',
    'PROFILE_ADDRESS_UTILITIES_PRESENT', 'PROFILE_ADDRESS_LINKED', 'PROFILE_ADDRESS_QR_SELECTED',
    'ADDRESS_ID_MISSING', 'ADDRESS_ID_DERIVED', 'ADDRESSES_QR_UNVERIFIABLE', 'ADDRESSES_EXISTS',
    'ADDRESSES_AMBIGUOUS', 'ADDRESSES_MISSING', 'ADDRESSES_CONFLICT', 'ADDRESSES_QR_INDEXED',
    'COMPANY_ADDRESSES_INVALID', 'COMPANY_ADDRESSES_SHAPE_INVALID', 'COMPANY_ADDRESSES_UNAVAILABLE',
    'COMPANY_ADDRESSES_QR_UNVERIFIABLE', 'COMPANY_ADDRESSES_CONFLICT', 'COMPANY_ADDRESSES_EXISTS',
    'COMPANY_ADDRESSES_AMBIGUOUS', 'COMPANY_ADDRESSES_MISSING', 'COMPANY_ADDRESS_ID_MISSING',
    'COMPANY_ADDRESS_ID_DERIVED', 'COMPANY_ADDRESS_QR_SELECTED', 'COMPANY_CONTACTS_INVALID',
    'COMPANY_CONTACTS_UNAVAILABLE', 'COMPANY_CONTACTS_SHAPE_INVALID', 'COMPANY_CONTACTS_QR_UNVERIFIABLE',
    'COMPANY_CONTACTS_CONFLICT', 'COMPANY_CONTACTS_EXISTS', 'COMPANY_CONTACTS_AMBIGUOUS',
    'COMPANY_CONTACTS_MISSING', 'COMPANY_CONTACTS_LINKED', 'COMPANY_CONTACTS_QR_SELECTED',
    'COMPANY_CONTACTS_LEGACY_FALLBACK', 'COMPANY_CONTACT_ID_MISSING', 'COMPANY_CONTACT_ID_DERIVED']);

export function createVaultAccountCallables({db, hash, timestamp, deleteField, HttpsError}) {
    const wrap = handler => async request => {
        if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Accesso richiesto.');
        if (typeof request.app?.appId !== 'string' || !request.app.appId) {
            throw new HttpsError('failed-precondition', 'Verifica applicazione richiesta.', {reason: 'APP_CHECK_REQUIRED'});
        }
        // Identity and attestation are from the callable middleware, never data.
        try { return await handler(request.data, {auth: request.auth, app: request.app}); }
        catch (error) {
            if (reasons.has(error.message)) {
                throw new HttpsError('failed-precondition', 'Modifica non applicata. Riapri il record e verifica i dati.',
                    {reason: error.message});
            }
            // Database/SDK errors can contain paths or payloads. Do not return or
            // log them. Retrying must keep operationId and the original request.
            throw new HttpsError('internal', 'Esito non verificato. Riprova la stessa operazione.');
        }
    };
    const dependencies = {db, hash, timestamp};
    const profileDependencies = {...dependencies, deleteField, models: {
        profileAccountItems, findProfileAccountItem, patchProfileAccountItem, profileAccountReferences,
        companyProfileContacts, findCompanyProfileContact, companyContactLinkPatch, companyAccountReferences
    }};
    return {
        note: wrap(createAccountNoteHandler(dependencies)),
        standard: wrap(createAccountStandardHandler(dependencies)),
        link: wrap(createProfileLinkHandler(profileDependencies)),
        create: wrap(createProfileAccountCreateHandler(profileDependencies)),
        text: wrap(createProfileTextHandler(dependencies)),
        privateQr: wrap(createPrivateQrSelectionHandler(dependencies)),
        companyQr: wrap(createCompanyQrSelectionHandler(dependencies)),
        documents: wrap(createPrivateDocumentsHandler(dependencies)),
        utilities: wrap(createPrivateUtilitiesHandler(dependencies)),
        contacts: wrap(createProfileContactsHandler(dependencies)),
        privateAddresses: wrap(createPrivateAddressesHandler(dependencies)),
        companyAddresses: wrap(createCompanyAddressesHandler(dependencies)),
        companyContacts: wrap(createCompanyContactsHandler(dependencies))
    };
}

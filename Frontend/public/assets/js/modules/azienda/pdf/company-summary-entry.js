import {auth} from '../../../firebase-config.js?v=1.2.128';
import {onAuthStateChanged} from '/assets/js/vendor/firebase-runtime.js';
import {ensureVaultKeyMaterial, isVaultUnlocked} from '../../core/security-manager.js';
import {getVaultSessionExpiry} from '../../core/vault-session.js';
import {decryptRequiredValue, isEncryptedValue} from '../../core/crypto-utils.js';
import {getCompany, getCompanyConfirmed} from '../../data/vault-repository.js';
import {mountCompanyPdfPanel} from './company-summary-panel.js';

export function mountCompanySummary(root, companyId) {
    return mountCompanyPdfPanel(root, companyId, {
        getUser: () => auth.currentUser,
        subscribeAuth: callback => onAuthStateChanged(auth, callback),
        ensureUnlocked: async () => {await ensureVaultKeyMaterial();},
        isUnlocked: () => isVaultUnlocked() && (!getVaultSessionExpiry() || Date.now() < getVaultSessionExpiry()),
        readCompany: (uid, id, confirmed) => (confirmed ? getCompanyConfirmed : getCompany)(uid, id),
        decryptValue: async value => decryptRequiredValue(value, await ensureVaultKeyMaterial()),
        isEncryptedValue
    });
}

import {collection, doc, getDocFromServer, getDocsFromServer, limit, query} from 'firebase/firestore';
import {createPrivateNoteSourceReader} from './private-note-source.mjs';

export function createFirebasePrivateNoteSource({auth, db}) {
    if (!auth?.app || auth.app !== db?.app) throw new Error('NOTE_SOURCE_FIREBASE_APP');
    return createPrivateNoteSourceReader({getUser: () => auth.currentUser,
        readAccount: ({uid, recordId}) => getDocFromServer(doc(db, 'users', uid, 'accounts', recordId)),
        readProfile: ({uid}) => getDocFromServer(doc(db, 'users', uid)),
        // Fetch one extra document to detect overflow instead of treating a
        // bounded prefix as the complete list. No active/archive filtering.
        readCompanies: ({uid}) => getDocsFromServer(query(collection(db, 'users', uid, 'aziende'), limit(201)))});
}

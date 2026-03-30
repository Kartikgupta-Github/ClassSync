import { initializeApp } from 'firebase/app';
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    signOut,
    fetchSignInMethodsForEmail,
    onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    onSnapshot,
    arrayUnion,
    arrayRemove,
    updateDoc,
    deleteDoc,
} from 'firebase/firestore';
import { getColor } from '../types';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// ── Firestore / Group helpers ──

// Helper to prevent infinite hangs if Firebase is unreachable
const withTimeout = <T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(errorMsg)), ms);
        promise.then(
            (res) => { clearTimeout(timer); resolve(res); },
            (err) => { clearTimeout(timer); reject(err); }
        );
    });
};

export async function checkGroupExists(groupCode: string): Promise<boolean> {
    const docRef = doc(db, 'groups', groupCode.toUpperCase());
    try {
        const docSnap = await withTimeout(getDoc(docRef), 5000, 'Firestore timeout: Could not reach database.');
        return docSnap.exists();
    } catch (e) {
        console.error("checkGroupExists error:", e);
        throw e;
    }
}

export async function joinGroupOnServer(groupCode: string, name: string, account: any): Promise<boolean> {
    const docRef = doc(db, 'groups', groupCode.toUpperCase());
    try {
        const docSnap = await withTimeout(getDoc(docRef), 5000, 'Firestore timeout: Could not reach database.');
        if (!docSnap.exists()) return false;

        const data = docSnap.data();
        const members = data.members || [];
        const accounts = data.accounts || [];

        let memberIdx = members.findIndex((m: any) => m.name.toLowerCase() === name.toLowerCase());
        if (memberIdx === -1) {
            const color = getColor(members.length);
            members.push({ name, color });
            memberIdx = members.length - 1;
        }

        const acct = { ...account, memberIdx, role: 'member' };
        const acctIdx = accounts.findIndex((a: any) => a.id === account.id);
        if (acctIdx >= 0) {
            accounts[acctIdx] = acct;
        } else {
            accounts.push(acct);
        }

        // Merge selectively to prevent wiping out tasks array
        await setDoc(docRef, { members, accounts }, { merge: true });
        return true;
    } catch (e) {
        console.error("joinGroupOnServer error:", e);
        throw e;
    }
}

export function generateGroupCode(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    let code = '';

    // Add 4 random letters
    for (let i = 0; i < 4; i++) code += letters.charAt(Math.floor(Math.random() * letters.length));
    // Add 2 random numbers
    for (let i = 0; i < 2; i++) code += numbers.charAt(Math.floor(Math.random() * numbers.length));

    // Shuffle the code
    return code.split('').sort(() => Math.random() - 0.5).join('');
}

export async function saveUserGroup(uid: string, groupCode: string | null, mode: 'group' | 'solo' | null) {
    const userRef = doc(db, 'users', uid);
    const updateData: any = { lastGroupCode: groupCode, mode };
    
    // Only append to history if it's a valid group code
    if (groupCode && mode === 'group') {
        updateData.joinedGroups = arrayUnion(groupCode);
    }
    
    await setDoc(userRef, updateData, { merge: true });
}

export async function getUserData(uid: string) {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    return snap.exists() ? snap.data() : null;
}

export function syncGroupData(groupCode: string, callback: (data: any) => void) {
    const docRef = doc(db, 'groups', groupCode.toUpperCase());
    return onSnapshot(docRef, (doc) => {
        if (doc.exists()) callback(doc.data());
    });
}

export async function updateGroupState(groupCode: string, state: any) {
    const docRef = doc(db, 'groups', groupCode.toUpperCase());
    await setDoc(docRef, state, { merge: true });
}

export async function leaveGroupOnServer(uid: string, groupCode: string) {
    try {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, { joinedGroups: arrayRemove(groupCode.toUpperCase()) });

        const docRef = doc(db, 'groups', groupCode.toUpperCase());
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const accounts = (data.accounts || []).filter((a: any) => a.id !== uid);
            await updateDoc(docRef, { accounts });
        }
    } catch (e) {
        console.error("leaveGroupOnServer error:", e);
        throw e;
    }
}

export async function deleteGroupOnServer(groupCode: string) {
    try {
        const docRef = doc(db, 'groups', groupCode.toUpperCase());
        await deleteDoc(docRef);
    } catch (e) {
        console.error("deleteGroupOnServer error:", e);
        throw e;
    }
}

// ── Storage helpers ──

export async function uploadTaskFile(file: File) {
    const timestamp = Date.now();
    const uniqueName = `${timestamp}_${file.name.replace(/\s+/g, '_')}`;
    const storageRef = ref(storage, `tasks/${uniqueName}`);

    try {
        await withTimeout(uploadBytes(storageRef, file), 10000, 'Storage timeout: Upload took too long.');
        const url = await withTimeout(getDownloadURL(storageRef), 5000, 'Storage timeout: Could not get URL.');
        return { name: file.name, url, size: file.size, type: file.type };
    } catch (e) {
        console.error("uploadTaskFile error:", e);
        throw e;
    }
}

// ── Auth helpers ──

export async function signUpWithEmail(email: string, password: string) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(result.user);
    return result.user;
}

export async function signInWithEmail(email: string, password: string) {
    return (await signInWithEmailAndPassword(auth, email, password)).user;
}

export async function signInWithGoogle() {
    return (await signInWithPopup(auth, googleProvider)).user;
}

export async function sendVerificationEmail(user: User) {
    await sendEmailVerification(user);
}

export async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
}

export async function checkEmailExists(email: string): Promise<boolean> {
    try {
        const methods = await fetchSignInMethodsForEmail(auth, email);
        return methods.length > 0;
    } catch {
        return false;
    }
}

export async function logOut() {
    await signOut(auth);
}


// ── Listener ──
export function onAuthChange(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
}

// ── Error translator ──
export function getAuthErrorMessage(code: string): string {
    switch (code) {
        case 'auth/user-not-found':
            return 'No account found with this email. Please sign up first.';
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Incorrect password. Please try again.';
        case 'auth/email-already-in-use':
            return 'This email is already registered. Try signing in instead.';
        case 'auth/weak-password':
            return 'Password is too weak. Use at least 6 characters.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please wait a few minutes and try again.';
        case 'auth/popup-closed-by-user':
            return 'Google sign-in was cancelled. Try again.';
        case 'auth/popup-blocked':
            return 'Popup was blocked by your browser. Allow popups and try again.';
        case 'auth/invalid-phone-number':
            return 'Enter a valid phone number with country code (e.g. +91...).';
        case 'auth/invalid-verification-code':
            return 'Incorrect OTP code. Please check and try again.';
        case 'auth/code-expired':
            return 'OTP code has expired. Request a new one.';
        case 'auth/account-exists-with-different-credential':
            return 'An account already exists with this email using a different sign-in method.';
        case 'auth/network-request-failed':
            return 'Network error. Check your internet connection.';
        default:
            return 'Something went wrong. Please try again.';
    }
}

export type { User };

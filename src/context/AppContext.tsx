import React, { createContext, useContext, useReducer, useEffect, ReactNode, useRef } from 'react';
import type { AppState, Task, Comment, UserAccount, Role, Permission } from '../types';
import { getColor, DEFAULT_PERMISSIONS } from '../types';
import { syncGroupData, updateGroupState, saveUserGroup } from '../lib/firebase';

type Action =
    // App Lifecycle
    | { type: 'LOAD_STATE'; state: AppState }
    | { type: 'SYNC_GROUP'; data: Partial<AppState> }
    | { type: 'REGISTER'; account: UserAccount }
    | { type: 'LOGIN'; userId: string }
    | { type: 'FIREBASE_LOGIN'; userId: string; email: string; displayName: string; lastGroupCode?: string | null; mode?: 'group' | 'solo' | null; joinedGroups?: string[] }
    | { type: 'LOGOUT' }
    // Group / Solo
    | { type: 'JOIN_GROUP'; name: string; code: string; userId: string; isCreator?: boolean; groupName?: string }
    | { type: 'SET_SOLO'; name: string; userId: string }
    | { type: 'LEAVE_GROUP' }
    // Tasks
    | { type: 'ADD_TASK'; task: Task }
    | { type: 'DELETE_TASK'; taskId: number }
    | { type: 'TOGGLE_STEP'; taskId: number; stepIdx: number }
    | { type: 'ADD_COMMENT'; taskId: number; text: string }
    | { type: 'SET_PROOF'; taskId: number; url: string }
    // Profile
    | { type: 'SET_PROFILE'; profile: AppState['profile'] }
    // RBAC
    | { type: 'SET_ROLE'; userId: string; role: Role }
    | { type: 'UPDATE_PERMISSIONS'; role: Role; permissions: Permission[] }
    | { type: 'REMOVE_MEMBER'; memberIdx: number }
    | { type: 'SELF_HEAL_JOIN'; newMember: any; newAccount: any };

const initialState: AppState = {
    user: null,
    group: null,
    members: [],
    tasks: [],
    currentUser: null,
    mode: null,
    onboarded: false,
    profile: null,
    accounts: [],
    loggedInUserId: null,
    rolePermissions: { ...DEFAULT_PERMISSIONS },
    joinedGroups: [],
};

function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case 'LOAD_STATE':
            return { ...initialState, ...action.state };

        case 'SYNC_GROUP': {
            const syncedAccounts = action.data.accounts || state.accounts;
            const myAccount = syncedAccounts.find((a: any) => a.id === state.loggedInUserId);
            const currentUser = myAccount && myAccount.memberIdx >= 0 ? myAccount.memberIdx : state.currentUser;

            return {
                ...state,
                ...action.data,
                loggedInUserId: state.loggedInUserId,
                currentUser: currentUser,
            };
        }

        case 'REGISTER':
            return { ...state, accounts: [...state.accounts, action.account] };

        case 'LOGIN':
            return { ...state, loggedInUserId: action.userId };

        case 'FIREBASE_LOGIN': {
            let account = state.accounts.find(a => a.id === action.userId);
            const baseState = {
                ...state,
                loggedInUserId: action.userId,
                group: action.lastGroupCode || state.group,
                mode: action.mode || state.mode,
                joinedGroups: action.joinedGroups || state.joinedGroups,
                onboarded: !!action.lastGroupCode || state.mode === 'solo' || state.onboarded,
            };

            if (!account) {
                account = {
                    id: action.userId,
                    email: action.email,
                    passwordHash: '',
                    displayName: action.displayName,
                    role: 'member' as Role,
                    memberIdx: -1,
                    createdAt: Date.now(),
                };
                return { ...baseState, accounts: [...state.accounts, account], user: action.displayName };
            }

            return {
                ...baseState,
                currentUser: account.memberIdx >= 0 ? account.memberIdx : state.currentUser,
                user: account.displayName
            };
        }

        case 'LOGOUT':
            return { ...initialState };

        case 'JOIN_GROUP': {
            const members = [...state.members];
            let idx = members.findIndex(m => m.name.toLowerCase() === action.name.toLowerCase());
            if (idx === -1) {
                members.push({ name: action.name, color: getColor(members.length) });
                idx = members.length - 1;
            }
            const role = action.isCreator ? 'admin' : 'member';
            const accounts = state.accounts.map(a =>
                a.id === action.userId ? { ...a, memberIdx: idx, role: role as Role } : a
            );
            const newCode = action.code.toUpperCase();
            return {
                ...state, group: newCode, members, user: action.name,
                groupName: action.groupName || state.groupName,
                currentUser: idx, mode: 'group', onboarded: true, accounts,
                joinedGroups: state.joinedGroups.includes(newCode) ? state.joinedGroups : [...state.joinedGroups, newCode]
            };
        }

        case 'SET_SOLO': {
            const accounts = state.accounts.map(a =>
                a.id === action.userId ? { ...a, memberIdx: 0, role: 'admin' as Role } : a
            );
            return {
                ...state, user: action.name,
                members: [{ name: action.name, color: getColor(0) }],
                currentUser: 0, mode: 'solo', group: null, onboarded: true, accounts,
            };
        }

        case 'LEAVE_GROUP': {
            return {
                ...state,
                group: null,
                mode: null,
                currentUser: null,
                tasks: [],
                members: [],
                onboarded: true, // They are onboarded, just currently viewing the dashboard menu
            };
        }

        case 'ADD_TASK': {
            const memberProgress: Record<number, boolean[]> = {};
            state.members.forEach((_, i) => {
                memberProgress[i] = new Array(action.task.steps.length).fill(false);
            });
            return { ...state, tasks: [{ ...action.task, memberProgress }, ...state.tasks] };
        }

        case 'DELETE_TASK':
            return { ...state, tasks: state.tasks.filter(t => t.id !== action.taskId) };

        case 'TOGGLE_STEP': {
            const u = state.currentUser;
            if (u === null) return state;
            return {
                ...state,
                tasks: state.tasks.map(t => {
                    if (t.id !== action.taskId) return t;
                    const newProgress = { ...t.memberProgress };
                    if (!newProgress[u]) newProgress[u] = new Array(t.steps.length).fill(false);
                    newProgress[u] = [...newProgress[u]];
                    newProgress[u][action.stepIdx] = !newProgress[u][action.stepIdx];
                    return { ...t, memberProgress: newProgress };
                }),
            };
        }

        case 'ADD_COMMENT': {
            if (state.currentUser === null) return state;
            const comment: Comment = {
                id: Date.now(), taskId: action.taskId,
                authorIdx: state.currentUser, text: action.text, createdAt: Date.now(),
            };
            return {
                ...state,
                tasks: state.tasks.map(t =>
                    t.id === action.taskId ? { ...t, comments: [...(t.comments || []), comment] } : t
                ),
            };
        }

        case 'SET_PROOF':
            return {
                ...state,
                tasks: state.tasks.map(t =>
                    t.id === action.taskId ? { ...t, proofUrl: action.url } : t
                ),
            };

        case 'SET_PROFILE':
            return { ...state, profile: action.profile, onboarded: true };

        case 'SET_ROLE':
            return {
                ...state,
                accounts: state.accounts.map(a =>
                    a.id === action.userId ? { ...a, role: action.role } : a
                ),
            };

        case 'UPDATE_PERMISSIONS':
            return {
                ...state,
                rolePermissions: { ...state.rolePermissions, [action.role]: action.permissions },
            };

        case 'REMOVE_MEMBER': {
            const newMembers = state.members.filter((_, i) => i !== action.memberIdx);
            const newAccounts = state.accounts.map(a => {
                if (a.memberIdx === action.memberIdx) return { ...a, memberIdx: -1 };
                if (a.memberIdx > action.memberIdx) return { ...a, memberIdx: a.memberIdx - 1 };
                return a;
            });
            return { ...state, members: newMembers, accounts: newAccounts };
        }

        case 'SELF_HEAL_JOIN': {
            const members = [...state.members, action.newMember];
            const newMemberIdx = members.length - 1;

            const newAccount = {
                ...action.newAccount,
                memberIdx: newMemberIdx,
                role: 'member' as Role
            };

            const accounts = [...state.accounts.filter(a => a.id !== action.newAccount.id), newAccount];

            return {
                ...state,
                members,
                accounts,
                currentUser: newMemberIdx
            };
        }

        default:
            return state;
    }
}

interface AppContextValue {
    state: AppState;
    dispatch: React.Dispatch<Action>;
    currentAccount: UserAccount | null;
    hasPermission: (perm: Permission) => boolean;
    isOwnIdx: (memberIdx: number) => boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

const initFn = (initial: AppState): AppState => {
    try {
        const d = localStorage.getItem('classsync_v3');
        if (d) return { ...initial, ...JSON.parse(d) };
    } catch (e) { }
    return initial;
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
    const [state, dispatch] = useReducer(reducer, initialState, initFn);
    const isLocalChange = useRef(false);
    const isSynced = useRef(false);

    // 2. Persist to LocalStorage
    useEffect(() => {
        try {
            localStorage.setItem('classsync_v3', JSON.stringify(state));
        } catch (e) { }
    }, [state]);

    // 3. Firestore Sync (Group Data)
    useEffect(() => {
        if (state.mode === 'group' && state.group) {
            const unsubscribe = syncGroupData(state.group, (data) => {
                if (!isLocalChange.current) {
                    dispatch({ type: 'SYNC_GROUP', data });
                    isSynced.current = true;
                }
                isLocalChange.current = false;
            });
            return () => unsubscribe();
        }
    }, [state.group, state.mode]);

    // 4. Firestore Push (Group Data)
    useEffect(() => {
        if (state.mode === 'group' && state.group && isLocalChange.current) {
            const { tasks, members, accounts, rolePermissions } = state;
            updateGroupState(state.group, { tasks, members, accounts, rolePermissions });
        }
    }, [state]);

    // 5. Save User's Group/Mode Preferences
    useEffect(() => {
        if (state.loggedInUserId) {
            saveUserGroup(state.loggedInUserId, state.group, state.mode as 'group' | 'solo');
        }
    }, [state.group, state.mode, state.loggedInUserId]);

    const currentAccount = state.loggedInUserId
        ? state.accounts.find(a => a.id === state.loggedInUserId) || null
        : null;

    // 6. Member self-healing (If join fails server-side but reads succeed)
    useEffect(() => {
        if (state.mode === 'group' && state.group && state.loggedInUserId && currentAccount && isSynced.current) {
            const myServerAcct = state.accounts.find(a => a.id === state.loggedInUserId);
            // If I am not in the recognized members array, I must add myself
            if (!myServerAcct || myServerAcct.memberIdx === -1) {
                const newMember = { name: state.user || currentAccount.displayName, color: getColor(state.members.length) };
                wrappedDispatch({ type: 'SELF_HEAL_JOIN', newMember, newAccount: currentAccount });
            }
        }
    }, [state.accounts, state.group, state.mode, state.loggedInUserId, currentAccount]);

    // Wrap dispatch to track local changes
    const wrappedDispatch = (action: Action) => {
        if (['JOIN_GROUP', 'LEAVE_GROUP', 'FIREBASE_LOGIN', 'LOAD_STATE'].includes(action.type)) {
            isLocalChange.current = false;
        } else if (action.type !== 'SYNC_GROUP') {
            isLocalChange.current = true;
        }
        dispatch(action);
    };

    const hasPermission = (perm: Permission): boolean => {
        if (!currentAccount) return false;
        const role = currentAccount.role;
        const perms = state.rolePermissions[role] || [];
        return perms.includes(perm);
    };

    const isOwnIdx = (memberIdx: number): boolean => {
        return currentAccount?.memberIdx === memberIdx;
    };

    return (
        <AppContext.Provider value={{ state, dispatch: wrappedDispatch, currentAccount, hasPermission, isOwnIdx }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be inside AppProvider');
    return ctx;
};

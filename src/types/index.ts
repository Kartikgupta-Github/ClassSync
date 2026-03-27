export interface Member {
    name: string;
    color: string;
}

export interface Comment {
    id: number;
    taskId: number;
    authorIdx: number;
    text: string;
    createdAt: number;
}

export interface TaskAttachment {
    name: string;
    url: string;
    size: number;
    type: string;
}

export interface Task {
    id: number;
    name: string;
    subject: string;
    deadline: string;
    type: string;
    steps: string[];
    memberProgress: Record<number, boolean[]>;
    createdBy: number;
    createdAt: number;
    comments: Comment[];
    proofUrl?: string;
    attachments?: TaskAttachment[];
}

export const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// ── AUTH & RBAC ──
export type Role = 'admin' | 'member';

export interface UserAccount {
    id: string;
    email: string;
    passwordHash: string; // SHA-256 hash
    displayName: string;
    role: Role;
    memberIdx: number; // maps to members[] index
    createdAt: number;
}

export type Permission =
    | 'create_task'
    | 'delete_task'
    | 'edit_task'
    | 'toggle_own_steps'
    | 'toggle_others_steps'
    | 'add_comment'
    | 'upload_proof'
    | 'manage_members'
    | 'change_roles'
    | 'view_leaderboard'
    | 'export_pdf';

// Default permission matrix
export const DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
    admin: [
        'create_task', 'delete_task', 'edit_task',
        'toggle_own_steps', 'toggle_others_steps',
        'add_comment', 'upload_proof',
        'manage_members', 'change_roles',
        'view_leaderboard', 'export_pdf',
    ],
    member: [
        'create_task',
        'toggle_own_steps',
        'add_comment', 'upload_proof',
        'view_leaderboard', 'export_pdf',
    ],
};

export const PERMISSION_LABELS: Record<Permission, string> = {
    create_task: 'Create Tasks',
    delete_task: 'Delete Tasks',
    edit_task: 'Edit Tasks',
    toggle_own_steps: 'Mark Own Steps',
    toggle_others_steps: "Mark Others' Steps",
    add_comment: 'Add Comments',
    upload_proof: 'Upload Proof',
    manage_members: 'Manage Members',
    change_roles: 'Change Roles',
    view_leaderboard: 'View Leaderboard',
    export_pdf: 'Export PDF',
};

export const ALL_PERMISSIONS: Permission[] = Object.keys(PERMISSION_LABELS) as Permission[];

export interface AppState {
    user: string | null;
    group: string | null;
    groupName?: string;
    members: Member[];
    tasks: Task[];
    currentUser: number | null;
    mode: 'group' | 'solo' | null;
    onboarded: boolean;
    profile: {
        displayName: string;
        college: string;
        semester: string;
    } | null;
    // History
    joinedGroups: string[];
    // Auth
    accounts: UserAccount[];
    loggedInUserId: string | null;
    // RBAC - customizable permissions per role
    rolePermissions: Record<Role, Permission[]>;
}

export const COLORS = ['#7c6bff', '#ff6b6b', '#6bffb8', '#ffb347', '#6bb8ff', '#ff6bda', '#b8ff6b', '#ff9f6b'];
export const getColor = (i: number) => COLORS[i % COLORS.length];
export const initials = (n: string) => n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

export const STEP_PRESETS = ['Write', 'Get Checked', 'Submit Portal', 'Print', 'Physical Submit'];

export const SUBJECT_SUGGESTIONS: Record<string, { type: string; steps: string[] }> = {
    'DBMS': { type: 'Assignment', steps: ['Write', 'Get Checked', 'Submit Portal'] },
    'OS': { type: 'Lab File', steps: ['Write', 'Get Checked', 'Submit Portal'] },
    'CN': { type: 'Assignment', steps: ['Write', 'Get Checked', 'Submit Portal', 'Print'] },
    'DAA': { type: 'Assignment', steps: ['Write', 'Get Checked'] },
    'SE': { type: 'Project', steps: ['Write', 'Submit Portal'] },
    'AI': { type: 'Assignment', steps: ['Write', 'Get Checked', 'Submit Portal'] },
    'ML': { type: 'Lab File', steps: ['Write', 'Get Checked', 'Submit Portal'] },
    'MATH': { type: 'Assignment', steps: ['Write', 'Get Checked', 'Physical Submit'] },
};

// Simple hash for local auth (NOT production-grade, but works offline)
export async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'classsync_salt_2026');
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

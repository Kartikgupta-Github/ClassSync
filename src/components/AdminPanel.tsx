import React from 'react';
import { useApp } from '../context/AppContext';
import type { Role, Permission } from '../types';
import { ALL_PERMISSIONS, PERMISSION_LABELS } from '../types';
import { showToast } from './Toast';

const AdminPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { state, dispatch, hasPermission, currentAccount } = useApp();

    const togglePermission = (role: Role, perm: Permission) => {
        const current = state.rolePermissions[role] || [];
        const updated = current.includes(perm)
            ? current.filter(p => p !== perm)
            : [...current, perm];
        dispatch({ type: 'UPDATE_PERMISSIONS', role, permissions: updated });
        showToast(`Updated ${role} permissions`);
    };

    const changeRole = (userId: string, role: Role, memberIdx: number) => {
        // Creator (memberIdx 0) can never be demoted
        if (memberIdx === 0) {
            showToast('⚠️ The group creator cannot be changed from Admin.');
            return;
        }
        if (userId === currentAccount?.id && role === 'member') {
            showToast('⚠️ You cannot demote yourself. Another admin must do it.');
            return;
        }
        dispatch({ type: 'SET_ROLE', userId, role });
        showToast(`Role updated to ${role}`);
    };

    const removeMember = (memberIdx: number) => {
        if (confirm('Remove this member from the group?')) {
            dispatch({ type: 'REMOVE_MEMBER', memberIdx });
            showToast('Member removed');
        }
    };

    return (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: '640px', maxHeight: '85vh', overflow: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0 }}>👥 Group Settings</h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ Close</button>
                </div>

                {/* Members Section */}
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: '"DM Mono", monospace', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                    Members ({state.members.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                    {state.members.map((m, mi) => {
                        const account = state.accounts.find(a => a.memberIdx === mi);
                        const isSelf = account?.id === currentAccount?.id;
                        return (
                            <div key={mi} style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                background: 'var(--surface)', border: '1px solid var(--border)',
                                borderRadius: '10px', padding: '10px 14px',
                                overflow: 'hidden', flexWrap: 'wrap',
                            }}>
                                <div className="avatar" style={{ background: m.color, flexShrink: 0 }}>{m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {m.name} {isSelf && <span style={{ color: 'var(--accent)', fontWeight: 400, fontSize: '0.75rem' }}>(You)</span>}
                                        {mi === 0 && <span style={{ fontSize: '0.65rem', color: 'var(--warn)' }}> 👑 Creator</span>}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: '"DM Mono", monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {account?.email || 'No account linked'}
                                    </div>
                                </div>
                                <span className={`role-badge ${account?.role || 'member'}`}>
                                    {account?.role === 'admin' ? '👑 Admin' : 'Member'}
                                </span>
                                {hasPermission('change_roles') && account && (
                                    <select
                                        value={account.role}
                                        disabled={mi === 0 || (isSelf && account.role === 'admin')}
                                        onChange={e => changeRole(account.id, e.target.value as Role, mi)}
                                        style={{ width: 'auto', minWidth: '90px', padding: '4px 8px', fontSize: '0.75rem', opacity: mi === 0 ? 0.5 : 1 }}
                                        title={mi === 0 ? 'Group creator cannot be changed' : isSelf && account.role === 'admin' ? 'You cannot demote yourself' : ''}
                                    >
                                        <option value="admin">👑 Admin</option>
                                        <option value="member">👤 Member</option>
                                    </select>
                                )}
                                {hasPermission('manage_members') && account?.role !== 'admin' && mi !== 0 && (
                                    <button className="btn btn-danger btn-sm" onClick={() => removeMember(mi)}>Remove</button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Permissions Matrix */}
                {hasPermission('change_roles') && (
                    <>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: '"DM Mono", monospace', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                            Permission Matrix
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="permissions-table">
                                <thead>
                                    <tr>
                                        <th>Action</th>
                                        <th>👑 Admin</th>
                                        <th>Member</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ALL_PERMISSIONS.map(perm => (
                                        <tr key={perm}>
                                            <td>{PERMISSION_LABELS[perm]}</td>
                                            <td>
                                                <button
                                                    className={`perm-toggle ${state.rolePermissions.admin.includes(perm) ? 'on' : ''}`}
                                                    onClick={() => togglePermission('admin', perm)}
                                                >
                                                    {state.rolePermissions.admin.includes(perm) ? '✓' : ''}
                                                </button>
                                            </td>
                                            <td>
                                                <button
                                                    className={`perm-toggle ${state.rolePermissions.member.includes(perm) ? 'on' : ''}`}
                                                    onClick={() => togglePermission('member', perm)}
                                                >
                                                    {state.rolePermissions.member.includes(perm) ? '✓' : ''}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* Group Info */}
                {state.group && (
                    <div style={{ marginTop: '20px', padding: '14px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.72rem', fontFamily: '"DM Mono", monospace', color: 'var(--muted)', marginBottom: '6px' }}>GROUP CODE</div>
                        <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--accent)', letterSpacing: '2px', fontFamily: '"DM Mono", monospace' }}>{state.group}</div>
                        <div style={{ fontSize: '0.72rem', fontFamily: '"DM Mono", monospace', color: 'var(--muted)', marginTop: '6px' }}>
                            Share this code with classmates to sync tasks
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPanel;

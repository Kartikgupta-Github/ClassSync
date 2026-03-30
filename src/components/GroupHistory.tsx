import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { doc, getDoc } from 'firebase/firestore';
import { db, leaveGroupOnServer, deleteGroupOnServer } from '../lib/firebase';
import { showToast } from './Toast';

interface GroupCard {
    code: string;
    name: string;
    loading: boolean;
    isAdmin?: boolean;
}

export const GroupHistory: React.FC = () => {
    const { state, dispatch, currentAccount } = useApp();
    const [history, setHistory] = useState<GroupCard[]>([]);
    const [fetching, setFetching] = useState(false);

    useEffect(() => {
        if (!state.joinedGroups || state.joinedGroups.length === 0) {
            setHistory([]);
            return;
        }

        const fetchGroups = async () => {
            setFetching(true);
            const groupsData: GroupCard[] = [];
            
            for (const code of state.joinedGroups) {
                try {
                    const docRef = doc(db, 'groups', code.toUpperCase());
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        const data = snap.data();
                        const isAdmin = data.accounts?.find((a: any) => a.id === currentAccount?.id)?.role === 'admin';
                        groupsData.push({
                            code,
                            name: data.groupName || 'Unnamed Group',
                            loading: false,
                            isAdmin
                        });
                    }
                } catch (err) {
                    console.warn(`Failed to fetch group ${code}`, err);
                }
            }
            // Reverse so most recent is first
            setHistory(groupsData.reverse());
            setFetching(false);
        };

        fetchGroups();
    }, [state.joinedGroups]);

    const handleRejoin = async (code: string) => {
        if (!currentAccount) return;
        
        // Optimistically set the card to loading
        setHistory(prev => prev.map(g => g.code === code ? { ...g, loading: true } : g));
        
        try {
            const docRef = doc(db, 'groups', code.toUpperCase());
            const snap = await getDoc(docRef);
            
            if (!snap.exists()) {
                showToast('❌ Group no longer exists.');
                setHistory(prev => prev.filter(g => g.code !== code));
                return;
            }

            const targetGroup = history.find(g => g.code === code);

            dispatch({ 
                type: 'JOIN_GROUP', 
                name: currentAccount.displayName, 
                code, 
                userId: currentAccount.id, 
                isCreator: false,
                groupName: targetGroup?.name
            });
            showToast(`✓ Welcome back directly to ${code}`);
        } catch (err) {
            console.error(err);
            showToast('❌ Failed to reconnect to the group.');
            setHistory(prev => prev.map(g => g.code === code ? { ...g, loading: false } : g));
        }
    };

    const handleLeave = async (code: string) => {
        if (!currentAccount) return;
        if (!confirm(`Are you sure you want to completely leave ${code}? You will have to rejoin with the code.`)) return;
        if (!confirm(`Are you absolutely sure? This will remove you from the group.`)) return;
        
        try {
            await leaveGroupOnServer(currentAccount.id, code);
            dispatch({ type: 'LEAVE_GROUP_HISTORY', code });
            setHistory(prev => prev.filter(g => g.code !== code));
            showToast('✓ Left the group.');
        } catch (e) {
            console.error(e);
            showToast('❌ Failed to leave group.');
        }
    };

    const handleDelete = async (code: string) => {
        if (!confirm(`⚠️ DANGER: Are you sure you want to permanently DELETE group ${code}? This affects all members and cannot be undone.`)) return;
        if (!confirm(`FINAL WARNING: This will permanently erase the group ${code}. Proceed?`)) return;
        
        try {
            await deleteGroupOnServer(code);
            // After deleting, they also "leave" it
            if (currentAccount) await leaveGroupOnServer(currentAccount.id, code);
            dispatch({ type: 'LEAVE_GROUP_HISTORY', code });
            setHistory(prev => prev.filter(g => g.code !== code));
            showToast('🗑️ Group permanently deleted.');
        } catch (e) {
            console.error(e);
            showToast('❌ Failed to delete group.');
        }
    };

    if (state.joinedGroups.length === 0) return null;

    return (
        <div style={{ marginTop: '40px', textAlign: 'left', maxWidth: '440px', margin: '40px auto 0' }}>
            <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--muted)', marginBottom: '16px', fontWeight: 600 }}>
                Previously Joined Classes
            </div>
            
            {fetching && history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>
                    <div className="spinner" style={{ borderColor: 'var(--muted)', borderTopColor: 'transparent', width: '24px', height: '24px', margin: '0 auto 12px' }} />
                    Loading history...
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {history.map(group => (
                        <div 
                            key={group.code}
                            style={{
                                background: 'var(--surface)',
                                border: '3px solid var(--border)',
                                boxShadow: '4px 4px 0px var(--border)',
                                borderRadius: '0',
                                padding: '16px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.2s',
                                opacity: group.loading ? 0.7 : 1,
                            }}
                            onMouseEnter={e => {
                                if (!group.loading) {
                                    e.currentTarget.style.transform = 'translate(-2px, -2px)';
                                    e.currentTarget.style.boxShadow = '6px 6px 0px var(--border)';
                                }
                            }}
                            onMouseLeave={e => {
                                if (!group.loading) {
                                    e.currentTarget.style.transform = 'translate(0, 0)';
                                    e.currentTarget.style.boxShadow = '4px 4px 0px var(--border)';
                                }
                            }}
                        >
                            <div style={{ flex: 1, cursor: group.loading ? 'default' : 'pointer' }} onClick={() => !group.loading && handleRejoin(group.code)}>
                                <div style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: '4px', color: 'var(--text)' }}>
                                    {group.name} {group.isAdmin && <span style={{ fontSize: '0.65rem', color: '#fff', background: 'var(--accent)', padding: '2px 6px', border: '2px solid #000', marginLeft: '8px', verticalAlign: 'middle', textTransform: 'uppercase', letterSpacing: '1px' }}>👑 Admin</span>}
                                </div>
                                <div style={{ fontFamily: '"DM Mono", monospace', fontSize: '0.85rem', color: 'var(--muted)' }}>
                                    Code: {group.code}
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {group.isAdmin && (
                                    <button 
                                        className="btn btn-sm" 
                                        style={{ background: 'var(--accent2)', color: '#000', padding: '6px 10px' }}
                                        onClick={(e) => { e.stopPropagation(); handleDelete(group.code); }}
                                        title="Delete Group"
                                    >
                                        🗑️
                                    </button>
                                )}
                                <button 
                                    className="btn btn-sm btn-ghost"
                                    style={{ padding: '6px 10px' }}
                                    onClick={(e) => { e.stopPropagation(); handleLeave(group.code); }}
                                    title="Leave Group"
                                >
                                    🚪
                                </button>
                                {group.loading ? (
                                    <div className="spinner" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent', marginLeft: '8px' }} />
                                ) : (
                                    <div style={{ color: 'var(--text)', fontSize: '1.5rem', fontWeight: 800, cursor: 'pointer', marginLeft: '8px', border: '3px solid #000', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent3)', transition: 'transform 0.1s' }} onClick={() => !group.loading && handleRejoin(group.code)}>→</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

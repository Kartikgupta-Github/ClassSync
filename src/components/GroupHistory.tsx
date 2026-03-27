import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { showToast } from './Toast';

interface GroupCard {
    code: string;
    name: string;
    loading: boolean;
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
                        groupsData.push({
                            code,
                            name: snap.data().groupName || 'Unnamed Group',
                            loading: false
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
                            onClick={() => !group.loading && handleRejoin(group.code)}
                            style={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: '12px',
                                padding: '16px',
                                cursor: group.loading ? 'default' : 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.2s',
                                opacity: group.loading ? 0.7 : 1,
                            }}
                            onMouseEnter={e => {
                                if (!group.loading) {
                                    e.currentTarget.style.borderColor = 'var(--primary)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }
                            }}
                            onMouseLeave={e => {
                                if (!group.loading) {
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '4px', color: 'var(--text)' }}>
                                    {group.name}
                                </div>
                                <div style={{ fontFamily: '"DM Mono", monospace', fontSize: '0.85rem', color: 'var(--muted)' }}>
                                    Code: {group.code}
                                </div>
                            </div>
                            
                            <div>
                                {group.loading ? (
                                    <div className="spinner" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
                                ) : (
                                    <div style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>→</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

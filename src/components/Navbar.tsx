import React from 'react';
import { useApp } from '../context/AppContext';

const Navbar: React.FC<{ onOpenModal: () => void; onOpenAdmin: () => void; onLogout: () => void; onLeaveGroup: () => void }> = ({ onOpenModal, onOpenAdmin, onLogout, onLeaveGroup }) => {
    const { state, currentAccount } = useApp();
    const inGroup = state.group || state.mode === 'solo';

    return (
        <header className="sticky-header">
            {/* Main Nav — always clean and minimal */}
            <nav>
                <div className="logo">
                    <div className="logo-dot"></div>
                    Assignova
                </div>

                {/* Center: group name on desktop only */}
                {inGroup && (
                    <div className="nav-center">
                        {state.mode === 'solo' ? 'Solo Workspace' : state.groupName || ''}
                    </div>
                )}

                <div className="nav-right">
                    {currentAccount && (
                        <>
                            <button className="btn btn-ghost btn-sm" onClick={onOpenAdmin} title="Group Settings">⚙</button>
                            <div
                                className="nav-avatar"
                                style={{
                                    background: state.members[currentAccount.memberIdx]?.color || 'var(--accent)',
                                }}
                                title={`${currentAccount.displayName} (${currentAccount.role})`}
                            >
                                {currentAccount.displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            {!state.onboarded ? (
                                <button className="btn btn-primary" onClick={onOpenModal}>Get Started</button>
                            ) : (
                                <button className="btn btn-ghost btn-sm" onClick={onLogout} title="Sign Out">Sign Out</button>
                            )}
                        </>
                    )}
                </div>
            </nav>

            {/* Sub-bar: Back + Group Code — only when inside a group */}
            {inGroup && (
                <div className="sub-bar">
                    <button className="btn btn-ghost btn-sm" onClick={onLeaveGroup} title="Leave Class">
                        ← Back
                    </button>

                    {/* Group name for mobile (hidden on desktop since nav-center handles it) */}
                    {state.mode !== 'solo' && (
                        <span className="sub-bar-title">{state.groupName || ''}</span>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {state.group && <span className="badge">{state.group}</span>}
                        {state.mode === 'solo' && <span className="badge" style={{ background: 'var(--accent3)', color: '#000' }}>SOLO</span>}
                    </div>
                </div>
            )}
        </header>
    );
};

export default Navbar;

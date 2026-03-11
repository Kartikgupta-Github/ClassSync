import React from 'react';
import { useApp } from '../context/AppContext';

const Navbar: React.FC<{ onOpenModal: () => void; onOpenAdmin: () => void; onLogout: () => void }> = ({ onOpenModal, onOpenAdmin, onLogout }) => {
    const { state, currentAccount, hasPermission } = useApp();
    const inGroup = state.group && state.user;

    return (
        <nav>
            <div className="logo">
                <div className="logo-dot"></div>
                ClassSync
            </div>
            <div className="nav-right">
                {inGroup && <span className="badge">{state.group}</span>}
                {state.mode === 'solo' && <span className="badge" style={{ background: 'var(--accent3)', color: '#000' }}>SOLO</span>}

                {currentAccount && (
                    <>
                        <button className="btn btn-ghost btn-sm" onClick={onOpenAdmin} title="Group Settings">⚙</button>
                        <div
                            style={{
                                width: 32, height: 32, borderRadius: '50%',
                                background: state.members[currentAccount.memberIdx]?.color || 'var(--accent)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.75rem', fontWeight: 700, color: '#fff',
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
    );
};

export default Navbar;

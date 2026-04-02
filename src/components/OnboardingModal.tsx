import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { showToast } from './Toast';
import { generateGroupCode, joinGroupOnServer, updateGroupState, saveUserGroup } from '../lib/firebase';

interface OnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Step = 'choose' | 'group-menu' | 'create-group' | 'join-group' | 'solo';

const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
    const { state, dispatch, currentAccount } = useApp();
    const [step, setStep] = useState<Step>('choose');
    const [name, setName] = useState(currentAccount?.displayName || state.user || '');
    const [groupName, setGroupName] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [generatedCode, setGeneratedCode] = useState('');
    const [codeStatus, setCodeStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');
    const [joining, setJoining] = useState(false);


    // Start generating as soon as user lands on create-group
    useEffect(() => {
        if (step === 'create-group') {
            const code = generateGroupCode();
            setGeneratedCode(code);
            setCodeStatus('ready');
        } else {
            setGeneratedCode('');
            setCodeStatus('idle');
        }
    }, [step]);

    const handleRegenerate = () => {
        setCodeStatus('generating');
        // Tiny delay so spinner is visible for feedback
        setTimeout(() => {
            const code = generateGroupCode();
            setGeneratedCode(code);
            setCodeStatus('ready');
        }, 300);
    };

    const handleCreateGroup = async () => {
        if (!name.trim()) { showToast('⚠ Enter your display name'); return; }
        if (!groupName.trim()) { showToast('⚠ Enter a group name'); return; }
        if (!currentAccount) { showToast('⚠ Please sign in first'); return; }
        if (codeStatus !== 'ready' || !generatedCode) { showToast('⚠ Wait for code generation...'); return; }

        // Dispatch locally first so UI updates immediately
        dispatch({ type: 'JOIN_GROUP', name: name.trim(), code: generatedCode, userId: currentAccount.id, isCreator: true, groupName: groupName.trim() });
        showToast(`✓ Group "${groupName.trim()}" created! Code: ${generatedCode}`);
        resetAndClose();

        // Then try to save group name to Firestore (non-blocking)
        try {
            await updateGroupState(generatedCode, { groupName: groupName.trim(), createdAt: Date.now() });
            await saveUserGroup(currentAccount.id, generatedCode, 'group');
        } catch (err) {
            console.warn('Firestore write failed (group will sync later):', err);
        }
    };

    const handleJoinGroup = async () => {
        const code = joinCode.trim().toUpperCase();
        if (!name.trim()) { showToast('⚠ Enter your display name'); return; }
        if (code.length < 4) { showToast('⚠ Enter a valid group code'); return; }
        if (!currentAccount) { showToast('⚠ Please sign in first'); return; }

        setJoining(true);
        try {
            // Securely join on server to avoid wiping tasks array
            const joined = await joinGroupOnServer(code, name.trim(), currentAccount);
            if (!joined) {
                showToast('❌ No group found with that code. Check and try again.');
                setJoining(false);
                return;
            }
        } catch (err: any) {
            console.warn('Check failed (offline or permission). Joining locally...', err);
        }

        dispatch({ type: 'JOIN_GROUP', name: name.trim(), code, userId: currentAccount.id, isCreator: false });
        
        try {
            await saveUserGroup(currentAccount.id, code, 'group');
        } catch (err) {
            console.warn("Could not save user group:", err);
        }

        showToast(`✓ Joined group ${code} as ${name.trim()}`);
        resetAndClose();
        setJoining(false);
    };

    const handleSolo = async () => {
        if (!name.trim()) { showToast('⚠ Enter your name'); return; }
        if (!currentAccount) { showToast('⚠ Please sign in first'); return; }
        dispatch({ type: 'SET_SOLO', name: name.trim(), userId: currentAccount.id });
        
        try {
            await saveUserGroup(currentAccount.id, null, 'solo');
        } catch (err) {
            console.warn("Could not save solo mode:", err);
        }
        
        showToast(`✓ Started solo mode as ${name.trim()}`);
        resetAndClose();
    };

    const resetAndClose = () => {
        setStep('choose');
        setJoinCode('');
        setGroupName('');
        setGeneratedCode('');
        setCodeStatus('idle');
        onClose();
    };

    const goBack = () => {
        if (step === 'group-menu') setStep('choose');
        else if (step === 'create-group' || step === 'join-group') setStep('group-menu');
        else if (step === 'solo') setStep('choose');
    };

    if (!isOpen) return null;

    const nameField = (
        <div className="form-group">
            <label>Your Display Name</label>
            <input
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={e => setName(e.target.value)}
            />
        </div>
    );

    return (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) resetAndClose(); }}>
            <div className="modal" style={{ maxWidth: step === 'choose' ? '520px' : '480px' }}>

                {/* ═══ CHOOSE MODE ═══ */}
                {step === 'choose' && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                            <img src="/logo.png" alt="Assignova Logo" style={{ width: '56px', height: '56px', borderRadius: '12px' }} />
                        </div>
                        <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>Get Started with Assignova</h2>
                        <p style={{ textAlign: 'center', color: 'var(--muted)', fontFamily: '"DM Mono", monospace', fontSize: '0.82rem', marginBottom: '24px' }}>
                            Choose how you want to track your assignments
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <button onClick={() => setStep('group-menu')} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px 16px', cursor: 'pointer', textAlign: 'center', color: 'var(--text)', transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(124,107,255,0.05)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; }}>
                                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>👥</div>
                                <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '6px' }}>Group / Class Mode</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: '"DM Mono", monospace', lineHeight: '1.5' }}>Create or join a group with classmates.</div>
                            </button>
                            <button onClick={() => setStep('solo')} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px 16px', cursor: 'pointer', textAlign: 'center', color: 'var(--text)', transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent3)'; e.currentTarget.style.background = 'rgba(107,255,184,0.05)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; }}>
                                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🧑</div>
                                <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '6px' }}>Solo / Individual</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: '"DM Mono", monospace', lineHeight: '1.5' }}>Personal tracker. Full admin control.</div>
                            </button>
                        </div>
                    </>
                )}

                {/* ═══ GROUP MENU ═══ */}
                {step === 'group-menu' && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                            <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={goBack}>←</button>
                            <h2 style={{ margin: 0 }}>Join or Create a Group</h2>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button onClick={() => setStep('create-group')} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 16px', cursor: 'pointer', textAlign: 'left', color: 'var(--text)', transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}>
                                <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '4px' }}>✨ Create New Group</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: '"DM Mono", monospace' }}>
                                    A unique group code will be auto-generated. Share it with classmates.
                                </div>
                            </button>
                            <button onClick={() => setStep('join-group')} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 16px', cursor: 'pointer', textAlign: 'left', color: 'var(--text)', transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent3)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}>
                                <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '4px' }}>🔗 Join Existing Group</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: '"DM Mono", monospace' }}>
                                    Enter the group code shared by your Admin.
                                </div>
                            </button>
                        </div>
                    </>
                )}

                {/* ═══ CREATE GROUP ═══ */}
                {step === 'create-group' && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                            <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={goBack}>←</button>
                            <h2 style={{ margin: 0 }}>✨ Create New Group</h2>
                        </div>

                        {nameField}

                        <div className="form-group">
                            <label>Group Name</label>
                            <input
                                type="text"
                                placeholder="e.g. CSE Batch 2025 - B"
                                value={groupName}
                                onChange={e => setGroupName(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label>Group Code <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 400 }}>(auto-generated, read-only)</span></label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    flex: 1,
                                    padding: '10px 16px',
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '10px',
                                    fontFamily: '"DM Mono", monospace',
                                    fontWeight: 800,
                                    fontSize: '1.3rem',
                                    letterSpacing: '5px',
                                    color: codeStatus === 'ready' ? 'var(--accent)' : 'var(--muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    minHeight: '48px',
                                }}>
                                    {codeStatus === 'generating' && (
                                        <>
                                            <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', flexShrink: 0 }} />
                                            <span style={{ fontSize: '0.75rem', letterSpacing: '1px', fontWeight: 500 }}>Generating unique code…</span>
                                        </>
                                    )}
                                    {codeStatus === 'ready' && generatedCode}
                                    {codeStatus === 'error' && <span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>Failed — try regenerating</span>}
                                </div>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={handleRegenerate}
                                    disabled={codeStatus === 'generating'}
                                    title="Generate a different code"
                                    style={{ padding: '8px 12px', fontSize: '0.78rem', flexShrink: 0 }}
                                >
                                    🔄
                                </button>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: '"DM Mono", monospace', marginTop: '6px' }}>
                                🔒 Unique code — guaranteed not already taken. Share it with classmates.
                            </div>
                        </div>

                        <div style={{ fontSize: '0.78rem', color: 'var(--warn)', fontFamily: '"DM Mono", monospace', marginBottom: '18px' }}>
                            💡 You will be the <strong>Group Admin</strong> with full control.
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={goBack}>Back</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleCreateGroup}
                                disabled={codeStatus !== 'ready'}
                            >
                                Create Group →
                            </button>
                        </div>
                    </>
                )}

                {/* ═══ JOIN GROUP ═══ */}
                {step === 'join-group' && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                            <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={goBack}>←</button>
                            <h2 style={{ margin: 0 }}>🔗 Join Existing Group</h2>
                        </div>
                        {nameField}
                        <div className="form-group">
                            <label>Group Code</label>
                            <input
                                type="text"
                                placeholder="e.g. AB3C7D"
                                value={joinCode}
                                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                maxLength={6}
                                style={{ fontFamily: '"DM Mono", monospace', fontWeight: 700, letterSpacing: '4px', fontSize: '1.1rem', textTransform: 'uppercase' }}
                            />
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: '"DM Mono", monospace', marginBottom: '18px' }}>
                            Enter the 6-character code provided by your group's Admin.
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={goBack}>Back</button>
                            <button className="btn btn-primary" onClick={handleJoinGroup} disabled={joining}>
                                {joining ? '⏳ Checking...' : 'Join Group →'}
                            </button>
                        </div>
                    </>
                )}

                {/* ═══ SOLO ═══ */}
                {step === 'solo' && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                            <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={goBack}>←</button>
                            <h2 style={{ margin: 0 }}>🧑 Solo Mode</h2>
                        </div>
                        {nameField}
                        <p style={{ color: 'var(--muted)', fontFamily: '"DM Mono", monospace', fontSize: '0.8rem', marginBottom: '18px' }}>
                            You'll have full admin control. You can join or create a group anytime.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={goBack}>Back</button>
                            <button className="btn btn-primary" onClick={handleSolo}>Start Solo →</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default OnboardingModal;

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    resetPassword,
    sendVerificationEmail,
    getAuthErrorMessage,
    auth,
    getUserData,
} from '../lib/firebase';
import { showToast } from './Toast';

type AuthView = 'login' | 'signup' | 'verify-email' | 'forgot-password';

const AuthScreen: React.FC = () => {
    const { dispatch } = useApp();
    const [view, setView] = useState<AuthView>('login');

    // Email form
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [displayName, setDisplayName] = useState('');

    // State
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loadingEmail, setLoadingEmail] = useState(false);
    const [loadingGoogle, setLoadingGoogle] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const clearForm = () => {
        setErrors({});
        setSuccessMsg('');
        setLoadingEmail(false);
        setLoadingGoogle(false);
    };

    const switchView = (v: AuthView) => {
        clearForm();
        setView(v);
    };

    // ── Firebase Login Handler ──
    const handleFirebaseUser = async (user: { uid: string; email: string | null; displayName: string | null }) => {
        const name = user.displayName || user.email?.split('@')[0] || 'User';
        let userData = null;
        try {
            userData = await getUserData(user.uid);
        } catch (err) {
            console.warn("Could not fetch user data:", err);
        }

        dispatch({
            type: 'FIREBASE_LOGIN',
            userId: user.uid,
            email: user.email || '',
            displayName: name,
            lastGroupCode: userData?.lastGroupCode || null,
            mode: userData?.mode || null,
            joinedGroups: userData?.joinedGroups || [],
        });
        showToast(`✓ Welcome, ${name}!`);
    };

    // ── EMAIL SIGNUP ──
    const handleSignup = async () => {
        const errs: Record<string, string> = {};
        if (!displayName.trim()) errs.displayName = 'Display name is required';
        if (!email.trim()) errs.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Invalid email format';
        if (!password) errs.password = 'Password is required';
        else if (password.length < 6) errs.password = 'Minimum 6 characters';
        if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
        if (Object.keys(errs).length) { setErrors(errs); return; }

        setLoadingEmail(true);
        setErrors({});
        try {
            await signUpWithEmail(email.trim(), password);
            switchView('verify-email');
            showToast('📧 Verification email sent! Check your inbox.');
        } catch (err: any) {
            setErrors({ general: getAuthErrorMessage(err.code) });
        }
        setLoadingEmail(false);
    };

    // ── EMAIL LOGIN ──
    const handleLogin = async () => {
        const errs: Record<string, string> = {};
        if (!email.trim()) errs.email = 'Email is required';
        if (!password) errs.password = 'Password is required';
        if (Object.keys(errs).length) { setErrors(errs); return; }

        setLoadingEmail(true);
        setErrors({});
        try {
            const user = await signInWithEmail(email.trim(), password);
            await handleFirebaseUser(user);
        } catch (err: any) {
            setErrors({ general: getAuthErrorMessage(err.code) });
        }
        setLoadingEmail(false);
    };

    // ── GUEST LOGIN ──
    const handleGuestLogin = async () => {
        setLoadingEmail(true);
        setErrors({});
        try {
            const tempEmail = `guest_${Date.now()}@classsync.app`;
            const tempPassword = `Guest123!${Math.random()}`;
            const user = await signUpWithEmail(tempEmail, tempPassword);
            await handleFirebaseUser(user);
        } catch (err: any) {
            setErrors({ general: 'Could not create guest session. Please try again.' });
        }
        setLoadingEmail(false);
    };

    // ── GOOGLE LOGIN ──
    const handleGoogleLogin = async () => {
        setLoadingGoogle(true);
        setErrors({});
        try {
            const user = await signInWithGoogle();
            await handleFirebaseUser(user);
        } catch (err: any) {
            if (err.code !== 'auth/popup-closed-by-user') {
                setErrors({ general: getAuthErrorMessage(err.code) });
            }
        }
        setLoadingGoogle(false);
    };

    // ── FORGOT PASSWORD ──
    const handleForgotPassword = async () => {
        if (!email.trim()) { setErrors({ email: 'Enter your email address' }); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErrors({ email: 'Invalid email format' }); return; }
        setLoadingEmail(true);
        setErrors({});
        try {
            await resetPassword(email.trim());
            setSuccessMsg('Password reset email sent! Check your inbox.');
            showToast('📧 Reset link sent!');
        } catch (err: any) {
            setErrors({ general: getAuthErrorMessage(err.code) });
        }
        setLoadingEmail(false);
    };

    // ── RESEND VERIFICATION ──
    const handleResendVerification = async () => {
        const user = auth.currentUser;
        if (!user) { setErrors({ general: 'No user session. Please sign up again.' }); return; }
        setLoadingEmail(true);
        try {
            await sendVerificationEmail(user);
            showToast('📧 Verification email resent!');
        } catch (err: any) {
            setErrors({ general: getAuthErrorMessage(err.code) });
        }
        setLoadingEmail(false);
    };

    // Check if current user verified their email (poll)
    useEffect(() => {
        if (view !== 'verify-email') return;
        const interval = setInterval(async () => {
            const user = auth.currentUser;
            if (user) {
                await user.reload();
                if (user.emailVerified) {
                    handleFirebaseUser(user);
                    clearInterval(interval);
                }
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [view]);

    return (
        <div className="auth-container">
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div className="logo-dot" />
                    <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>ClassSync</span>
                </div>
            </div>

            <div className="auth-card">
                {/* ═══ LOGIN ═══ */}
                {view === 'login' && (
                    <>
                        <h2>🔐 Sign In</h2>
                        <div className="subtitle">Sign in to track your class assignments</div>

                        {errors.general && <div className="form-error" style={{ marginBottom: '12px', padding: '8px 12px', background: 'rgba(255,107,107,0.1)', borderRadius: '8px', border: '1px solid rgba(255,107,107,0.2)' }}>{errors.general}</div>}

                        <div className="form-group">
                            <label>Email</label>
                            <input type="email" placeholder="you@college.edu" value={email} onChange={e => setEmail(e.target.value)} />
                            {errors.email && <div className="form-error">{errors.email}</div>}
                        </div>
                        <div className="form-group">
                            <label>Password</label>
                            <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                            {errors.password && <div className="form-error">{errors.password}</div>}
                        </div>

                        <div style={{ textAlign: 'right', marginBottom: '12px' }}>
                            <button className="btn-link" onClick={() => switchView('forgot-password')}>Forgot Password?</button>
                        </div>

                        <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loadingEmail || loadingGoogle} onClick={handleLogin}>
                            {loadingEmail ? '⏳ Signing in...' : 'Sign In →'}
                        </button>

                        <div className="form-divider">or continue with</div>

                        <button className="btn btn-google" style={{ width: '100%', marginBottom: '14px' }} onClick={handleGoogleLogin} disabled={loadingEmail || loadingGoogle}>
                            <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '8px', verticalAlign: 'middle' }}><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                            Continue with Google
                        </button>

                        <button className="btn btn-ghost" style={{ width: '100%', marginBottom: '14px', background: 'var(--surface)', border: '1px solid var(--border)' }} onClick={handleGuestLogin} disabled={loadingEmail || loadingGoogle}>
                            <span style={{ fontSize: '18px', marginRight: '8px', verticalAlign: 'middle' }}>👤</span>
                            Continue as Guest
                        </button>

                        <button className="btn btn-ghost" style={{ width: '100%', whiteSpace: 'normal', lineHeight: '1.4' }} onClick={() => switchView('signup')}>
                            Don't have an account? <strong>Sign Up</strong>
                        </button>
                    </>
                )}

                {/* ═══ SIGNUP ═══ */}
                {view === 'signup' && (
                    <>
                        <h2>🆕 Create Account</h2>
                        <div className="subtitle">Create an account to get started</div>

                        {errors.general && <div className="form-error" style={{ marginBottom: '12px', padding: '8px 12px', background: 'rgba(255,107,107,0.1)', borderRadius: '8px', border: '1px solid rgba(255,107,107,0.2)' }}>{errors.general}</div>}

                        <div className="form-group">
                            <label>Display Name</label>
                            <input type="text" placeholder="e.g. Kartik Gupta" value={displayName} onChange={e => setDisplayName(e.target.value)} />
                            {errors.displayName && <div className="form-error">{errors.displayName}</div>}
                        </div>
                        <div className="form-group">
                            <label>Email</label>
                            <input type="email" placeholder="you@college.edu" value={email} onChange={e => setEmail(e.target.value)} />
                            {errors.email && <div className="form-error">{errors.email}</div>}
                        </div>
                        <div className="form-group">
                            <label>Password</label>
                            <input type="password" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} />
                            {errors.password && <div className="form-error">{errors.password}</div>}
                        </div>
                        <div className="form-group">
                            <label>Confirm Password</label>
                            <input type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                            {errors.confirmPassword && <div className="form-error">{errors.confirmPassword}</div>}
                        </div>

                        <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loadingEmail || loadingGoogle} onClick={handleSignup}>
                            {loadingEmail ? '⏳ Creating account...' : 'Create Account →'}
                        </button>

                        <div className="form-divider">or continue with</div>

                        <button className="btn btn-google" style={{ width: '100%', marginBottom: '14px' }} onClick={handleGoogleLogin} disabled={loadingEmail || loadingGoogle}>
                            <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '8px', verticalAlign: 'middle' }}><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                            Continue with Google
                        </button>

                        <button className="btn btn-ghost" style={{ width: '100%', marginBottom: '14px', background: 'var(--surface)', border: '1px solid var(--border)' }} onClick={handleGuestLogin} disabled={loadingEmail || loadingGoogle}>
                            <span style={{ fontSize: '18px', marginRight: '8px', verticalAlign: 'middle' }}>👤</span>
                            Continue as Guest
                        </button>

                        <button className="btn btn-ghost" style={{ width: '100%', whiteSpace: 'normal', lineHeight: '1.4' }} onClick={() => switchView('login')}>
                            Already have an account? <strong>Sign In</strong>
                        </button>
                    </>
                )}

                {/* ═══ EMAIL VERIFICATION ═══ */}
                {view === 'verify-email' && (
                    <>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📧</div>
                            <h2 style={{ marginBottom: '8px' }}>Verify Your Email</h2>
                            <div className="subtitle">
                                We sent a verification link to <strong style={{ color: 'var(--color-accent)' }}>{email || auth.currentUser?.email}</strong>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', lineHeight: '1.6', marginBottom: '20px' }}>
                                Click the link in the email to verify, then come back here. We're checking automatically...
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
                                <div className="spinner" />
                                <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>Waiting for verification...</span>
                            </div>

                            {errors.general && <div className="form-error" style={{ marginBottom: '12px' }}>{errors.general}</div>}

                            <button className="btn btn-ghost" style={{ marginRight: '8px' }} onClick={handleResendVerification} disabled={loadingEmail}>
                                Resend Email
                            </button>
                            <button className="btn btn-ghost" onClick={() => switchView('login')}>
                                ← Back to Sign In
                            </button>
                        </div>
                    </>
                )}

                {/* ═══ FORGOT PASSWORD ═══ */}
                {view === 'forgot-password' && (
                    <>
                        <h2>🔑 Reset Password</h2>
                        <div className="subtitle">Enter your email to receive a password reset link</div>

                        {errors.general && <div className="form-error" style={{ marginBottom: '12px', padding: '8px 12px', background: 'rgba(255,107,107,0.1)', borderRadius: '8px', border: '1px solid rgba(255,107,107,0.2)' }}>{errors.general}</div>}
                        {successMsg && <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'rgba(107,255,184,0.1)', borderRadius: '8px', border: '1px solid rgba(107,255,184,0.2)', color: 'var(--color-accent3)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>{successMsg}</div>}

                        <div className="form-group">
                            <label>Email</label>
                            <input type="email" placeholder="you@college.edu" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleForgotPassword()} />
                            {errors.email && <div className="form-error">{errors.email}</div>}
                        </div>

                        <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loadingEmail} onClick={handleForgotPassword}>
                            {loadingEmail ? '⏳ Sending...' : 'Send Reset Link →'}
                        </button>

                        <div style={{ textAlign: 'center', marginTop: '16px' }}>
                            <button className="btn-link" onClick={() => switchView('login')}>← Back to Sign In</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AuthScreen;

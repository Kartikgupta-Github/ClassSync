import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import AuthScreen from './components/AuthScreen';
import Navbar from './components/Navbar';
import OnboardingModal from './components/OnboardingModal';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import ToastContainer, { showToast } from './components/Toast';
import { logOut, saveUserGroup } from './lib/firebase';
import { GroupHistory } from './components/GroupHistory';

const AppContent: React.FC = () => {
  const { state, dispatch, currentAccount } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Gate 1: Not logged in → show auth screen
  if (!state.loggedInUserId || !currentAccount) {
    return (
      <>
        <nav>
          <div className="logo"><div className="logo-dot"></div>Assignova</div>
          <div className="nav-right"></div>
        </nav>
        <div className="container">
          <AuthScreen />
        </div>
        <ToastContainer />
      </>
    );
  }

  // Gate 2: Logged in but not in a group → show welcome + history
  const inApp = state.group || state.mode === 'solo';

  const handleLogout = async () => {
    await logOut();
    dispatch({ type: 'LOGOUT' });
    showToast('Signed out');
  };

  const handleLeaveGroup = async () => {
    if (state.loggedInUserId) {
        await saveUserGroup(state.loggedInUserId, null, null);
    }
    dispatch({ type: 'LEAVE_GROUP' });
  };

  return (
    <>
        <Navbar 
          onOpenModal={() => setIsModalOpen(true)}
          onOpenAdmin={() => setIsAdminOpen(true)}
          onLogout={handleLogout}
          onLeaveGroup={handleLeaveGroup}
        />

      <div className="container">
        {!inApp ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '20px' }}>🎓</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '12px' }}>Never Miss a Deadline</div>
            <div style={{ color: 'var(--muted)', fontFamily: '"DM Mono", monospace', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto 28px', lineHeight: '1.6' }}>
              One person creates the task — the entire class gets it instantly. Track every step until submission.
            </div>
            <button className="btn btn-primary" style={{ padding: '14px 32px', fontSize: '1rem' }} onClick={() => setIsModalOpen(true)}>
              Get Started →
            </button>
            {state.loggedInUserId && <GroupHistory />}
          </div>
        ) : (
          <Dashboard />
        )}
      </div>

      <OnboardingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      {isAdminOpen && <AdminPanel onClose={() => setIsAdminOpen(false)} />}
      <ToastContainer />
    </>
  );
};

const App: React.FC = () => (
  <AppProvider>
    <AppContent />
  </AppProvider>
);

export default App;

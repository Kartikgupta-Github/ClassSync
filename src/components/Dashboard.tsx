import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { STEP_PRESETS, SUBJECT_SUGGESTIONS } from '../types';
import { getDeadlineInfo, isAllDone, exportToPDF } from '../utils/helpers';
import { showToast } from './Toast';

import TaskCard from './TaskCard';
import Leaderboard from './Leaderboard';

type Tab = 'tasks' | 'leaderboard';

const CreatePanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { state, dispatch, hasPermission } = useApp();
    const [name, setName] = useState('');
    const [subject, setSubject] = useState('');
    const [deadline, setDeadline] = useState('');
    const [type, setType] = useState('Assignment');
    const [activeSteps, setActiveSteps] = useState(['Write', 'Get Checked', 'Submit Portal']);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    if (!hasPermission('create_task')) {
        return (
            <div className="create-panel">
                <p style={{ color: 'var(--muted)', fontFamily: '"DM Mono", monospace', fontSize: '0.85rem', textAlign: 'center' }}>
                    ⛔ You don't have permission to create tasks. Ask your group admin.
                </p>
            </div>
        );
    }

    const toggleStep = (step: string) => {
        if (activeSteps.includes(step)) setActiveSteps(activeSteps.filter(s => s !== step));
        else setActiveSteps([...activeSteps, step]);
    };

    useEffect(() => {
        const upper = subject.toUpperCase().trim();
        if (upper && SUBJECT_SUGGESTIONS[upper]) {
            const s = SUBJECT_SUGGESTIONS[upper];
            setType(s.type);
            setActiveSteps(s.steps);
            setSuggestions([]);
        } else if (upper.length >= 1) {
            const matches = Object.keys(SUBJECT_SUGGESTIONS).filter(k => k.startsWith(upper));
            setSuggestions(matches);
        } else {
            setSuggestions([]);
        }
    }, [subject]);

    const handleCreate = async () => {
        if (!name || !deadline) { showToast('⚠ Task name and deadline required'); return; }
        if (!activeSteps.length) { showToast('⚠ Select at least one step'); return; }

        setUploading(true);
        try {
            dispatch({
                type: 'ADD_TASK',
                task: {
                    id: Date.now(),
                    name,
                    subject,
                    deadline,
                    type,
                    steps: activeSteps,
                    memberProgress: {},
                    createdBy: state.currentUser!,
                    createdAt: Date.now(),
                    comments: [],
                    attachments: []
                },
            });

            showToast(`✓ "${name}" added for all ${state.members.length} member(s)`);
            setName('');
            setSubject('');
            setDeadline('');
            onClose();
        } catch (err) {
            console.error('Create task error:', err);
            showToast('❌ Failed to create task');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="create-panel">
            <div className="form-grid">
                <input type="text" placeholder="Assignment / Lab name" value={name} onChange={e => setName(e.target.value)} />
                <div style={{ position: 'relative' }}>
                    <input type="text" placeholder="Subject (e.g. DBMS, OS)" value={subject} onChange={e => setSubject(e.target.value)} style={{ width: '100%' }} />
                    {suggestions.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0 0 8px 8px' }}>
                            {suggestions.map(s => (
                                <div key={s} onClick={() => { setSubject(s); setSuggestions([]); }} style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '0.82rem', fontFamily: '"DM Mono", monospace', borderBottom: '1px solid var(--border)' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,107,255,0.1)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    {s} — {SUBJECT_SUGGESTIONS[s].type}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
                <select value={type} onChange={e => setType(e.target.value)}>
                    <option value="Assignment">📝 Assignment</option>
                    <option value="Lab File">🔬 Lab File</option>
                    <option value="Project">💻 Project</option>
                    <option value="Viva">🎤 Viva / Exam</option>
                </select>
                <div className="form-full">
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: '"DM Mono", monospace', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Steps</div>
                    <div className="steps-row">
                        {STEP_PRESETS.map((stepName, i) => (
                            <div key={stepName} className={`step-tag ${activeSteps.includes(stepName) ? 'active' : ''}`} onClick={() => toggleStep(stepName)}>
                                <div className="step-num">{i + 1}</div> {stepName}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="form-full">
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: '"DM Mono", monospace', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Attachments</div>
                    <div className="upload-zone disabled" style={{ cursor: 'not-allowed', opacity: 0.7 }}>
                        <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>📁</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>File Uploads are Coming Soon!</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '2px' }}>We're optimizing storage to prevent slowdowns.</div>
                    </div>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button className="btn btn-ghost" onClick={onClose} disabled={uploading}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreate} disabled={uploading}>
                    {state.mode === 'group' ? 'Create for Everyone →' : 'Create Task →'}
                </button>
            </div>
        </div>
    );
};

const Dashboard: React.FC = () => {
    const { state, hasPermission } = useApp();
    const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('tasks');
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const goOffline = () => setIsOffline(true);
        const goOnline = () => { setIsOffline(false); showToast('✓ Back online'); };
        window.addEventListener('offline', goOffline);
        window.addEventListener('online', goOnline);
        return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
    }, []);

    const totalTasks = state.tasks.length;
    const urgentTasks = state.tasks.filter(t => {
        const dl = getDeadlineInfo(t.deadline);
        return (dl.cls === 'urgent' || dl.cls === 'soon') && !isAllDone(t, state.currentUser);
    }).length;
    const doneTasks = state.tasks.filter(t => isAllDone(t, state.currentUser)).length;

    const sortedTasks = [...state.tasks].sort((a, b) => {
        const ad = isAllDone(a, state.currentUser);
        const bd = isAllDone(b, state.currentUser);
        if (ad !== bd) return ad ? 1 : -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

    return (
        <>
            {isOffline && (
                <div style={{ background: 'rgba(255,107,107,0.15)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '10px', padding: '10px 16px', marginBottom: '16px', fontSize: '0.82rem', fontFamily: '"DM Mono", monospace', color: 'var(--accent2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ⚠ You're offline — viewing in read-only mode
                </div>
            )}

            {state.mode === 'group' && (
                <div className="member-summary">
                    <div className="avatar-stack">
                        {state.members.slice(0, 5).map((m, i) => (
                            <div
                                key={i}
                                className="avatar-stack-item"
                                style={{ background: m.color, zIndex: 5 - i }}
                                title={m.name}
                            >
                                {m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                        ))}
                        {state.members.length > 5 && (
                            <div className="avatar-stack-item avatar-stack-more" style={{ zIndex: 0 }}>
                                +{state.members.length - 5}
                            </div>
                        )}
                    </div>
                    <span className="member-count">
                        {state.members.length} {state.members.length === 1 ? 'member' : 'members'}
                    </span>
                </div>
            )}

            <div className="stats-row">
                <div className="stat-card"><div className="stat-val" style={{ color: 'var(--accent)' }}>{totalTasks}</div><div className="stat-label">Total Tasks</div></div>
                <div className="stat-card"><div className="stat-val" style={{ color: 'var(--accent2)' }}>{urgentTasks}</div><div className="stat-label">Due Soon</div></div>
                <div className="stat-card"><div className="stat-val" style={{ color: 'var(--accent3)' }}>{doneTasks}</div><div className="stat-label">Completed</div></div>
                <div className="stat-card"><div className="stat-val" style={{ color: 'var(--warn)' }}>{state.members.length}</div><div className="stat-label">Members</div></div>
            </div>

            {state.mode === 'group' && (
                <div className="tab-bar">
                    <button className={`btn ${activeTab === 'tasks' ? 'active btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('tasks')}>📋 Tasks</button>
                    {hasPermission('view_leaderboard') && (
                        <button className={`btn ${activeTab === 'leaderboard' ? 'active btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('leaderboard')}>🏆 Leaderboard</button>
                    )}
                </div>
            )}

            {activeTab === 'leaderboard' && state.mode === 'group' ? (
                <Leaderboard />
            ) : (
                <>
                    <div className="section-header">
                        <span className="section-title">Assignments</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {state.tasks.length > 0 && hasPermission('export_pdf') && (
                                <button className="btn btn-ghost" onClick={() => exportToPDF(state)}>📄 Export PDF</button>
                            )}
                            {hasPermission('create_task') && (
                                <button className="btn btn-primary" onClick={() => setIsCreatePanelOpen(!isCreatePanelOpen)}>+ New Task</button>
                            )}
                        </div>
                    </div>

                    {isCreatePanelOpen && <CreatePanel onClose={() => setIsCreatePanelOpen(false)} />}

                    <div className="tasks-grid">
                        {sortedTasks.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">📋</div>
                                <div className="empty-title">No tasks yet</div>
                                <div className="empty-sub">
                                    {hasPermission('create_task') ? 'Create the first assignment for your class' : 'Waiting for admin to create tasks'}
                                </div>
                            </div>
                        ) : (
                            sortedTasks.map(t => <TaskCard key={t.id} task={t} />)
                        )}
                    </div>
                </>
            )}
        </>
    );
};

export default Dashboard;

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { initials, formatSize } from '../types';
import type { Task } from '../types';
import { getDeadlineInfo, isAllDone, isNudgeNeeded } from '../utils/helpers';
import { showToast } from './Toast';

const TaskCard: React.FC<{ task: Task }> = ({ task }) => {
    const { state, dispatch, hasPermission, isOwnIdx } = useApp();
    const [showComments, setShowComments] = useState(false);
    const [commentText, setCommentText] = useState('');

    const dl = getDeadlineInfo(task.deadline);
    const done = isAllDone(task, state.currentUser);
    const cc = done ? 'done-card' : dl.cls;
    const up = task.memberProgress[state.currentUser!] || new Array(task.steps.length).fill(false);
    const completedSteps = up.filter(Boolean).length;
    const pct = task.steps.length ? Math.round((completedSteps / task.steps.length) * 100) : 0;

    const doneCount = state.members.filter((_, mi) => {
        const mp = task.memberProgress[mi] || [];
        return mp.length > 0 && mp.every(Boolean);
    }).length;

    const creator = state.members[task.createdBy]?.name || 'Unknown';

    // Permission checks
    const canToggleSteps = isOwnIdx(state.currentUser!) ? hasPermission('toggle_own_steps') : hasPermission('toggle_others_steps');
    const canDelete = hasPermission('delete_task');
    const canComment = hasPermission('add_comment');
    const canUpload = hasPermission('upload_proof');

    const handleAddComment = () => {
        if (!commentText.trim()) return;
        if (!canComment) { showToast('⛔ No permission to comment'); return; }
        dispatch({ type: 'ADD_COMMENT', taskId: task.id, text: commentText.trim() });
        setCommentText('');
        showToast('💬 Comment added');
    };

    const handleProofUpload = () => {
        if (!canUpload) { showToast('⛔ No permission to upload proof'); return; }
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,.pdf';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    dispatch({ type: 'SET_PROOF', taskId: task.id, url: ev.target?.result as string });
                    showToast('📎 Proof attached');
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    };

    const handleToggleStep = (stepIdx: number) => {
        if (!canToggleSteps) {
            showToast('⛔ You can only mark your own steps');
            return;
        }

        // Logic check: cannot click step > 0 if step 0 is not done
        if (stepIdx > 0 && !up[0]) {
            showToast(`⚠ Complete "${task.steps[0]}" first before moving on.`);
            return;
        }

        // Logic check: cannot uncheck step 0 if later steps are checked
        if (stepIdx === 0 && up[0]) {
            if (up.slice(1).some(Boolean)) {
                showToast(`⚠ Uncheck later steps before unmarking "${task.steps[0]}".`);
                return;
            }
        }

        dispatch({ type: 'TOGGLE_STEP', taskId: task.id, stepIdx });
    };

    const handleDelete = () => {
        if (!canDelete) { showToast('⛔ Only admins can delete tasks'); return; }
        dispatch({ type: 'DELETE_TASK', taskId: task.id });
        showToast('Task removed');
    };

    return (
        <div className={`task-card ${cc}`}>
            <div className="task-top">
                <div className="task-title-row">
                    <div className="task-subject">{task.type} · {task.subject || 'General'}</div>
                    <div className="task-name">{task.name}</div>
                    <div className="task-meta">
                        <span className="meta-chip">📅 {new Date(task.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="meta-chip">by {creator}</span>
                        {(task.comments?.length || 0) > 0 && (
                            <span className="meta-chip" style={{ cursor: 'pointer' }} onClick={() => setShowComments(!showComments)}>
                                💬 {task.comments.length}
                            </span>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div className={`deadline-chip ${done ? 'done' : dl.cls}`}>{done ? '✓ Done' : dl.label}</div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={handleProofUpload} title={canUpload ? 'Attach proof' : 'No permission'} disabled={!canUpload}>
                            📎
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowComments(!showComments)} title="Comments">
                            💬
                        </button>
                        {canDelete && (
                            <button className="btn btn-danger" onClick={handleDelete}>Remove</button>
                        )}
                    </div>
                </div>
            </div>

            {task.proofUrl && (
                <div style={{ marginBottom: '12px', padding: '8px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.65rem', fontFamily: '"DM Mono", monospace', color: 'var(--accent3)', textTransform: 'uppercase', marginBottom: '6px' }}>📎 Completion Proof</div>
                    {task.proofUrl.startsWith('data:image') ? (
                        <img src={task.proofUrl} alt="proof" style={{ width: '100%', borderRadius: '8px', maxHeight: '200px', objectFit: 'cover' }} />
                    ) : (
                        <a href={task.proofUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }}>View Attached PDF</a>
                    )}
                </div>
            )}

            {task.attachments && task.attachments.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.65rem', fontFamily: '"DM Mono", monospace', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                        Attachments ({task.attachments.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {task.attachments.map((at, i) => (
                            <a key={i} href={at.url} target="_blank" rel="noreferrer" className="attachment-row" title={`Download ${at.name}`}>
                                <div style={{ fontSize: '1.1rem' }}>
                                    {at.type.includes('image') ? '🖼️' : at.type.includes('pdf') ? '📕' : at.type.includes('presentation') ? '📊' : '📄'}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{at.name}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontFamily: '"DM Mono", monospace' }}>{formatSize(at.size)}</div>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>📥</div>
                            </a>
                        ))}
                    </div>
                </div>
            )}

            <div className="progress-bar-wrap">
                <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
            </div>
            <div className="steps-progress">
                {task.steps.map((s, i) => (
                    <div key={i} className={`progress-step ${up[i] ? 'completed' : ''}`}>
                        <div 
                            style={{ display: 'flex', alignItems: 'center', cursor: canToggleSteps ? 'pointer' : 'not-allowed', zIndex: 2 }}
                            onClick={() => handleToggleStep(i)}
                            title={canToggleSteps ? s : `⛔ Can't modify ${isOwnIdx(state.currentUser!) ? '' : "others'"} steps`}
                        >
                            <div className={`step-circle ${up[i] ? 'done' : ''}`}>
                                {up[i] ? '✓' : i + 1}
                            </div>
                            <span className="step-label">{s}</span>
                        </div>
                    </div>
                ))}
            </div>

            {state.mode === 'group' && (
                <div className="class-progress">
                    <span className="cp-label">CLASS:</span>
                    <div className="cp-avatars">
                        {state.members.map((m, mi) => {
                            const mp = task.memberProgress[mi] || [];
                            const mdone = mp.length > 0 && mp.every(Boolean);
                            const needsNudge = isNudgeNeeded(task, mi);
                            return (
                                <div
                                    key={mi}
                                    className={`cp-avatar ${mdone ? '' : 'incomplete'} ${needsNudge && !mdone ? 'nudge' : ''}`}
                                    style={{ background: m.color }}
                                    title={`${m.name}: ${mdone ? 'Done' : needsNudge ? '⚠ Nudge!' : 'Pending'}`}
                                >
                                    {initials(m.name)}
                                </div>
                            );
                        })}
                    </div>
                    <span className="cp-label" style={{ marginLeft: '4px' }}>{doneCount}/{state.members.length} done</span>
                </div>
            )}

            {/* Comments Section */}
            {showComments && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.72rem', fontFamily: '"DM Mono", monospace', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                        Comments
                    </div>
                    {(task.comments || []).map(c => (
                        <div key={c.id} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-start' }}>
                            <div className="avatar" style={{ background: state.members[c.authorIdx]?.color || 'var(--accent)', width: 20, height: 20, fontSize: '0.55rem', flexShrink: 0 }}>
                                {initials(state.members[c.authorIdx]?.name || '?')}
                            </div>
                            <div>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{state.members[c.authorIdx]?.name || 'Unknown'}</span>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontFamily: '"DM Mono", monospace', marginLeft: '6px' }}>
                                    {new Date(c.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text)', marginTop: '2px' }}>{c.text}</div>
                            </div>
                        </div>
                    ))}
                    {canComment ? (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <input
                                type="text" placeholder="Add a comment..."
                                value={commentText} onChange={e => setCommentText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                                style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem' }}
                            />
                            <button className="btn btn-primary btn-sm" onClick={handleAddComment}>Send</button>
                        </div>
                    ) : (
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: '"DM Mono", monospace' }}>
                            ⛔ You don't have permission to comment
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TaskCard;

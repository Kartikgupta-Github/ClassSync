import React from 'react';
import { useApp } from '../context/AppContext';
import { getLeaderboard } from '../utils/helpers';
import { initials } from '../types';

const Leaderboard: React.FC = () => {
    const { state } = useApp();
    const board = getLeaderboard(state);

    if (board.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-icon">🏆</div>
                <div className="empty-title">No data yet</div>
                <div className="empty-sub">Complete some tasks to see the leaderboard</div>
            </div>
        );
    }

    return (
        <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🏆</div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Leaderboard</h2>
                <p style={{ color: 'var(--muted)', fontFamily: '"DM Mono", monospace', fontSize: '0.8rem' }}>
                    Who completes assignments earliest?
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {board.map((entry, rank) => {
                    const isTop = rank === 0;
                    const isCurrent = entry.idx === state.currentUser;
                    return (
                        <div
                            key={entry.idx}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '14px',
                                background: isTop ? 'rgba(124,107,255,0.08)' : 'var(--card)',
                                border: `1px solid ${isTop ? 'var(--accent)' : isCurrent ? 'rgba(124,107,255,0.3)' : 'var(--border)'}`,
                                borderRadius: '12px', padding: '16px 20px',
                                transition: 'all 0.15s',
                            }}
                        >
                            <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, fontSize: '0.9rem', fontFamily: '"DM Mono", monospace',
                                background: rank === 0 ? 'var(--accent)' : rank === 1 ? 'var(--warn)' : rank === 2 ? 'var(--accent3)' : 'var(--border)',
                                color: rank <= 2 ? '#000' : 'var(--muted)',
                            }}>
                                {rank + 1}
                            </div>

                            <div className="avatar" style={{ background: entry.color, width: 32, height: 32, fontSize: '0.72rem' }}>
                                {initials(entry.name)}
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {entry.name}
                                    {rank === 0 && <span style={{ fontSize: '0.9rem' }}>👑</span>}
                                    {isCurrent && <span style={{ fontSize: '0.65rem', color: 'var(--accent)', fontFamily: '"DM Mono", monospace' }}>YOU</span>}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: '"DM Mono", monospace', marginTop: '2px' }}>
                                    {entry.completed}/{entry.total} completed
                                    {entry.earlyBonus > 0 && <span style={{ color: 'var(--accent3)', marginLeft: '8px' }}>+{entry.earlyBonus}d early</span>}
                                </div>
                            </div>

                            <div style={{
                                fontWeight: 800, fontSize: '1.3rem', fontFamily: '"DM Mono", monospace',
                                color: isTop ? 'var(--accent)' : 'var(--text)',
                            }}>
                                {entry.score}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.72rem', color: 'var(--muted)', fontFamily: '"DM Mono", monospace' }}>
                Score = Tasks Completed × 10 + Days Early × 2
            </div>
        </div>
    );
};

export default Leaderboard;

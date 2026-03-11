import { Task, AppState } from '../types';

export const getDeadlineInfo = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now();
    const hours = diff / 3600000;
    const days = hours / 24;

    if (diff < 0) return { label: 'Overdue', cls: 'overdue' as const };
    if (hours < 48) return { label: Math.ceil(hours) + 'h left', cls: 'urgent' as const };
    if (days < 4) return { label: Math.ceil(days) + 'd left', cls: 'soon' as const };
    return { label: Math.ceil(days) + 'd left', cls: 'ok' as const };
};

export const isAllDone = (task: Task, userIdx: number | null) => {
    if (userIdx === null) return false;
    const p = task.memberProgress[userIdx];
    return p && p.length > 0 && p.every(Boolean);
};

export const isNudgeNeeded = (task: Task, memberIdx: number) => {
    const diff = new Date(task.deadline).getTime() - Date.now();
    const hours = diff / 3600000;
    const p = task.memberProgress[memberIdx];
    const done = p && p.length > 0 && p.every(Boolean);
    return hours > 0 && hours <= 48 && !done;
};

export const getLeaderboard = (state: AppState) => {
    return state.members
        .map((m, idx) => {
            let totalCompleted = 0;
            let totalEarlyMs = 0;

            state.tasks.forEach(t => {
                const p = t.memberProgress[idx];
                if (p && p.length > 0 && p.every(Boolean)) {
                    totalCompleted++;
                    // Reward early completion
                    const daysLeft = (new Date(t.deadline).getTime() - Date.now()) / 86400000;
                    if (daysLeft > 0) totalEarlyMs += daysLeft;
                }
            });

            return {
                name: m.name,
                color: m.color,
                idx,
                completed: totalCompleted,
                total: state.tasks.length,
                earlyBonus: Math.round(totalEarlyMs),
                score: totalCompleted * 10 + Math.round(totalEarlyMs * 2),
            };
        })
        .sort((a, b) => b.score - a.score);
};

export const exportToPDF = (state: AppState) => {
    const pending = state.tasks.filter(t => !isAllDone(t, state.currentUser));

    const html = `
<!DOCTYPE html>
<html><head>
<title>ClassSync - Pending Tasks</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1a1a2e; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  .subtitle { color: #666; font-size: 14px; margin-bottom: 30px; }
  .task { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 12px; page-break-inside: avoid; }
  .task-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .task-name { font-weight: 700; font-size: 16px; }
  .task-deadline { font-size: 13px; color: #e74c3c; }
  .task-subject { font-size: 12px; color: #7c6bff; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .steps { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
  .step { font-size: 13px; padding: 4px 10px; border: 1px solid #ddd; border-radius: 12px; }
  .step.done { background: #d4edda; border-color: #28a745; text-decoration: line-through; }
</style>
</head><body>
<h1>📋 ClassSync — Pending Tasks</h1>
<div class="subtitle">Group: ${state.group || 'Solo'} · ${state.user} · Exported ${new Date().toLocaleDateString('en-IN')}</div>
${pending.map(t => {
        const up = t.memberProgress[state.currentUser!] || new Array(t.steps.length).fill(false);
        return `<div class="task">
    <div class="task-subject">${t.type} · ${t.subject || 'General'}</div>
    <div class="task-header">
      <div class="task-name">${t.name}</div>
      <div class="task-deadline">${new Date(t.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
    </div>
    <div class="steps">${t.steps.map((s, i) => `<span class="step ${up[i] ? 'done' : ''}">${up[i] ? '✓' : '○'} ${s}</span>`).join('')}</div>
  </div>`;
    }).join('')}
${pending.length === 0 ? '<p style="text-align:center;color:#999;padding:40px;">🎉 All tasks completed!</p>' : ''}
</body></html>`;

    const w = window.open('', '_blank');
    if (w) {
        w.document.write(html);
        w.document.close();
        setTimeout(() => w.print(), 500);
    }
};

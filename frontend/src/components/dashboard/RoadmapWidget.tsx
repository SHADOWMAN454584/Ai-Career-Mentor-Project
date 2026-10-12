import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { AnalysisResult } from '../../types/api';
import { request } from '../../lib/api';

const PROGRESS_STORAGE_KEY = 'c2c_roadmap_progress';

interface RoadmapWidgetProps {
  result: AnalysisResult;
  onRefresh?: () => Promise<void>;
}

export function RoadmapWidget({ result, onRefresh }: RoadmapWidgetProps) {
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(PROGRESS_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : {};
      const initial: Record<string, boolean> = { ...parsed };

      result.roadmap.forEach((week) => {
        week.tasks.forEach((task) => {
          if (initial[task.task_id] === undefined) {
            initial[task.task_id] = Boolean(task.completed);
          }
        });
      });
      return initial;
    } catch {
      const initial: Record<string, boolean> = {};
      result.roadmap.forEach((week) => {
        week.tasks.forEach((task) => {
          initial[task.task_id] = Boolean(task.completed);
        });
      });
      return initial;
    }
  });

  // Keep state synced if result updates from backend
  useEffect(() => {
    setCompletedTasks((prev) => {
      const updated = { ...prev };
      result.roadmap.forEach((week) => {
        week.tasks.forEach((task) => {
          if (updated[task.task_id] === undefined) {
            updated[task.task_id] = Boolean(task.completed);
          }
        });
      });
      return updated;
    });
  }, [result]);

  async function handleToggle(taskId: string) {
    const currentStatus = Boolean(completedTasks[taskId]);
    const nextStatus = !currentStatus;

    // 1. Optimistic state update & LocalStorage persistence
    setCompletedTasks((prev) => {
      const next = { ...prev, [taskId]: nextStatus };
      try {
        localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        console.warn('Failed to save roadmap progress to localStorage:', err);
      }
      return next;
    });

    // 2. Background server synchronization
    try {
      await request(`/mentor/roadmap/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: nextStatus }),
      });
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.warn('Backend sync failed, state preserved locally:', err);
    }
  }

  const allTasks = result.roadmap.flatMap((week) => week.tasks);
  const total = allTasks.length;
  const done = allTasks.filter((t) => Boolean(completedTasks[t.task_id])).length;
  const percentage = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <section>
      <div className="section-intro">
        <div>
          <p className="overline">Roadmap Milestones</p>
          <h2>A structured plan you can follow</h2>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="muted" style={{ margin: 0 }}>
            {done} of {total} milestones complete ({percentage}%)
          </p>
          <div
            className="progress-track"
            style={{ width: '160px', height: '6px', marginTop: '8px', marginLeft: 'auto' }}
          >
            <span style={{ width: `${percentage}%` }} />
          </div>
        </div>
      </div>

      <div className="roadmap-list">
        {result.roadmap.map((week) => (
          <article className="week-row" key={week.week_number}>
            <div className="week-index">W{String(week.week_number).padStart(2, '0')}</div>
            <div className="week-content">
              <p className="overline">Focus Area</p>
              <h3>{week.focus_skills.join(' + ') || 'Core Competency'}</h3>

              <div style={{ display: 'grid', gap: '8px' }}>
                {week.tasks.map((task) => {
                  const isDone = Boolean(completedTasks[task.task_id]);
                  return (
                    <label
                      key={task.task_id}
                      htmlFor={`task-check-${task.task_id}`}
                      className={`task ${isDone ? 'done' : ''}`}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      <input
                        type="checkbox"
                        id={`task-check-${task.task_id}`}
                        checked={isDone}
                        aria-label={`Mark milestone "${task.title}" as ${isDone ? 'incomplete' : 'complete'}`}
                        onChange={() => handleToggle(task.task_id)}
                      />
                      <span
                        style={{
                          color: isDone ? 'var(--text-tertiary)' : 'var(--text-main)',
                          textDecoration: isDone ? 'line-through' : 'none',
                          transition: 'color 180ms ease, text-decoration 180ms ease',
                          flex: 1,
                        }}
                      >
                        {task.title}
                      </span>
                      {isDone && (
                        <Check
                          size={14}
                          color="var(--primary-hover)"
                          aria-hidden="true"
                          style={{ marginLeft: 'auto', flexShrink: 0 }}
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

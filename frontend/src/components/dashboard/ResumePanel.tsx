import React, { useState } from 'react';
import { ArrowRight, UploadCloud } from 'lucide-react';

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx'];

const ROLES = [
  'Machine Learning Engineer',
  'Data Scientist',
  'Data Analyst',
  'Backend Developer',
  'Software Development Engineer',
  'Frontend Developer',
  'DevOps Engineer',
  'Business Analyst',
  'AI Engineer',
  'Cloud Engineer',
];

interface ResumePanelProps {
  selectedRole: string;
  setSelectedRole: (role: string) => void;
  weeks: number;
  setWeeks: (weeks: number) => void;
  file: File | null;
  setFile: (file: File | null) => void;
  onSubmit: (e: React.FormEvent) => void;
  status: { type: string; message: string };
}

export function ResumePanel({
  selectedRole,
  setSelectedRole,
  weeks,
  setWeeks,
  file,
  setFile,
  onSubmit,
  status,
}: ResumePanelProps) {
  const isBusy = status.type === 'uploading' || status.type === 'processing';
  const [isDragging, setIsDragging] = useState(false);

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!isBusy) setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isBusy) return;

    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    const name = dropped.name.toLowerCase();
    if (ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      setFile(dropped);
    }
  }

  return (
    <section className="resume-panel">
      <div className="panel-copy">
        <p className="overline">Start here</p>
        <h2>Build your preparation plan</h2>
        <p>Use your latest resume to get a grounded view of role fit, priority gaps, and what to practise next.</p>
      </div>

      <form className="analysis-form" onSubmit={onSubmit}>
        <div className="form-field">
          <label htmlFor="role-select">Target role</label>
          <select
            id="role-select"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="form-control"
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="timeline-select">Timeline</label>
          <select
            id="timeline-select"
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="form-control"
          >
            {[4, 8, 12, 16, 24].map((val) => (
              <option key={val} value={val}>
                {val} weeks
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="resume-file-input">Resume document</label>
          <div
            className={`file-picker-wrapper${isDragging ? ' is-dragging' : ''}${isBusy ? ' is-disabled' : ''}`}
            onDragEnter={handleDragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="resume-file-input"
              accept=".pdf,.docx"
              className="file-input-hidden"
              disabled={isBusy}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <label htmlFor="resume-file-input" className="file-picker-control">
              <UploadCloud size={16} color="currentColor" aria-hidden="true" style={{ flexShrink: 0 }} />
              <span className="file-picker-name">
                {file
                  ? file.name
                  : isDragging
                    ? 'Drop your resume here'
                    : 'Drag & drop or choose PDF/DOCX'}
              </span>
            </label>
          </div>
        </div>

        <div className="form-field form-field-action">
          <span className="form-action-spacer" aria-hidden="true">&nbsp;</span>
          <button
            className="primary-button submit-analysis-btn"
            type="submit"
            disabled={isBusy}
          >
            <span>{isBusy ? 'Analyzing...' : 'Analyse resume'}</span>
            <ArrowRight size={14} color="currentColor" aria-hidden="true" />
          </button>
        </div>
      </form>
    </section>
  );
}

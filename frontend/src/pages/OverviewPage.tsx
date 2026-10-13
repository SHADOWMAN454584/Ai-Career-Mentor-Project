import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnalysisResult, DashboardProgress } from '../types/api';
import { ResumePanel } from '../components/dashboard/ResumePanel';
import { Overview } from '../components/dashboard/Overview';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

interface OverviewPageProps {
  selectedRole: string;
  setSelectedRole: (role: string) => void;
  weeks: number;
  setWeeks: (weeks: number) => void;
  file: File | null;
  setFile: (file: File | null) => void;
  onUploadAndAnalyse: (e: React.FormEvent) => Promise<void>;
  status: { type: string; message: string };
  result: AnalysisResult | null;
  dashboard: DashboardProgress | null;
}

export function OverviewPage({
  selectedRole,
  setSelectedRole,
  weeks,
  setWeeks,
  file,
  setFile,
  onUploadAndAnalyse,
  status,
  result,
  dashboard,
}: OverviewPageProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerUploadClick = () => {
    const input = document.querySelector('.file-picker input') as HTMLInputElement | null;
    input?.click();
  };

  return (
    <>
      <ErrorBoundary fallbackTitle="Resume Analysis Panel Error">
        <ResumePanel
          selectedRole={selectedRole}
          setSelectedRole={setSelectedRole}
          weeks={weeks}
          setWeeks={setWeeks}
          file={file}
          setFile={setFile}
          onSubmit={onUploadAndAnalyse}
          status={status}
        />
      </ErrorBoundary>

      <ErrorBoundary fallbackTitle="Workspace Overview Error">
        <Overview
          selectedRole={selectedRole}
          result={result}
          dashboard={dashboard}
          onNavigateSkills={() => navigate('/skills')}
          onNavigateMentor={() => navigate('/mentor')}
          onNavigatePlacement={() => navigate('/placement')}
          onTriggerUpload={triggerUploadClick}
        />
      </ErrorBoundary>
    </>
  );
}

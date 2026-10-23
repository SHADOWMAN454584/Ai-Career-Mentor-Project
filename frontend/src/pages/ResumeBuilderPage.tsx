import React, { useEffect, useState } from 'react';
import { Download, FilePlus2, Sparkles, Trash2, ArrowUp, ArrowDown, Save, Plus, Check } from 'lucide-react';
import { downloadResumePdf, request } from '../lib/api';
import {
  ResumeCertificationItem,
  ResumeContent,
  ResumeDraft,
  ResumeEducationItem,
  ResumeExperienceItem,
  ResumeProjectItem,
} from '../types/api';

const emptyEducation = (): ResumeEducationItem => ({ institution: '', degree: '', specialization: '', dates: '', grade: '', coursework: '' });
const emptyProject = (): ResumeProjectItem => ({ name: '', description: '', technologies: [], contributions: [], results: [] });
const emptyExperience = (): ResumeExperienceItem => ({ company: '', title: '', location: '', dates: '', bullets: [] });
const emptyCertification = (): ResumeCertificationItem => ({ name: '', issuer: '', date: '' });

type BuilderSection = 'summary' | 'project' | 'experience' | 'skills';

interface GenerationResponse {
  content: string | string[];
  project_results?: string[] | null;
  warnings?: string[];
  provider: string;
  demo: boolean;
}

interface PendingSuggestion {
  key: string;
  section: BuilderSection;
  index?: number;
  content: string | string[];
  projectResults?: string[];
  provider: string;
  demo: boolean;
  warnings: string[];
}

interface SkillSuggestion {
  skill: string;
  reason: string;
}

function asList(value: string | string[]): string[] {
  if (Array.isArray(value)) return value;
  return value.trim() ? [value.trim()] : [];
}

function hasProjectFacts(item: ResumeProjectItem): boolean {
  return Boolean(item.description.trim() || item.technologies.length || item.contributions.some((bullet) => bullet.trim()) || item.results.some((bullet) => bullet.trim()));
}

function hasExperienceFacts(item: ResumeExperienceItem): boolean {
  return Boolean(item.company.trim() || item.title.trim() || item.bullets.some((bullet) => bullet.trim()));
}

function hasEducationFacts(item: ResumeEducationItem): boolean {
  return Boolean(item.institution.trim() || item.degree.trim() || item.specialization.trim() || item.coursework.trim());
}

function hasCertificationFacts(item: ResumeCertificationItem): boolean {
  return Boolean(item.name.trim() || item.issuer.trim() || item.date.trim());
}

const emptyContent = (targetRole: string): ResumeContent => ({
  personal: { full_name: '', email: '', phone: '', location: '', linkedin_url: '', github_url: '', portfolio_url: '' },
  target_role: targetRole,
  summary: '',
  education: [],
  skills: [],
  projects: [],
  experience: [],
  certifications: [],
  achievements: [],
  activities: [],
  job_description: '',
});

interface ResumeBuilderPageProps {
  targetRole: string;
}

export function ResumeBuilderPage({ targetRole }: ResumeBuilderPageProps) {
  const [title, setTitle] = useState('My Resume');
  const [template, setTemplate] = useState<'classic' | 'modern'>('classic');
  const [content, setContent] = useState<ResumeContent>(() => emptyContent(targetRole));
  const [status, setStatus] = useState('Start with the facts. You can generate and edit each section separately.');
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState('');
  const [suggestion, setSuggestion] = useState<PendingSuggestion | null>(null);
  const [skillSuggestions, setSkillSuggestions] = useState<SkillSuggestion[]>([]);
  const [suggestBusy, setSuggestBusy] = useState(false);

  useEffect(() => {
    setSuggestion(null);
    setSkillSuggestions([]);
    request<ResumeDraft>('/resume-builder/draft')
      .then((draft) => {
        setTitle(draft.title);
        setTemplate(draft.template);
        setContent({ ...draft.content, target_role: draft.content.target_role || targetRole });
        setStatus(`Draft restored from ${new Date(draft.updated_at).toLocaleString()}.`);
      })
      .catch(() => setContent(emptyContent(targetRole)));
  }, [targetRole]);

  function updateContent(patch: Partial<ResumeContent>) {
    setContent((current) => ({ ...current, ...patch }));
  }

  function updatePersonal(field: keyof ResumeContent['personal'], value: string) {
    setContent((current) => ({ ...current, personal: { ...current.personal, [field]: value } }));
  }

  function updateListItem<T>(key: 'education' | 'projects' | 'experience' | 'certifications', index: number, patch: Partial<T>) {
    setContent((current) => ({ ...current, [key]: current[key].map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) } as ResumeContent));
  }

  function removeListItem(key: 'education' | 'projects' | 'experience' | 'certifications', index: number) {
    setSuggestion(null);
    setContent((current) => ({ ...current, [key]: current[key].filter((_, itemIndex) => itemIndex !== index) } as ResumeContent));
  }

  function moveListItem(key: 'education' | 'projects' | 'experience' | 'certifications', index: number, direction: -1 | 1) {
    setSuggestion(null);
    setContent((current) => {
      const items = [...current[key]];
      const next = index + direction;
      if (next < 0 || next >= items.length) return current;
      [items[index], items[next]] = [items[next], items[index]];
      return { ...current, [key]: items } as ResumeContent;
    });
  }

  async function saveDraft() {
    setBusy(true);
    try {
      await request<ResumeDraft>('/resume-builder/draft', { method: 'PUT', body: JSON.stringify({ title, template, content }) });
      setStatus(`Draft saved at ${new Date().toLocaleTimeString()}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save draft.');
    } finally {
      setBusy(false);
    }
  }

  async function generate(section: BuilderSection, index?: number) {
    const selected =
      section === 'project'
        ? content.projects[index ?? 0]
        : section === 'experience'
          ? content.experience[index ?? 0]
          : section === 'skills'
            ? { skills: content.skills }
            : content;

    if (!selected) return;

    setBusy(true);
    try {
      const response = await request<GenerationResponse>('/resume-builder/generate', {
        method: 'POST',
        body: JSON.stringify({
          section,
          content: selected,
          target_role: content.target_role,
          job_description: content.job_description,
        }),
      });
      setProvider(response.provider);
      setSuggestion({
        key: `${section}-${index ?? 'all'}-${Date.now()}`,
        section,
        index,
        content: response.content,
        projectResults: response.project_results || undefined,
        provider: response.provider,
        demo: response.demo,
        warnings: response.warnings || [],
      });
      setStatus('Suggestion ready. Review it below, then accept or discard.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Generation failed.');
    } finally {
      setBusy(false);
    }
  }

  function acceptSuggestion() {
    if (!suggestion) return;
    const { section, index } = suggestion;
    if (section === 'summary') {
      updateContent({ summary: Array.isArray(suggestion.content) ? suggestion.content.join(' ') : suggestion.content });
    }
    if (section === 'skills') {
      updateContent({ skills: asList(suggestion.content) });
    }
    if (section === 'project' && index !== undefined) {
      updateListItem<ResumeProjectItem>('projects', index, {
        contributions: asList(suggestion.content),
        results: suggestion.projectResults ?? content.projects[index]?.results ?? [],
      });
    }
    if (section === 'experience' && index !== undefined) {
      updateListItem<ResumeExperienceItem>('experience', index, { bullets: asList(suggestion.content) });
    }
    setStatus('Suggestion accepted. Verify every line before exporting.');
    setSuggestion(null);
  }

  function discardSuggestion() {
    setSuggestion(null);
    setStatus('Suggestion discarded. Your original text is unchanged.');
  }

  async function suggestSkills() {
    setSuggestBusy(true);
    try {
      const response = await request<{ suggestions: SkillSuggestion[]; provider: string; demo: boolean }>(
        '/resume-builder/suggest-skills',
        {
          method: 'POST',
          body: JSON.stringify({
            target_role: content.target_role,
            current_skills: content.skills,
            job_description: content.job_description,
          }),
        }
      );
      setSkillSuggestions(response.suggestions);
      setStatus(
        response.suggestions.length
          ? 'Suggestions are unverified. Add only the skills you can genuinely support.'
          : 'No missing role skills found. Your current list already covers the catalog.'
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not fetch skill suggestions.');
    } finally {
      setSuggestBusy(false);
    }
  }

  function addSuggestedSkill(skill: string) {
    setContent((current) => ({
      ...current,
      skills: current.skills.some((existing) => existing.toLowerCase() === skill.toLowerCase())
        ? current.skills
        : [...current.skills, skill],
    }));
    setSkillSuggestions((current) => current.filter((item) => item.skill !== skill));
    setStatus(`Added ${skill}. Keep it only if the claim is factual.`);
  }

  async function exportPdf() {
    setBusy(true);
    try {
      const blob = await downloadResumePdf({ title, template, content });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${content.personal.full_name || 'resume'}-resume.pdf`.replace(/\s+/g, '-');
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus('PDF exported from the current edited content.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'PDF export failed.');
    } finally {
      setBusy(false);
    }
  }

  const hasSummaryFacts = Boolean(
    content.summary.trim() ||
    content.skills.length ||
    content.education.some(hasEducationFacts) ||
    content.projects.some(hasProjectFacts) ||
    content.experience.some(hasExperienceFacts) ||
    content.certifications.some(hasCertificationFacts) ||
    content.achievements.some((item) => item.trim()) ||
    content.activities.some((item) => item.trim())
  );

  const input = (label: string, value: string, onChange: (value: string) => void, placeholder = '') => (
    <label className="builder-field">{label}<input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>
  );

  return (
    <section className="resume-builder">
      <div className="section-intro builder-intro">
        <div><p className="overline">Resume studio</p><h2>Build a resume that stays yours.</h2></div>
        <p className="muted">Enter evidence first. AI can sharpen the language, but it cannot add facts you did not provide.</p>
      </div>

      <div className="builder-toolbar">
        {input('Draft name', title, setTitle, 'My Resume')}
        <label className="builder-field">Template<select value={template} onChange={(event) => setTemplate(event.target.value as 'classic' | 'modern')}><option value="classic">Classic ATS</option><option value="modern">Modern ATS</option></select></label>
        <button className="secondary-button" type="button" onClick={saveDraft} disabled={busy}><Save size={15} /> Save draft</button>
        <button className="primary-button" type="button" onClick={exportPdf} disabled={busy}><Download size={15} /> Download PDF</button>
      </div>
      <p className="builder-status">{status}{provider ? ` Provider: ${provider}.` : ''}</p>

      <div className="builder-layout">
        <div className="builder-editor">
          <section className="builder-section"><div className="builder-section-heading"><div><p className="overline">01</p><h3>Personal information</h3></div></div><div className="builder-grid">{input('Full name', content.personal.full_name, (value) => updatePersonal('full_name', value))}{input('Email', content.personal.email, (value) => updatePersonal('email', value))}{input('Phone', content.personal.phone, (value) => updatePersonal('phone', value))}{input('Location', content.personal.location, (value) => updatePersonal('location', value))}{input('LinkedIn URL', content.personal.linkedin_url, (value) => updatePersonal('linkedin_url', value))}{input('GitHub URL', content.personal.github_url, (value) => updatePersonal('github_url', value))}{input('Portfolio URL', content.personal.portfolio_url, (value) => updatePersonal('portfolio_url', value))}{input('Target role', content.target_role, (value) => updateContent({ target_role: value }))}</div></section>

          <section className="builder-section"><div className="builder-section-heading"><div><p className="overline">02</p><h3>Professional summary</h3></div><button className="text-button" type="button" onClick={() => generate('summary')} disabled={busy || !hasSummaryFacts} title={hasSummaryFacts ? '' : 'Add skills, education, projects, or experience first'}><Sparkles size={14} /> Generate / improve</button></div><textarea className="builder-textarea" value={content.summary} onChange={(event) => updateContent({ summary: event.target.value })} placeholder="A concise, factual introduction to your strengths and direction." />{suggestion?.section === 'summary' && <SuggestionPreview suggestion={suggestion} onAccept={acceptSuggestion} onDiscard={discardSuggestion} />}<label className="builder-field"><span>Optional job description for tailoring</span><textarea value={content.job_description} onChange={(event) => updateContent({ job_description: event.target.value })} placeholder="Paste a job description as reference text." /></label></section>

          <BuilderList title="Education" items={content.education} onAdd={() => updateContent({ education: [...content.education, emptyEducation()] })} renderItem={(item, index) => <div className="builder-entry" key={`education-${index}`}><div className="builder-entry-actions"><strong>Education {index + 1}</strong><EntryActions onUp={() => moveListItem('education', index, -1)} onDown={() => moveListItem('education', index, 1)} onRemove={() => removeListItem('education', index)} /></div><div className="builder-grid">{input('Institution', item.institution, (value) => updateListItem<ResumeEducationItem>('education', index, { institution: value }))}{input('Degree', item.degree, (value) => updateListItem<ResumeEducationItem>('education', index, { degree: value }))}{input('Specialization', item.specialization, (value) => updateListItem<ResumeEducationItem>('education', index, { specialization: value }))}{input('Dates', item.dates, (value) => updateListItem<ResumeEducationItem>('education', index, { dates: value }))}{input('Grade', item.grade, (value) => updateListItem<ResumeEducationItem>('education', index, { grade: value }))}{input('Relevant coursework', item.coursework, (value) => updateListItem<ResumeEducationItem>('education', index, { coursework: value }))}</div></div>} />

          <section className="builder-section"><div className="builder-section-heading"><div><p className="overline">03</p><h3>Technical skills</h3></div><div className="builder-heading-actions"><button className="text-button" type="button" onClick={() => generate('skills')} disabled={busy || !content.skills.length} title={content.skills.length ? '' : 'Add at least one skill first'}><Sparkles size={14} /> Clean skills</button><button className="text-button" type="button" onClick={suggestSkills} disabled={suggestBusy || busy}><Sparkles size={14} /> {suggestBusy ? 'Suggesting...' : 'Suggest missing skills'}</button></div></div><textarea className="builder-textarea" value={content.skills.join(', ')} onChange={(event) => updateContent({ skills: event.target.value.split(',').map((skill) => skill.trim()).filter(Boolean) })} placeholder="Python, SQL, React, Figma" />{suggestion?.section === 'skills' && <SuggestionPreview suggestion={suggestion} onAccept={acceptSuggestion} onDiscard={discardSuggestion} />}{skillSuggestions.length > 0 && <div className="builder-suggestions"><p className="builder-suggestions-title">Unverified role suggestions</p>{skillSuggestions.map((item) => <div className="builder-suggestion-row" key={item.skill}><div><strong>{item.skill}</strong><p>{item.reason}</p></div><button className="text-button" type="button" onClick={() => addSuggestedSkill(item.skill)}><Plus size={13} /> Add</button></div>)}</div>}</section>

          <BuilderList title="Experience & internships" items={content.experience} onAdd={() => updateContent({ experience: [...content.experience, emptyExperience()] })} renderItem={(item, index) => <div className="builder-entry" key={`experience-${index}`}><div className="builder-entry-actions"><strong>Experience {index + 1}</strong><EntryActions onUp={() => moveListItem('experience', index, -1)} onDown={() => moveListItem('experience', index, 1)} onRemove={() => removeListItem('experience', index)} /></div><div className="builder-grid">{input('Company', item.company, (value) => updateListItem<ResumeExperienceItem>('experience', index, { company: value }))}{input('Title', item.title, (value) => updateListItem<ResumeExperienceItem>('experience', index, { title: value }))}{input('Location', item.location, (value) => updateListItem<ResumeExperienceItem>('experience', index, { location: value }))}{input('Dates', item.dates, (value) => updateListItem<ResumeExperienceItem>('experience', index, { dates: value }))}</div><textarea className="builder-textarea" value={item.bullets.join('\n')} onChange={(event) => updateListItem<ResumeExperienceItem>('experience', index, { bullets: event.target.value.split('\n') })} placeholder="One responsibility or outcome per line." /><button className="text-button" type="button" onClick={() => generate('experience', index)} disabled={busy || !hasExperienceFacts(item)}><Sparkles size={14} /> Improve bullets</button>{suggestion?.section === 'experience' && suggestion.index === index && <SuggestionPreview suggestion={suggestion} onAccept={acceptSuggestion} onDiscard={discardSuggestion} />}</div>} />

          <BuilderList title="Projects" items={content.projects} onAdd={() => updateContent({ projects: [...content.projects, emptyProject()] })} renderItem={(item, index) => <div className="builder-entry" key={`project-${index}`}><div className="builder-entry-actions"><strong>Project {index + 1}</strong><EntryActions onUp={() => moveListItem('projects', index, -1)} onDown={() => moveListItem('projects', index, 1)} onRemove={() => removeListItem('projects', index)} /></div><div className="builder-grid">{input('Project name', item.name, (value) => updateListItem<ResumeProjectItem>('projects', index, { name: value }))}{input('Technologies', item.technologies.join(', '), (value) => updateListItem<ResumeProjectItem>('projects', index, { technologies: value.split(',').map((tech) => tech.trim()).filter(Boolean) }))}</div><textarea className="builder-textarea" value={item.description} onChange={(event) => updateListItem<ResumeProjectItem>('projects', index, { description: event.target.value })} placeholder="What the project does, using only your facts." /><textarea className="builder-textarea" value={item.contributions.join('\n')} onChange={(event) => updateListItem<ResumeProjectItem>('projects', index, { contributions: event.target.value.split('\n') })} placeholder="Your contribution, one line per bullet." /><textarea className="builder-textarea" value={item.results.join('\n')} onChange={(event) => updateListItem<ResumeProjectItem>('projects', index, { results: event.target.value.split('\n') })} placeholder="Measured results you can support, one line per bullet." /><button className="text-button" type="button" onClick={() => generate('project', index)} disabled={busy || !hasProjectFacts(item)}><Sparkles size={14} /> Rewrite bullets</button>{suggestion?.section === 'project' && suggestion.index === index && <SuggestionPreview suggestion={suggestion} onAccept={acceptSuggestion} onDiscard={discardSuggestion} />}</div>} />

          <BuilderList title="Certifications" items={content.certifications} onAdd={() => updateContent({ certifications: [...content.certifications, emptyCertification()] })} renderItem={(item, index) => <div className="builder-entry" key={`certification-${index}`}><div className="builder-entry-actions"><strong>Certification {index + 1}</strong><EntryActions onUp={() => moveListItem('certifications', index, -1)} onDown={() => moveListItem('certifications', index, 1)} onRemove={() => removeListItem('certifications', index)} /></div><div className="builder-grid">{input('Name', item.name, (value) => updateListItem<ResumeCertificationItem>('certifications', index, { name: value }))}{input('Issuer', item.issuer, (value) => updateListItem<ResumeCertificationItem>('certifications', index, { issuer: value }))}{input('Date', item.date, (value) => updateListItem<ResumeCertificationItem>('certifications', index, { date: value }))}</div></div>} />

          <SimpleLines title="Achievements" value={content.achievements} onChange={(value) => updateContent({ achievements: value })} /><SimpleLines title="Leadership & activities" value={content.activities} onChange={(value) => updateContent({ activities: value })} />
        </div>

        <ResumePreview content={content} template={template} />
      </div>
    </section>
  );
}

function SuggestionPreview({ suggestion, onAccept, onDiscard }: { suggestion: PendingSuggestion; onAccept: () => void; onDiscard: () => void }) {
  const bullets = asList(suggestion.content);
  return (
    <div className="builder-suggestion">
      <div className="builder-suggestion-head">
        <div>
          <p className="overline">AI suggestion</p>
          <strong>{suggestion.provider}{suggestion.demo ? ' · demo' : ''}</strong>
        </div>
        <div className="builder-suggestion-actions">
          <button className="primary-button builder-suggestion-accept" type="button" onClick={onAccept}><Check size={13} /> Accept</button>
          <button className="text-button" type="button" onClick={onDiscard}>Discard</button>
        </div>
      </div>
      {Array.isArray(suggestion.content) ? (
        <ul className="builder-suggestion-list">{bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}</ul>
      ) : (
        <p className="builder-suggestion-text">{suggestion.content || 'No factual content was available to improve.'}</p>
      )}
      {suggestion.projectResults && suggestion.projectResults.length > 0 && (
        <div className="builder-suggestion-results">
          <span>Results</span>
          <ul className="builder-suggestion-list">{suggestion.projectResults.map((result, index) => <li key={index}>{result}</li>)}</ul>
        </div>
      )}
      {suggestion.warnings.map((warning, index) => <p className="builder-warning" key={index}>{warning}</p>)}
      <p className="builder-suggestion-note">AI only rephrases your facts. Verify every line before accepting.</p>
    </div>
  );
}

function EntryActions({ onUp, onDown, onRemove }: { onUp: () => void; onDown: () => void; onRemove: () => void }) {
  return <div className="entry-actions"><button type="button" aria-label="Move entry up" onClick={onUp}><ArrowUp size={13} /></button><button type="button" aria-label="Move entry down" onClick={onDown}><ArrowDown size={13} /></button><button type="button" aria-label="Remove entry" onClick={onRemove}><Trash2 size={13} /></button></div>;
}

function BuilderList<T>({ title, items, onAdd, renderItem }: { title: string; items: T[]; onAdd: () => void; renderItem: (item: T, index: number) => React.ReactNode }) {
  return <section className="builder-section"><div className="builder-section-heading"><div><p className="overline">Section</p><h3>{title}</h3></div><button className="text-button" type="button" onClick={onAdd}><FilePlus2 size={14} /> Add entry</button></div>{items.map(renderItem)}{!items.length && <p className="builder-empty">No entries yet. Add one when you have factual details to include.</p>}</section>;
}

function SimpleLines({ title, value, onChange }: { title: string; value: string[]; onChange: (value: string[]) => void }) {
  return <section className="builder-section"><div className="builder-section-heading"><div><p className="overline">Section</p><h3>{title}</h3></div></div><textarea className="builder-textarea" value={value.join('\n')} onChange={(event) => onChange(event.target.value.split('\n'))} placeholder="One item per line." /></section>;
}

function ResumePreview({ content, template }: { content: ResumeContent; template: 'classic' | 'modern' }) {
  const { personal } = content;
  return <aside className={`resume-preview ${template}`}><div className="preview-paper"><header><h1>{personal.full_name || 'Your Name'}</h1><p>{[personal.email, personal.phone, personal.location].filter(Boolean).join(' | ') || 'Contact details will appear here'}</p><p>{[personal.linkedin_url, personal.github_url, personal.portfolio_url].filter(Boolean).join(' | ')}</p></header><PreviewSection title="Summary" visible={Boolean(content.summary)}><p>{content.summary}</p></PreviewSection><PreviewSection title="Skills" visible={content.skills.length > 0}><p>{content.skills.join(' | ')}</p></PreviewSection><PreviewSection title="Experience" visible={content.experience.length > 0}>{content.experience.map((item, index) => <div className="preview-entry" key={index}><strong>{item.title || 'Role'}{item.company ? ` - ${item.company}` : ''}</strong><small>{item.dates}</small><ul>{item.bullets.filter(Boolean).map((bullet, bulletIndex) => <li key={bulletIndex}>{bullet}</li>)}</ul></div>)}</PreviewSection><PreviewSection title="Projects" visible={content.projects.length > 0}>{content.projects.map((item, index) => <div className="preview-entry" key={index}><strong>{item.name || 'Project'}{item.technologies.length ? ` | ${item.technologies.join(', ')}` : ''}</strong><p>{item.description}</p><ul>{[...item.contributions, ...item.results].filter(Boolean).map((bullet, bulletIndex) => <li key={bulletIndex}>{bullet}</li>)}</ul></div>)}</PreviewSection><PreviewSection title="Education" visible={content.education.length > 0}>{content.education.map((item, index) => <div className="preview-entry" key={index}><strong>{item.degree || 'Degree'}{item.institution ? ` - ${item.institution}` : ''}</strong><small>{[item.specialization, item.dates, item.grade].filter(Boolean).join(' | ')}</small></div>)}</PreviewSection><PreviewSection title="Certifications" visible={content.certifications.length > 0}><ul>{content.certifications.map((item, index) => <li key={index}>{[item.name, item.issuer, item.date].filter(Boolean).join(' - ')}</li>)}</ul></PreviewSection><PreviewSection title="Achievements" visible={content.achievements.some(Boolean)}><ul>{content.achievements.filter(Boolean).map((item, index) => <li key={index}>{item}</li>)}</ul></PreviewSection><PreviewSection title="Leadership & Activities" visible={content.activities.some(Boolean)}><ul>{content.activities.filter(Boolean).map((item, index) => <li key={index}>{item}</li>)}</ul></PreviewSection></div></aside>;
}

function PreviewSection({ title, visible, children }: { title: string; visible: boolean; children: React.ReactNode }) {
  return visible ? <section><h2>{title}</h2>{children}</section> : null;
}
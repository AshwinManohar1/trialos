'use client';

import { useCallback, useRef, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { api } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ActivityTask {
  id: number;
  name: string;
}

interface StudyInfo {
  protocol_id: string;
  drug_name: string;
  num_periods: number | null;
  num_subjects: number | null;
}

interface ParseResult {
  tasks: ActivityTask[];
  study_info: StudyInfo;
  logo_b64: string | null;
  parse_method: 'rules' | 'ai_fallback';
  warning: string | null;
  task_count: number;
}

type PageState = 'upload' | 'processing' | 'result';

// ─── Processing steps ──────────────────────────────────────────────────────

const STEPS = [
  { label: 'Extracting sections', ms: 800 },
  { label: 'Parsing timepoints', ms: 1400 },
  { label: 'Assembling task list', ms: 800 },
];

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function ActivityPage() {
  const [pageState, setPageState] = useState<PageState>('upload');
  const [step, setStep] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<ParseResult | null>(null);
  const [tasks, setTasks] = useState<ActivityTask[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newTaskName, setNewTaskName] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  // ── Upload & parse ──────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are accepted.');
      return;
    }

    setError(null);
    setPageState('processing');
    setStep(0);

    // Animate steps while waiting for API
    let s = 0;
    const interval = setInterval(() => {
      s += 1;
      if (s < STEPS.length) setStep(s);
    }, 900);

    try {
      const data = await api.parseActivity(file);
      clearInterval(interval);
      setStep(STEPS.length - 1);

      if (data.detail) {
        setError(data.detail);
        setPageState('upload');
        return;
      }

      setResult(data);
      setTasks(data.tasks);
      setPageState('result');
    } catch (e: unknown) {
      clearInterval(interval);
      const msg = (e as { detail?: string })?.detail || 'Parsing failed. Please try again.';
      setError(msg);
      setPageState('upload');
    }
  }, []);

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  // ── Task editing ────────────────────────────────────────────────────────

  function startEdit(task: ActivityTask) {
    setEditingId(task.id);
    setEditValue(task.name);
  }

  function commitEdit(id: number) {
    const trimmed = editValue.trim();
    if (trimmed) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, name: trimmed } : t));
    }
    setEditingId(null);
    setEditValue('');
  }

  function deleteTask(id: number) {
    setTasks(prev => {
      const filtered = prev.filter(t => t.id !== id);
      return filtered.map((t, i) => ({ ...t, id: i + 1 }));
    });
  }

  function addTask() {
    const trimmed = newTaskName.trim();
    if (!trimmed) return;
    const newId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
    setTasks(prev => [...prev, { id: newId, name: trimmed }]);
    setNewTaskName('');
    setAddingTask(false);
  }

  // ── Download ────────────────────────────────────────────────────────────

  async function handleDownload() {
    if (!result || downloading) return;
    setDownloading(true);
    try {
      const blob = await api.exportActivity(tasks, result.study_info, result.logo_b64);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.study_info.protocol_id || 'activity'}_task_list.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('PDF generation failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  function reset() {
    setPageState('upload');
    setResult(null);
    setTasks([]);
    setError(null);
    setStep(0);
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <TopBar crumbs={[{ label: 'Activity Task List' }]} />

      <main className="content-area flex-1">
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 24px 60px' }}>

          {/* Page header */}
          <div className="flex items-center justify-between mb-5" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
                Activity Task List Generator
              </h1>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
                Upload a Cliantha protocol PDF to extract the ordered task list
              </p>
            </div>
            {pageState === 'result' && (
              <button
                onClick={reset}
                style={{
                  fontSize: 12,
                  color: 'var(--text-3)',
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  padding: '5px 12px',
                  cursor: 'pointer',
                }}
              >
                ← New Upload
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div
              className="mb-4 px-4 py-3 text-sm fade-in"
              style={{
                background: 'var(--critical-bg)',
                border: '1px solid var(--critical-border)',
                borderRadius: 3,
                color: 'var(--critical)',
              }}
            >
              {error}
            </div>
          )}

          {/* ── State: Upload ── */}
          {pageState === 'upload' && (
            <div
              className={`upload-zone fade-in ${dragOver ? 'drag-over' : ''}`}
              style={{
                borderRadius: 4,
                padding: '64px 40px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--surface)',
              }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={onInputChange}
              />

              {/* Icon */}
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 6,
                  background: 'var(--teal-light)',
                  border: '1px solid rgba(15,123,108,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12h6M12 9v6" stroke="var(--teal)" strokeWidth="1.8" strokeLinecap="round" />
                  <path
                    d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                    stroke="var(--teal)"
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <path d="M14 2v6h6" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>

              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                Drop protocol PDF here or click to browse
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Supports Cliantha BE protocol PDFs · Task list ready in ~5 seconds
              </p>
            </div>
          )}

          {/* ── State: Processing ── */}
          {pageState === 'processing' && (
            <div
              className="fade-in"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '56px 40px',
                textAlign: 'center',
              }}
            >
              <div
                className="animate-spin"
                style={{
                  width: 32,
                  height: 32,
                  border: '3px solid var(--border)',
                  borderTop: '3px solid var(--teal)',
                  borderRadius: '50%',
                  margin: '0 auto 24px',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                {STEPS.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2"
                    style={{ opacity: i <= step ? 1 : 0.3, transition: 'opacity 0.3s' }}
                  >
                    <span style={{ fontSize: 13, color: i <= step ? 'var(--teal)' : 'var(--text-3)', fontWeight: i === step ? 600 : 400 }}>
                      {i < step ? '✓' : i === step ? '⟳' : '○'}
                    </span>
                    <span style={{ fontSize: 13, color: i <= step ? 'var(--text)' : 'var(--text-3)' }}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── State: Result ── */}
          {pageState === 'result' && result && (
            <div className="fade-in">

              {/* Warning banner (AI fallback) */}
              {result.warning && (
                <div
                  className="mb-4 px-4 py-3 text-sm"
                  style={{
                    background: 'var(--warning-bg)',
                    border: '1px solid var(--warning-border)',
                    borderLeft: '3px solid var(--warning)',
                    borderRadius: 3,
                    color: 'var(--warning)',
                  }}
                >
                  ⚠ {result.warning}
                </div>
              )}

              {/* Study info strip + download button */}
              <div
                className="flex items-center justify-between mb-4"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '10px 16px',
                }}
              >
                <div className="flex items-center gap-4 flex-wrap">
                  {result.study_info.protocol_id && (
                    <span className="font-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)' }}>
                      {result.study_info.protocol_id}
                    </span>
                  )}
                  {result.study_info.drug_name && (
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      {result.study_info.drug_name}
                    </span>
                  )}
                  {result.study_info.num_periods && (
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {result.study_info.num_periods} periods
                    </span>
                  )}
                  {result.study_info.num_subjects && (
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {result.study_info.num_subjects} subjects
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text-3)',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                      padding: '1px 6px',
                    }}
                  >
                    {tasks.length} tasks
                  </span>
                </div>

                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 16px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'white',
                    background: downloading ? 'var(--teal-light)' : 'var(--teal)',
                    border: 'none',
                    borderRadius: 3,
                    cursor: downloading ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {downloading ? (
                    <>
                      <span
                        className="animate-spin"
                        style={{
                          display: 'inline-block',
                          width: 12,
                          height: 12,
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderTop: '2px solid white',
                          borderRadius: '50%',
                        }}
                      />
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M6.5 1v8M3.5 6.5L6.5 9l3-2.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M1.5 11h10" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                      Download PDF
                    </>
                  )}
                </button>
              </div>

              {/* Task table */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                {/* Table header */}
                <div
                  className="flex items-center"
                  style={{
                    background: 'var(--navy)',
                    padding: '8px 16px',
                    gap: 16,
                  }}
                >
                  <span style={{ width: 32, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', flexShrink: 0, textAlign: 'center' }}>
                    #
                  </span>
                  <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
                    TASK / ASSESSMENT
                  </span>
                  <span style={{ width: 40, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
                    ✓
                  </span>
                </div>

                {/* Task rows */}
                {tasks.map((task, idx) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    index={idx}
                    isEditing={editingId === task.id}
                    editValue={editValue}
                    onStartEdit={() => startEdit(task)}
                    onEditChange={setEditValue}
                    onCommitEdit={() => commitEdit(task.id)}
                    onDelete={() => deleteTask(task.id)}
                  />
                ))}

                {/* Add task row */}
                <div
                  style={{
                    borderTop: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                  }}
                >
                  {addingTask ? (
                    <div className="flex items-center gap-3" style={{ padding: '8px 16px' }}>
                      <span style={{ width: 32, fontSize: 12, color: 'var(--text-3)', textAlign: 'center', flexShrink: 0 }}>
                        {tasks.length + 1}
                      </span>
                      <input
                        autoFocus
                        value={newTaskName}
                        onChange={e => setNewTaskName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') addTask();
                          if (e.key === 'Escape') { setAddingTask(false); setNewTaskName(''); }
                        }}
                        placeholder="Task name..."
                        style={{
                          flex: 1,
                          fontSize: 13,
                          border: '1px solid var(--teal)',
                          borderRadius: 3,
                          padding: '4px 8px',
                          color: 'var(--text)',
                          background: 'var(--surface)',
                          boxShadow: '0 0 0 2px rgba(15,123,108,0.15)',
                        }}
                      />
                      <button
                        onClick={addTask}
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'white',
                          background: 'var(--teal)',
                          border: 'none',
                          borderRadius: 3,
                          padding: '4px 12px',
                          cursor: 'pointer',
                        }}
                      >
                        Add
                      </button>
                      <button
                        onClick={() => { setAddingTask(false); setNewTaskName(''); }}
                        style={{
                          fontSize: 12,
                          color: 'var(--text-3)',
                          background: 'none',
                          border: '1px solid var(--border)',
                          borderRadius: 3,
                          padding: '4px 10px',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingTask(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '9px 16px',
                        width: '100%',
                        fontSize: 12,
                        color: 'var(--text-3)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
                      Add task
                    </button>
                  )}
                </div>
              </div>

              {/* Hint */}
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, textAlign: 'center' }}>
                Click any task to rename · Hover to delete · Add tasks at the bottom
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


// ─── Task Row Component ────────────────────────────────────────────────────

function TaskRow({
  task,
  index,
  isEditing,
  editValue,
  onStartEdit,
  onEditChange,
  onCommitEdit,
  onDelete,
}: {
  task: ActivityTask;
  index: number;
  isEditing: boolean;
  editValue: string;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onCommitEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isEven = index % 2 === 1;

  return (
    <div
      className="flex items-center"
      style={{
        borderBottom: '1px solid var(--border)',
        background: isEven ? 'var(--surface-2)' : 'var(--surface)',
        gap: 16,
        padding: '0 16px',
        minHeight: 38,
        position: 'relative',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* # */}
      <span
        className="font-mono"
        style={{
          width: 32,
          fontSize: 11,
          color: 'var(--text-3)',
          flexShrink: 0,
          textAlign: 'center',
        }}
      >
        {task.id}
      </span>

      {/* Task name */}
      <div style={{ flex: 1, paddingRight: hovered ? 32 : 0 }}>
        {isEditing ? (
          <input
            autoFocus
            value={editValue}
            onChange={e => onEditChange(e.target.value)}
            onBlur={onCommitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') onCommitEdit();
              if (e.key === 'Escape') onCommitEdit();
            }}
            style={{
              width: '100%',
              fontSize: 13,
              border: '1px solid var(--teal)',
              borderRadius: 3,
              padding: '3px 6px',
              color: 'var(--text)',
              background: 'var(--surface)',
              boxShadow: '0 0 0 2px rgba(15,123,108,0.15)',
            }}
          />
        ) : (
          <span
            onClick={onStartEdit}
            style={{
              fontSize: 13,
              color: 'var(--text)',
              cursor: 'text',
              display: 'block',
              padding: '8px 0',
              userSelect: 'none',
            }}
            title="Click to rename"
          >
            {task.name}
          </span>
        )}
      </div>

      {/* Checkbox placeholder */}
      <div
        style={{
          width: 40,
          height: 16,
          border: '1px solid var(--border)',
          borderRadius: 2,
          flexShrink: 0,
        }}
      />

      {/* Delete button (hover only) */}
      {hovered && !isEditing && (
        <button
          onClick={onDelete}
          title="Remove task"
          style={{
            position: 'absolute',
            right: 56,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: 'var(--text-3)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 3.5h9M5 3.5V2h3v1.5M5.5 5.5v4M7.5 5.5v4M3 3.5l.5 7h6l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { SkeletonRows } from '@/components/LoadingSpinner';
import { api } from '@/lib/api';
import { OrgTemplate } from '@/lib/types';

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 3,
  padding: '6px 10px',
  fontSize: 13,
  color: 'var(--text)',
  background: 'var(--surface)',
  fontFamily: 'inherit',
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<OrgTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const data = await api.listTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) selectFile(file);
  }

  function selectFile(file: File) {
    if (!file.name.endsWith('.docx')) {
      setErrorMessage('Only .docx files are accepted.');
      return;
    }
    setErrorMessage(null);
    setSelectedFile(file);
    // Auto-fill name from filename if name is empty
    if (!templateName.trim()) {
      const autoName = file.name
        .replace(/\.docx$/i, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      setTemplateName(autoName);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) selectFile(file);
  }

  function clearFile() {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleUpload() {
    if (!selectedFile) { setErrorMessage('Please select a .docx file.'); return; }
    if (!templateName.trim()) { setErrorMessage('Template name is required.'); return; }
    setUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const wasEmpty = templates.length === 0;
      await api.uploadOrgTemplate(selectedFile, templateName.trim(), templateDesc.trim());
      setTemplateName('');
      setTemplateDesc('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadTemplates();
      setSuccessMessage(
        wasEmpty
          ? 'Template uploaded and set as org default. All new studies will use it.'
          : 'Template uploaded successfully.'
      );
    } catch {
      setErrorMessage('Upload failed. Check that the backend is running and try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSetDefault(id: number) {
    try {
      await api.setDefaultTemplate(id);
      await loadTemplates();
    } catch {
      setErrorMessage('Failed to set default template.');
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteTemplate(id);
      setDeleteConfirm(null);
      await loadTemplates();
    } catch {
      setErrorMessage('Failed to delete template.');
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' });
  }

  const canSubmit = !!selectedFile && !!templateName.trim();

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <TopBar crumbs={[{ label: 'Templates' }]} />

      <main className="content-area flex-1">
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 24px 60px' }}>

          {/* Header */}
          <div className="pb-4 mb-5" style={{ borderBottom: '1px solid var(--border)' }}>
            <h1 className="font-semibold" style={{ fontSize: 16, color: 'var(--text)', margin: 0 }}>
              Protocol Templates
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              Upload your standard protocol template once. All new studies will use it automatically to generate filled DOCX protocols.
            </p>
          </div>

          {/* Messages */}
          {successMessage && (
            <div
              className="mb-4 px-4 py-3 flex items-center gap-2 text-sm"
              style={{ background: 'var(--success-bg)', border: '1px solid #A3CFBB', borderLeft: '3px solid var(--success)', borderRadius: 3, color: 'var(--success)' }}
            >
              <span>✓</span> {successMessage}
            </div>
          )}
          {errorMessage && (
            <div
              className="mb-4 px-4 py-3 text-sm"
              style={{ background: 'var(--critical-bg)', border: '1px solid var(--critical-border)', borderRadius: 3, color: 'var(--critical)' }}
            >
              {errorMessage}
            </div>
          )}

          <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr' }}>

            {/* Upload form */}
            <div>
              <div className="section-header"><span>Upload New Template</span></div>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  padding: '16px',
                }}
              >
                {/* Step indicators */}
                <div className="flex items-center gap-3 mb-5" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                  <StepDot n={1} done={!!templateName.trim()} active={!templateName.trim()} label="Name" />
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <StepDot n={2} done={!!selectedFile} active={!!templateName.trim() && !selectedFile} label="File" />
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <StepDot n={3} done={false} active={canSubmit} label="Submit" />
                </div>

                <div className="space-y-4">
                  {/* Step 1 — Name */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      1. Template Name <span style={{ color: 'var(--critical)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={templateName}
                      onChange={e => setTemplateName(e.target.value)}
                      placeholder="e.g. Meridian BE Protocol v1"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Description <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(optional)</span>
                    </label>
                    <textarea
                      value={templateDesc}
                      onChange={e => setTemplateDesc(e.target.value)}
                      placeholder="Standard 2-period crossover BE template..."
                      rows={2}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  </div>

                  {/* Step 2 — File */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      2. Template File <span style={{ color: 'var(--critical)' }}>*</span>
                    </label>

                    {/* File selected state — NOT clickable, prevents re-open confusion */}
                    {selectedFile ? (
                      <div
                        style={{
                          border: '2px solid var(--success)',
                          borderRadius: 3,
                          padding: '12px 14px',
                          background: 'var(--success-bg)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span style={{ color: 'var(--success)', fontSize: 16, flexShrink: 0 }}>✓</span>
                          <div className="min-w-0">
                            <p className="font-mono" style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {selectedFile.name}
                            </p>
                            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, marginTop: 2 }}>
                              {(selectedFile.size / 1024).toFixed(0)} KB · Ready to submit
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={clearFile}
                          style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }}
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      /* Drop zone — only shown when no file selected */
                      <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                        style={{ borderRadius: 3, padding: '20px', textAlign: 'center' }}
                      >
                        <p style={{ fontSize: 13, color: dragOver ? 'var(--teal)' : 'var(--text-2)', fontWeight: dragOver ? 600 : 400 }}>
                          {dragOver ? '↓ Drop .docx file here' : 'Drag & drop your .docx template here'}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
                          — or —
                        </p>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            marginTop: 8,
                            fontSize: 12,
                            color: 'var(--teal)',
                            background: 'none',
                            border: '1px solid var(--teal)',
                            borderRadius: 3,
                            padding: '5px 14px',
                            cursor: 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          Browse file
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".docx"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </div>
                    )}
                  </div>

                  {/* Step 3 — Submit */}
                  <button
                    onClick={handleUpload}
                    disabled={uploading || !canSubmit}
                    className="inline-flex items-center justify-center gap-2 w-full font-medium text-white"
                    style={{
                      background: canSubmit ? 'var(--teal)' : 'var(--border-strong)',
                      padding: '9px 16px',
                      borderRadius: 3,
                      fontSize: 13,
                      border: 'none',
                      cursor: (!canSubmit || uploading) ? 'not-allowed' : 'pointer',
                      opacity: uploading ? 0.7 : 1,
                      marginTop: 4,
                    }}
                  >
                    {uploading ? (
                      <>
                        <div className="w-3.5 h-3.5 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                        Uploading...
                      </>
                    ) : (
                      '3. Submit Template'
                    )}
                  </button>
                  {!canSubmit && (
                    <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 4 }}>
                      {!templateName.trim() ? 'Enter a template name to continue' : 'Select a .docx file to continue'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* How templates work */}
            <div>
              <div className="section-header"><span>How Templates Work</span></div>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  padding: '16px',
                }}
              >
                <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 12 }}>
                  Create a Word (.docx) file using your CRO's standard protocol structure. Place <span className="font-mono" style={{ fontSize: 11, color: 'var(--teal)' }}>{'{{PLACEHOLDER}}'}</span> variables anywhere in the document — TrialOS replaces them with real study values at generation time.
                </p>
                <div
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    padding: '10px 14px',
                    marginBottom: 12,
                  }}
                >
                  <p className="font-mono" style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Available placeholders:</p>
                  {[
                    ['{{STUDY_ID}}', 'Study protocol number'],
                    ['{{DRUG_NAME}}', 'INN drug name'],
                    ['{{DOSE}}', 'e.g. 40 mg'],
                    ['{{FORMULATION}}', 'e.g. Film-coated Tablet'],
                    ['{{HALF_LIFE}}', 'e.g. 14.0 h'],
                    ['{{WASHOUT_DAYS}}', 'e.g. 14 days'],
                    ['{{PK_SAMPLING_SCHEDULE}}', 'Full timepoint list'],
                    ['{{SAMPLE_SIZE_RECOMMENDED}}', 'n based on CV'],
                    ['{{SPONSOR_NAME}}', 'Sponsor company'],
                  ].map(([p, desc]) => (
                    <div key={p} className="flex items-baseline gap-2 mb-1.5">
                      <span className="font-mono" style={{ fontSize: 11, color: 'var(--teal)', flexShrink: 0 }}>
                        {p}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>→ {desc}</span>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    background: 'var(--info-bg)',
                    border: '1px solid #BDD7FF',
                    borderLeft: '3px solid var(--info)',
                    borderRadius: 3,
                    padding: '10px 12px',
                  }}
                >
                  <p style={{ fontSize: 11, color: 'var(--info)', fontWeight: 600, margin: 0, marginBottom: 4 }}>
                    ℹ  Org Default
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                    The first uploaded template is auto-set as the org default. All new studies use this unless a per-study override is uploaded at Protocol → Generate.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Templates list */}
          <div className="mt-8">
            <div className="section-header"><span>Uploaded Templates</span></div>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Name', 'Description', 'Uploaded', 'Default', 'Actions'].map((h, i) => (
                      <th key={h} style={{ padding: '7px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--surface-2)', ...(i === 2 ? { width: 110 } : i === 3 ? { width: 120 } : i === 4 ? { width: 90 } : {}) }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonRows rows={2} cols={5} />
                  ) : templates.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '40px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>
                        No templates uploaded yet. Upload your standard protocol template above.
                      </td>
                    </tr>
                  ) : (
                    templates.map((t, i) => (
                      <tr
                        key={t.id}
                        style={{ borderBottom: i < templates.length - 1 ? '1px solid var(--border)' : 'none' }}
                      >
                        <td style={{ padding: '10px 16px' }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0 }}>
                            {t.name}
                          </p>
                          <p className="font-mono" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                            {t.filename}
                          </p>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <p style={{ fontSize: 12, color: 'var(--text-2)', maxWidth: 220 }}>
                            {t.description || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>No description</span>}
                          </p>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            {formatDate(t.created_at)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          {t.is_default ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: 'var(--success)',
                                background: 'var(--success-bg)',
                                border: '1px solid #A3CFBB',
                                borderRadius: 3,
                                padding: '2px 8px',
                              }}
                            >
                              ✓ Default
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSetDefault(t.id)}
                              style={{ fontSize: 12, color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              Set default
                            </button>
                          )}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          {deleteConfirm === t.id ? (
                            <div className="flex items-center gap-2">
                              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Delete?</span>
                              <button
                                onClick={() => handleDelete(t.id)}
                                style={{ fontSize: 12, color: 'var(--critical)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                style={{ fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(t.id)}
                              style={{ fontSize: 12, color: 'var(--critical)', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

function StepDot({ n, done, active, label }: { n: number; done: boolean; active: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1" style={{ flexShrink: 0 }}>
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          border: `2px solid ${done ? 'var(--success)' : active ? 'var(--teal)' : 'var(--border)'}`,
          background: done ? 'var(--success)' : active ? 'var(--teal-light)' : 'var(--surface-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 700,
          color: done ? 'white' : active ? 'var(--teal)' : 'var(--text-3)',
        }}
      >
        {done ? '✓' : n}
      </div>
      <span style={{ fontSize: 10, color: done ? 'var(--success)' : active ? 'var(--teal)' : 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
    </div>
  );
}

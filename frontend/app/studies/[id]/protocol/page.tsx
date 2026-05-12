'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { api } from '@/lib/api';
import { OrgTemplate, Study, DerivedPKProperties } from '@/lib/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type UploadState = 'idle' | 'processing' | 'complete' | 'error';

interface ProcessingStep {
  label: string;
  status: string;
}

const STEPS: { label: string }[] = [
  { label: 'Template parsed' },
  { label: 'Drug properties applied' },
  { label: 'AI generating protocol sections' },
  { label: 'PK schedule inserted' },
  { label: 'Safety flags applied' },
];

const REWRITE_ACTIONS = [
  { label: 'More formal', instruction: 'Rewrite in formal regulatory/clinical language suitable for an FDA or EMA submission.' },
  { label: 'Simplify', instruction: 'Simplify the language while preserving all clinical meaning. Make it easier to read.' },
  { label: 'Expand', instruction: 'Expand this section with more clinical detail, justifications, and specific regulatory references where appropriate.' },
  { label: 'ICH language', instruction: 'Rewrite using precise ICH guideline terminology and phrasing as found in ICH E6, ICH M13A, or ICH E9 guidelines.' },
];

// ─── Protocol HTML builder ───────────────────────────────────────────────────

function buildProtocolHTML(study: Study, pk: DerivedPKProperties): string {
  const drug = study.drug_profile!;
  const timepoints = pk.pk_sampling_timepoints || [];
  const ambVisits = pk.ambulatory_visits || [];
  const safetyFlags = pk.safety_flags || [];
  const sourceRefs = pk.source_references || [];

  const confineEnd = timepoints[Math.floor(timepoints.length * 0.55)] ?? pk.confinement_hours;

  return `
<h1>${study.id} — ${drug.drug_name} ${drug.dose} ${drug.formulation} Bioequivalence Study</h1>

<h2>1. Introduction</h2>
<p>This protocol describes a Phase I bioequivalence (BE) study to compare ${drug.drug_name} ${drug.dose} ${drug.formulation} (Test product, ${drug.manufacturer ? `manufactured by ${drug.manufacturer}, ` : ''}sponsored by ${drug.sponsor_name || '—'}) with ${drug.reference_product || '—'} (Reference product, sourced from ${drug.reference_country || '—'}) in healthy adult subjects under fasting conditions.</p>
<p>The study is conducted in accordance with ICH E6(R2) Good Clinical Practice (GCP), ICH M13A (2023), the Declaration of Helsinki, and all applicable regulatory requirements for ${(drug.regulatory_targets || []).join(', ')} submissions.</p>

<h2>2. Study Objectives</h2>
<h3>2.1 Primary Objective</h3>
<p>To demonstrate bioequivalence between ${drug.drug_name} ${drug.dose} ${drug.formulation} (Test) and ${drug.reference_product || '—'} (Reference) by comparing the rate and extent of absorption (AUC₀₋ₜ, AUC₀₋∞, and Cmax) following a single oral dose under fasting conditions.</p>
<h3>2.2 Secondary Objectives</h3>
<ul>
<li>To characterise the pharmacokinetic profile of ${drug.drug_name}, including Tmax, t½, and other secondary PK parameters</li>
<li>To evaluate the safety and tolerability of a single oral dose of ${drug.drug_name} ${drug.dose} in healthy subjects</li>
<li>To assess whether adverse event profiles differ meaningfully between Test and Reference formulations</li>
</ul>

<h2>3. Study Design</h2>
<p>This is a single-dose, open-label, randomised, two-period, two-sequence crossover study in healthy adult subjects. Subjects will receive the Test product and Reference product in a randomised sequence, separated by a washout period of at least <strong>${pk.washout_days} days</strong> (≥ 5 × t½ of ${pk.half_life_hours} h).</p>
<p><strong>Design:</strong> Open-label, 2-period, 2-sequence (2×2) crossover</p>
<p><strong>Planned sample size:</strong> ${drug.target_subjects} subjects (${pk.sample_size_recommended} required for ≥80% power at α=0.05)</p>
<p><strong>Washout period:</strong> ≥ ${pk.washout_days} days</p>
<p><strong>Regulatory targets:</strong> ${(drug.regulatory_targets || []).join(', ')}</p>
${drug.special_instructions ? `<p><strong>Study instructions:</strong> ${drug.special_instructions}</p>` : ''}

<h2>4. Subject Selection</h2>
<h3>4.1 Inclusion Criteria</h3>
<ol>
<li>Healthy adult male and/or female subjects aged 18 to 55 years (inclusive)</li>
<li>Body weight ≥ 50 kg and body mass index (BMI) 18.5–30.0 kg/m² (inclusive)</li>
<li>Non-smokers, or ex-smokers with ≥ 1 year of abstinence</li>
<li>Clinically normal physical examination, vital signs, 12-lead ECG, and clinical laboratory parameters at screening</li>
<li>Negative serology for HIV, HBsAg, and anti-HCV antibody</li>
<li>Negative urine drugs-of-abuse screen and alcohol breath test at screening and each check-in</li>
<li>Females of childbearing potential: negative serum/urine pregnancy test at screening and each check-in; willing to use an acceptable method of contraception throughout the study and for 30 days after last dose</li>
<li>Willing and able to comply with all scheduled visits, study procedures, and dietary restrictions</li>
<li>Willing to abstain from alcohol for ≥ 48 hours before each dose and throughout each confinement period</li>
<li>Willing to abstain from strenuous physical exercise for ≥ 48 hours before each dose and throughout confinement</li>
<li>Capable of giving written informed consent before any study-related procedure</li>
</ol>
<h3>4.2 Exclusion Criteria</h3>
<ol>
<li>History or evidence of clinically significant cardiovascular, hepatic, renal, pulmonary, haematological, endocrine, or neurological disease</li>
<li>History of hypersensitivity, allergy, or clinically significant intolerance to ${drug.drug_name} or any excipients of the formulation</li>
<li>Use of any prescription or non-prescription medication (including vitamins and herbal supplements) within 14 days (or 5 half-lives, whichever is longer) before first dose, except paracetamol (acetaminophen) ≤ 2 g/day</li>
<li>Use of known enzyme-inducing or enzyme-inhibiting drugs (e.g., rifampicin, carbamazepine, fluconazole, erythromycin) within 30 days before first dose</li>
<li>Participation in another clinical study or receipt of an investigational product within 90 days before screening</li>
<li>Whole blood donation (≥ 450 mL) or significant blood loss within 90 days before first dose</li>
<li>History of drug or alcohol abuse or dependency within the past 5 years</li>
<li>Positive urine drugs-of-abuse screen or alcohol breath test at screening or any check-in</li>
<li>Clinically significant findings on 12-lead ECG at screening (e.g., QTcF > 450 ms in males, > 470 ms in females)</li>
<li>Clinically significant laboratory abnormalities at screening as judged by the investigator</li>
<li>Pregnant or breastfeeding females</li>
<li>Difficulty with venous access that would compromise serial PK blood sampling</li>
<li>Intake of grapefruit, grapefruit juice, Seville oranges, or related citrus products within 7 days before first dose</li>
<li>Use of herbal medicinal products (e.g., St. John's Wort) within 28 days before first dose</li>
<li>Any gastrointestinal surgery that could affect drug absorption (e.g., gastrectomy, bariatric surgery), except appendectomy</li>
</ol>
<h3>4.3 Withdrawal Criteria</h3>
<ol>
<li>Withdrawal of informed consent at any time, for any reason, without prejudice</li>
<li>Occurrence of any serious adverse event (SAE) that, in the investigator's judgment, requires study discontinuation</li>
<li>Any protocol deviation that significantly compromises data integrity or subject safety, as judged by the principal investigator</li>
<li>Positive urine drugs-of-abuse screen or alcohol breath test during the study</li>
<li>Confirmed pregnancy during the study</li>
<li>Vomiting occurring within ${pk.tmax_hours * 2} hours post-dose (2 × Tmax) in either period</li>
</ol>

<h2>5. Study Procedures</h2>
<h3>5.1 Confinement and Check-in</h3>
<p>Subjects will check in to the clinical facility on the evening of Day −1 in each study period, after a minimum 10-hour overnight fast. They will remain confined for <strong>${pk.confinement_hours} hours</strong> post-dose, until the ${confineEnd}h post-dose sample has been collected.</p>
${pk.posture_restriction ? `<p><strong>Posture restriction:</strong> ${pk.posture_restriction}</p>` : ''}
<h3>5.2 Dose Administration</h3>
<p>On Day 1 in each period, after the pre-dose sample has been collected, each subject will receive a single oral dose of <strong>${drug.drug_name} ${drug.dose}</strong> (Test or Reference, per randomisation schedule) with 240 mL of ambient-temperature water. No food will be consumed for 4 hours post-dose. Standardised meals will be provided at approximately 4 h, 8 h, and 12 h post-dose.</p>
<h3>5.3 Diet and Fluid Restrictions</h3>
<ul>
<li>Subjects must fast from the evening of Day −1 (minimum 10 hours) until 4 hours after dose administration</li>
<li>No caffeine, xanthine-containing beverages, or cola drinks for 24 hours before each dose and during confinement</li>
<li>No alcohol for ≥ 48 hours before each dose and throughout confinement</li>
<li>No grapefruit, grapefruit juice, or Seville oranges for 7 days before each dose</li>
<li>Water available ad libitum, except for 1 hour before and 2 hours after dose administration</li>
<li>Standardised meals provided by the clinic; no outside food permitted during confinement</li>
</ul>

<h2>6. Pharmacokinetic Blood Sampling</h2>
<h3>6.1 Sampling Timepoints</h3>
<p>Venous blood samples (3 mL each, into K₂EDTA vacutainers) will be collected via an indwelling cannula or direct venepuncture at the following nominal timepoints (hours post-dose):</p>
<p><strong>Pre-dose (0h), ${timepoints.slice(1).map(t => `${t}h`).join(', ')}</strong></p>
<p><strong>Total per period:</strong> ${timepoints.length} samples × 3 mL = ${timepoints.length * 3} mL/period</p>
${ambVisits.length > 0 ? `
<h3>6.2 Ambulatory Visits</h3>
<p>Subjects will return to the clinic for ambulatory PK samples at: <strong>${ambVisits.join(', ')}</strong> post-dose. Ambulatory visit windows are ±5 minutes for all timepoints.</p>` : ''}
<h3>${ambVisits.length > 0 ? '6.3' : '6.2'} Sample Processing and Storage</h3>
<p>Samples will be placed on wet ice immediately after collection and centrifuged at 3000 rpm for 10 minutes at 4°C within 30 minutes of collection. Plasma will be transferred into two sets of pre-labelled polypropylene microtubes and stored at −70°C ± 10°C until bioanalysis. Plasma ${drug.drug_name} concentrations will be determined using a validated LC-MS/MS method.</p>

<h2>7. Safety Assessments</h2>
<p>Safety monitoring will include the following assessments:</p>
<ul>
<li><strong>Physical examination:</strong> complete at screening, each check-in, and end of study</li>
<li><strong>Vital signs</strong> (blood pressure, heart rate, temperature, respiratory rate): at screening, pre-dose, and at 1h, 2h, 4h, 8h, and 12h post-dose; and at discharge</li>
<li><strong>12-lead ECG:</strong> at screening, pre-dose, 2h post-dose, and at end of confinement</li>
<li><strong>Clinical laboratory tests</strong> (haematology, biochemistry, urinalysis): at screening and end-of-study visit</li>
<li><strong>Adverse events:</strong> recorded continuously from informed consent through the end-of-study visit</li>
</ul>
${safetyFlags.length > 0 ? `
<h3>7.1 Drug-Specific Safety Considerations</h3>
${safetyFlags.map(f => `<p><strong>⚠ ${f.type}:</strong> ${f.description}</p>${f.requirements?.length > 0 ? `<ul>${f.requirements.map((r: string) => `<li>${r}</li>`).join('')}</ul>` : ''}`).join('\n')}` : ''}

<h2>8. Statistical Analysis</h2>
<p>Bioequivalence will be declared if the 90% confidence intervals (CIs) for the geometric least-squares mean (GLSM) ratios (Test/Reference) of AUC₀₋ₜ, AUC₀₋∞, and Cmax all fall within the pre-specified acceptance range of <strong>80.00%–125.00%</strong>.</p>
<p><strong>Statistical model:</strong> Analysis of variance (ANOVA) on log-transformed PK parameters, using a linear mixed-effects model with sequence, period, and treatment as fixed effects, and subject-within-sequence as a random effect.</p>
<p><strong>Sample size basis:</strong> ${pk.sample_size_basis || `Based on an intrasubject CV of ${pk.intrasubject_cv ?? '—'}% for ${drug.drug_name}; ${pk.sample_size_recommended} subjects are required to achieve ≥80% statistical power at a two-sided α=0.05 level, assuming a GMR of 1.00 and standard bioequivalence limits of 80–125%.`}</p>
<p><strong>PK parameter calculation:</strong> Non-compartmental analysis (NCA) using Phoenix WinNonlin® (Certara) or equivalent validated software.</p>
<p><strong>Statistical software:</strong> SAS® v9.4 or higher (SAS Institute Inc., Cary, NC, USA).</p>
<p>The PK analysis set will include all randomised subjects who complete at least one period with an evaluable PK profile. The safety analysis set will include all subjects who receive at least one dose of study medication.</p>

<h2>9. References</h2>
<ol>
<li>U.S. Food and Drug Administration. Guidance for Industry: Bioequivalence Studies With Pharmacokinetic Endpoints for Drugs Submitted Under an ANDA. December 2013.</li>
<li>European Medicines Agency. Guideline on the Investigation of Bioequivalence. CPMP/EWP/QWP/1401/98 Rev. 1. January 2010.</li>
<li>ICH Harmonised Guideline M13A: Bioequivalence for Immediate-Release Solid Oral Dosage Forms. May 2023.</li>
<li>ICH E6(R2): Good Clinical Practice. November 2016.</li>
<li>ICH E9: Statistical Principles for Clinical Trials. February 1998.</li>
${sourceRefs.map(ref => `<li>${ref}</li>`).join('\n')}
</ol>
`.trim();
}

// ─── Selection toolbar (custom bubble menu) ──────────────────────────────────

function useSelectionPos(editor: ReturnType<typeof useEditor> | null) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const { from, to } = editor.state.selection;
      if (from === to) { setRect(null); return; }
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) { setRect(null); return; }
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (!r.width) { setRect(null); return; }
      setRect({ top: r.top + window.scrollY, left: r.left + r.width / 2, width: r.width });
    };
    editor.on('selectionUpdate', update);
    editor.on('blur', () => setRect(null));
    return () => {
      editor.off('selectionUpdate', update);
    };
  }, [editor]);

  return rect;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProtocolPage() {
  const params = useParams();
  const studyId = params.id as string;

  const [study, setStudy] = useState<Study | null>(null);
  const [orgTemplates, setOrgTemplates] = useState<OrgTemplate[]>([]);
  const [orgTemplatesLoaded, setOrgTemplatesLoaded] = useState(false);
  const [selectedOrgTemplateId, setSelectedOrgTemplateId] = useState<number | null>(null);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [studyFile, setStudyFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [steps, setSteps] = useState<ProcessingStep[]>(
    STEPS.map(s => ({ label: s.label, status: 'pending' }))
  );
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Editor / bubble menu state
  const [rewriting, setRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [protocolHTML, setProtocolHTML] = useState<string>('');
  const [bubbleLabel, setBubbleLabel] = useState<string | null>(null);

  // ── Tiptap editor ──
  const editor = useEditor({
    extensions: [StarterKit],
    content: protocolHTML,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'protocol-editor-inner',
      },
    },
  });

  const selectionRect = useSelectionPos(editor);

  // Update editor content when protocolHTML changes
  useEffect(() => {
    if (editor && protocolHTML && editor.isEmpty) {
      editor.commands.setContent(protocolHTML);
    }
  }, [editor, protocolHTML]);

  useEffect(() => {
    loadData();
  }, [studyId]);

  async function loadData() {
    try {
      const [studyData, templatesData] = await Promise.all([
        api.getStudy(studyId),
        api.listTemplates().catch(() => []),
      ]);
      setStudy(studyData);
      const tplList: OrgTemplate[] = Array.isArray(templatesData) ? templatesData : [];
      setOrgTemplates(tplList);
      setOrgTemplatesLoaded(true);
      const defaultTpl = tplList.find(t => t.is_default);
      if (defaultTpl) setSelectedOrgTemplateId(defaultTpl.id);
      if (studyData?.protocol_document?.status === 'complete') {
        setUploadState('complete');
        setDownloadUrl(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/studies/${studyId}/protocol/download`
        );
        // Build protocol HTML from study data
        const pk = studyData.derived_pk ?? studyData.pk_properties;
        if (studyData.drug_profile && pk) {
          setProtocolHTML(buildProtocolHTML(studyData, pk));
        }
      }
    } catch {
      setOrgTemplatesLoaded(true);
    }
  }

  const hasOrgTemplates = orgTemplates.length > 0;
  const selectedOrgTpl = orgTemplates.find(t => t.id === selectedOrgTemplateId) ?? null;

  function handleStudyFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) pickStudyFile(file);
  }

  function pickStudyFile(file: File) {
    if (!file.name.endsWith('.docx')) {
      setError('Only .docx files are accepted.');
      return;
    }
    setError(null);
    setStudyFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) pickStudyFile(file);
  }

  async function handleGenerate() {
    setError(null);
    setUploadState('processing');
    if (studyFile) {
      try {
        await api.uploadTemplate(studyId, studyFile);
      } catch {}
    }
    await runProcessingSteps();
  }

  async function runProcessingSteps() {
    const updatedSteps: ProcessingStep[] = STEPS.map(s => ({ label: s.label, status: 'pending' }));
    setSteps([...updatedSteps]);
    for (let i = 0; i < updatedSteps.length; i++) {
      updatedSteps[i] = { ...updatedSteps[i], status: 'running' };
      setSteps([...updatedSteps]);
      const delay = i === 2 ? 3500 : 1800; // AI step takes longer
      await sleep(delay);
      updatedSteps[i] = { ...updatedSteps[i], status: 'done' };
      setSteps([...updatedSteps]);
    }
    try {
      await api.fillProtocol(studyId);
    } catch {}
    const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/studies/${studyId}/protocol/download`;
    setDownloadUrl(url);
    // Build editor HTML from current study state
    const pk = study?.derived_pk ?? study?.pk_properties ?? null;
    if (study?.drug_profile && pk) {
      setProtocolHTML(buildProtocolHTML(study, pk));
    }
    setUploadState('complete');
  }

  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ── Bubble menu rewrite ──
  async function handleRewrite(instruction: string) {
    if (!editor || rewriting) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, '\n');
    if (!selectedText.trim()) return;

    setRewriting(true);
    setRewriteError(null);
    try {
      const result = await api.rewriteSection(studyId, selectedText, instruction);
      if (result?.text) {
        editor.chain().focus().insertContent(result.text).run();
      }
    } catch {
      setRewriteError('Rewrite failed. Please try again.');
    } finally {
      setRewriting(false);
    }
  }

  const pk = study?.derived_pk ?? study?.pk_properties ?? null;

  // ── Render ──
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar studyId={studyId} studyLabel={studyId} />
      <TopBar
        crumbs={[
          { label: 'Studies', href: '/' },
          { label: studyId, href: `/studies/${studyId}` },
          { label: 'Protocol' },
        ]}
        studyStatus={study?.status}
      />

      <main className="content-area flex-1">
        <div style={{ maxWidth: uploadState === 'complete' ? 1080 : 860, margin: '0 auto', padding: '20px 24px 60px', transition: 'max-width 0.3s' }}>

          {/* Header */}
          <div
            className="flex items-start justify-between pb-4 mb-5"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div>
              <h1 className="font-semibold" style={{ fontSize: 16, color: 'var(--text)', margin: 0 }}>
                Protocol — <span className="font-mono" style={{ fontSize: 14 }}>{studyId}</span>
              </h1>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                {uploadState === 'complete'
                  ? 'Review and edit below. Select any text to get AI rewrite suggestions.'
                  : 'AI will generate a complete ICH-compliant BE protocol draft after merge.'}
              </p>
            </div>
            {uploadState === 'complete' && downloadUrl && (
              <div className="flex items-center gap-2">
                <a
                  href={downloadUrl}
                  download
                  className="inline-flex items-center gap-1.5 font-medium text-white"
                  style={{
                    background: 'var(--navy)',
                    padding: '7px 14px',
                    borderRadius: 3,
                    fontSize: 12,
                    textDecoration: 'none',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1v7M3 6l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M1 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  Download DOCX
                </a>
                <Link
                  href={`/studies/${studyId}/risk`}
                  style={{
                    fontSize: 12,
                    color: 'white',
                    background: 'var(--teal)',
                    borderRadius: 3,
                    padding: '7px 14px',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Run Risk Analyzer →
                </Link>
              </div>
            )}
          </div>

          {error && (
            <div
              className="mb-4 px-4 py-3 text-sm"
              style={{ background: 'var(--critical-bg)', border: '1px solid var(--critical-border)', borderRadius: 3, color: 'var(--critical)' }}
            >
              {error}
            </div>
          )}

          {rewriteError && (
            <div
              className="mb-4 px-4 py-3 text-sm"
              style={{ background: 'var(--critical-bg)', border: '1px solid var(--critical-border)', borderRadius: 3, color: 'var(--critical)' }}
            >
              {rewriteError}
            </div>
          )}

          {/* ── IDLE STATE ── */}
          {uploadState === 'idle' && orgTemplatesLoaded && (
            <>
              {/* Info callout */}
              <div
                className="mb-5"
                style={{
                  background: 'var(--info-bg)',
                  border: '1px solid #BDD7FF',
                  borderLeft: '3px solid var(--info)',
                  borderRadius: 3,
                  padding: '12px 16px',
                }}
              >
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--info)', margin: 0, marginBottom: 6 }}>
                  What this step generates
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>
                  AI will generate a complete ICH-compliant BE protocol draft — study design, objectives, subject selection criteria, PK sampling schedule, safety assessments, and statistical analysis — populated with your study-specific PK data. You will be able to <strong>review and edit every section</strong> in a rich text editor before downloading the final DOCX. <strong>Always have a qualified PI and regulatory reviewer approve before submission.</strong>
                </p>
              </div>

              {/* Template selector */}
              <div className="mb-5">
                <div className="section-header"><span>Template</span></div>
                <div
                  className="flex items-center justify-between"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    padding: '10px 14px',
                  }}
                >
                  {hasOrgTemplates && selectedOrgTpl ? (
                    <>
                      <div className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="var(--success)" strokeWidth="1.3" />
                          <path d="M4 7l2.5 2.5 3.5-4" stroke="var(--success)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                          {selectedOrgTpl.name}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>(org default)</span>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => setShowTemplateDropdown(v => !v)}
                          style={{ fontSize: 12, color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          Change ▾
                        </button>
                        {showTemplateDropdown && (
                          <div
                            className="absolute right-0 top-full mt-1 w-56 z-10"
                            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          >
                            {orgTemplates.map(t => (
                              <button
                                key={t.id}
                                onClick={() => { setSelectedOrgTemplateId(t.id); setShowTemplateDropdown(false); }}
                                className="w-full text-left flex items-center justify-between gap-2"
                                style={{
                                  padding: '8px 12px',
                                  fontSize: 13,
                                  color: t.id === selectedOrgTemplateId ? 'var(--teal)' : 'var(--text)',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid var(--border)',
                                }}
                              >
                                <span className="truncate">{t.name}</span>
                                {t.id === selectedOrgTemplateId && <span>✓</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 2L1.5 12h11L7 2z" stroke="var(--warning)" strokeWidth="1.3" strokeLinejoin="round" />
                        <path d="M7 6v3" stroke="var(--warning)" strokeWidth="1.3" strokeLinecap="round" />
                        <circle cx="7" cy="10" r="0.75" fill="var(--warning)" />
                      </svg>
                      <span style={{ fontSize: 13, color: 'var(--warning)' }}>
                        No default template — AI will generate a full protocol.{' '}
                        <Link href="/templates" style={{ color: 'var(--warning)', textDecoration: 'underline' }}>
                          Upload template in Settings →
                        </Link>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Per-study file override */}
              {!hasOrgTemplates && !studyFile && (
                <div className="mb-5">
                  <div className="section-header"><span>Upload Template for This Study (optional)</span></div>
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleStudyFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`upload-zone cursor-pointer ${dragOver ? 'drag-over' : ''}`}
                    style={{ borderRadius: 3, padding: '24px', textAlign: 'center' }}
                  >
                    <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      {dragOver ? 'Drop .docx template here' : 'Drag & drop .docx template or click to browse'}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>.docx only · optional, AI generates without template</p>
                    <input ref={fileInputRef} type="file" accept=".docx" className="hidden" onChange={handleFileChange} />
                  </div>
                </div>
              )}

              {studyFile && (
                <div
                  className="mb-5 flex items-center justify-between"
                  style={{
                    padding: '8px 14px',
                    background: 'var(--info-bg)',
                    border: '1px solid #BDD7FF',
                    borderRadius: 3,
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>
                    Study template: <span className="font-mono" style={{ fontSize: 12 }}>{studyFile.name}</span>
                  </span>
                  <button
                    onClick={() => { setStudyFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    style={{ fontSize: 12, color: 'var(--info)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {hasOrgTemplates ? 'Revert to org template' : 'Remove'}
                  </button>
                </div>
              )}

              {hasOrgTemplates && !studyFile && (
                <div className="mb-5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Override with a study-specific template
                  </button>
                  <input ref={fileInputRef} type="file" accept=".docx" className="hidden" onChange={handleFileChange} />
                </div>
              )}

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                className="flex items-center justify-center gap-2 w-full font-semibold text-white"
                style={{
                  background: 'var(--teal)',
                  padding: '11px',
                  borderRadius: 3,
                  fontSize: 14,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Generate Protocol with AI
              </button>
            </>
          )}

          {/* ── LOADING while fetching data ── */}
          {uploadState === 'idle' && !orgTemplatesLoaded && (
            <div className="flex justify-center py-16">
              <div
                className="w-6 h-6 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--border)', borderTopColor: 'var(--teal)' }}
              />
            </div>
          )}

          {/* ── PROCESSING STATE ── */}
          {uploadState === 'processing' && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 3,
                padding: '28px 24px',
              }}
            >
              <div className="flex items-center gap-2.5 mb-6">
                <div
                  className="w-5 h-5 rounded-full border-2 animate-spin flex-shrink-0"
                  style={{ borderColor: 'var(--border)', borderTopColor: 'var(--teal)' }}
                />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  Generating protocol with AI…
                </span>
              </div>
              <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: 16, marginLeft: 2 }}>
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-3" style={{ marginBottom: i < steps.length - 1 ? 14 : 0 }}>
                    <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                      {step.status === 'done' ? (
                        <span style={{ color: 'var(--success)', fontSize: 14 }}>✓</span>
                      ) : step.status === 'running' ? (
                        <div
                          className="w-4 h-4 rounded-full border-2 animate-spin"
                          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--teal)' }}
                        />
                      ) : (
                        <span style={{ color: 'var(--border-strong)', fontSize: 14 }}>○</span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 13,
                        color: step.status === 'done' ? 'var(--text-2)' : step.status === 'running' ? 'var(--text)' : 'var(--text-3)',
                        fontWeight: step.status === 'running' ? 600 : 400,
                      }}
                    >
                      {step.label}
                      {step.status === 'running' && i === 2 && (
                        <span style={{ fontSize: 11, color: 'var(--teal)', marginLeft: 8 }}>GPT-4o · ~20s</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── COMPLETE STATE — Rich Text Editor ── */}
          {uploadState === 'complete' && (
            <div>
              {/* Success banner */}
              <div
                className="flex items-center gap-3 mb-5"
                style={{
                  background: 'var(--success-bg)',
                  border: '1px solid #A3CFBB',
                  borderLeft: '3px solid var(--success)',
                  borderRadius: 3,
                  padding: '10px 16px',
                }}
              >
                <span style={{ color: 'var(--success)', fontSize: 15 }}>✓</span>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)', margin: 0 }}>
                  Protocol generated — review and edit below, then download DOCX
                </p>
              </div>

              {/* Instruction hint */}
              <div
                className="flex items-center gap-2 mb-4 px-3 py-2"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  fontSize: 12,
                  color: 'var(--text-3)',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5.5" stroke="var(--info)" strokeWidth="1.2" />
                  <path d="M6.5 5.5v4" stroke="var(--info)" strokeWidth="1.2" strokeLinecap="round" />
                  <circle cx="6.5" cy="4" r="0.6" fill="var(--info)" />
                </svg>
                <span style={{ color: 'var(--text-2)' }}>
                  <strong>Select any text</strong> to see AI rewrite options (More formal · Simplify · Expand · ICH language).
                  Edit directly at any time. Download DOCX from the top-right button.
                </span>
              </div>

              {/* Tiptap Editor */}
              <div
                className="protocol-editor"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  overflow: 'hidden',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}
              >
                {/* Editor toolbar */}
                <div
                  className="flex items-center gap-1 px-3 py-2"
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                  }}
                >
                  {[
                    { label: 'B', title: 'Bold', action: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive('bold') },
                    { label: 'I', title: 'Italic', action: () => editor?.chain().focus().toggleItalic().run(), active: editor?.isActive('italic') },
                  ].map(btn => (
                    <button
                      key={btn.label}
                      title={btn.title}
                      onClick={btn.action}
                      style={{
                        width: 26,
                        height: 26,
                        fontSize: 12,
                        fontWeight: btn.label === 'B' ? 700 : 400,
                        fontStyle: btn.label === 'I' ? 'italic' : 'normal',
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        background: btn.active ? 'var(--teal-light)' : 'var(--surface)',
                        color: btn.active ? 'var(--teal)' : 'var(--text-2)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {btn.label}
                    </button>
                  ))}

                  <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />

                  {['H1', 'H2', 'H3'].map((h, i) => (
                    <button
                      key={h}
                      title={`Heading ${i + 1}`}
                      onClick={() => editor?.chain().focus().toggleHeading({ level: (i + 1) as 1 | 2 | 3 }).run()}
                      style={{
                        height: 26,
                        padding: '0 6px',
                        fontSize: 11,
                        fontWeight: 600,
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        background: editor?.isActive('heading', { level: i + 1 }) ? 'var(--teal-light)' : 'var(--surface)',
                        color: editor?.isActive('heading', { level: i + 1 }) ? 'var(--teal)' : 'var(--text-2)',
                        cursor: 'pointer',
                      }}
                    >
                      {h}
                    </button>
                  ))}

                  <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />

                  <button
                    title="Bullet list"
                    onClick={() => editor?.chain().focus().toggleBulletList().run()}
                    style={{
                      width: 26,
                      height: 26,
                      fontSize: 14,
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                      background: editor?.isActive('bulletList') ? 'var(--teal-light)' : 'var(--surface)',
                      color: editor?.isActive('bulletList') ? 'var(--teal)' : 'var(--text-2)',
                      cursor: 'pointer',
                    }}
                  >
                    ≡
                  </button>
                  <button
                    title="Ordered list"
                    onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                    style={{
                      width: 26,
                      height: 26,
                      fontSize: 11,
                      fontWeight: 600,
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                      background: editor?.isActive('orderedList') ? 'var(--teal-light)' : 'var(--surface)',
                      color: editor?.isActive('orderedList') ? 'var(--teal)' : 'var(--text-2)',
                      cursor: 'pointer',
                    }}
                  >
                    1.
                  </button>

                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {rewriting && (
                      <span style={{ fontSize: 11, color: 'var(--teal)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span
                            className="w-3 h-3 rounded-full border-2 animate-spin"
                            style={{ borderColor: 'rgba(15,123,108,0.3)', borderTopColor: 'var(--teal)', display: 'inline-block', width: 10, height: 10 }}
                          />
                          AI rewriting…
                        </span>
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {editor ? `${editor.storage?.characterCount?.characters?.() ?? '—'} chars` : ''}
                    </span>
                  </div>
                </div>

                {/* Custom floating bubble menu — shown when text is selected */}
                {selectionRect && (
                  <div
                    className="protocol-bubble-menu"
                    style={{
                      position: 'fixed',
                      top: selectionRect.top - 46,
                      left: selectionRect.left,
                      transform: 'translateX(-50%)',
                      zIndex: 50,
                    }}
                  >
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', padding: '0 4px', alignSelf: 'center' }}>AI</span>
                    <div className="separator" />
                    {REWRITE_ACTIONS.map(action => (
                      <button
                        key={action.label}
                        onMouseDown={e => {
                          e.preventDefault(); // keep selection
                          handleRewrite(action.instruction);
                          setBubbleLabel(action.label);
                        }}
                        className={rewriting ? 'loading' : ''}
                        disabled={rewriting}
                      >
                        {rewriting && bubbleLabel === action.label ? '…' : action.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Editor content */}
                <EditorContent editor={editor} />
              </div>

              {/* Bottom actions */}
              <div
                className="flex items-center justify-between mt-4 pt-4"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <Link
                  href={`/studies/${studyId}/drug-properties`}
                  style={{ fontSize: 13, color: 'var(--text-3)' }}
                >
                  ← Back to PK Properties
                </Link>
                <div className="flex gap-2">
                  <a
                    href={downloadUrl || '#'}
                    download
                    className="inline-flex items-center gap-1.5 font-medium"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      padding: '7px 14px',
                      borderRadius: 3,
                      fontSize: 12,
                      textDecoration: 'none',
                      color: 'var(--text-2)',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M6 1v7M3 6l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M1 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                    Download DOCX
                  </a>
                  <Link
                    href={`/studies/${studyId}/risk`}
                    className="inline-flex items-center gap-1.5 font-medium text-white"
                    style={{
                      background: 'var(--teal)',
                      padding: '7px 14px',
                      borderRadius: 3,
                      fontSize: 12,
                      textDecoration: 'none',
                    }}
                  >
                    Run Risk Analyzer →
                  </Link>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

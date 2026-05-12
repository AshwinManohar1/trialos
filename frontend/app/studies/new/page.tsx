'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { api } from '@/lib/api';
import { generateStudyId, deriveStudyName } from '@/lib/utils';

const DOSE_UNITS = ['mg', 'mcg', 'mg/mL', 'IU', 'g', '%'];
const FORMULATIONS = ['Tablet', 'Capsule', 'Hard Gelatin Capsule', 'Solution', 'Suspension', 'Patch', 'Inhaler', 'Powder', 'Granules'];
const REGULATORY_TARGETS = ['USFDA', 'EMA', 'MHRA', 'Health Canada', 'TGA', 'NPRA', 'PMDA', 'Other'];
const COUNTRIES = [
  'Switzerland', 'USA', 'Germany', 'France', 'UK', 'India', 'Malaysia',
  'Australia', 'Canada', 'Japan', 'Brazil', 'South Africa', 'Singapore',
];

interface FormErrors {
  [key: string]: string;
}

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

const inputStyleError: React.CSSProperties = {
  ...inputStyle,
  borderColor: 'var(--critical)',
};

const monoInputStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: 'var(--mono)',
};

export default function NewStudyPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [studyId, setStudyId] = useState('');
  const [studyName, setStudyName] = useState('');
  const [drugName, setDrugName] = useState('');
  const [dose, setDose] = useState('');
  const [doseUnit, setDoseUnit] = useState('mg');
  const [formulation, setFormulation] = useState('Capsule');
  const [manufacturer, setManufacturer] = useState('');
  const [refDrug, setRefDrug] = useState('');
  const [refCountry, setRefCountry] = useState('Switzerland');
  const [refDrug2, setRefDrug2] = useState('');
  const [showRef2, setShowRef2] = useState(false);
  const [regulatoryTargets, setRegulatoryTargets] = useState<string[]>(['EMA']);
  const [targetSubjects, setTargetSubjects] = useState(30);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorCountry, setSponsorCountry] = useState('India');
  const [specialInstructions, setSpecialInstructions] = useState('');

  useEffect(() => {
    setStudyId(generateStudyId());
  }, []);

  useEffect(() => {
    if (drugName) {
      setStudyName(deriveStudyName(drugName));
    }
  }, [drugName]);

  function toggleRegulatory(target: string) {
    setRegulatoryTargets(prev =>
      prev.includes(target) ? prev.filter(t => t !== target) : [...prev, target]
    );
  }

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!studyId.trim()) newErrors.studyId = 'Required';
    if (!drugName.trim()) newErrors.drugName = 'Required';
    if (!refDrug.trim()) newErrors.refDrug = 'Required';
    if (regulatoryTargets.length === 0) newErrors.regulatoryTargets = 'Select at least one';
    if (!sponsorName.trim()) newErrors.sponsorName = 'Required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setGlobalError(null);
    try {
      await api.createStudy({ id: studyId, name: studyName || `BE Study — ${drugName}` });
      await api.saveDrugProfile(studyId, {
        drug_name: drugName,
        dose: `${dose} ${doseUnit}`.trim(),
        formulation,
        route: 'Oral',
        reference_product: refDrug,
        reference_country: refCountry,
        regulatory_targets: regulatoryTargets,
        manufacturer: manufacturer || undefined,
        sponsor_name: sponsorName,
        sponsor_country: sponsorCountry,
        target_subjects: targetSubjects,
        special_instructions: specialInstructions || undefined,
      });
      api.lookupDrug(studyId).catch(() => {});
      router.push(`/studies/${studyId}/drug-properties`);
    } catch {
      setGlobalError('Unable to connect to backend. Make sure the API server is running.');
      setSubmitting(false);
    }
  }

  function fieldStyle(name: string): React.CSSProperties {
    return errors[name] ? inputStyleError : inputStyle;
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <TopBar crumbs={[{ label: 'Studies', href: '/' }, { label: 'New Study' }]} />

      <main className="content-area flex-1">
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 24px 60px' }}>

          {/* Page header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="font-semibold" style={{ fontSize: 16, color: 'var(--text)', margin: 0 }}>
                New Study
              </h1>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                Configure study parameters — AI will look up pharmacokinetics after save
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="text-sm"
                style={{ color: 'var(--text-3)', fontSize: 13 }}
              >
                Cancel
              </Link>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 font-medium text-white transition-colors"
                style={{
                  background: submitting ? 'var(--teal)' : 'var(--teal)',
                  padding: '7px 16px',
                  borderRadius: 3,
                  fontSize: 13,
                  border: 'none',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.75 : 1,
                }}
              >
                {submitting ? (
                  <>
                    <div
                      className="w-3.5 h-3.5 rounded-full border-2 animate-spin flex-shrink-0"
                      style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
                    />
                    Looking up pharmacokinetics...
                  </>
                ) : (
                  'Save & Look Up Drug →'
                )}
              </button>
            </div>
          </div>

          {globalError && (
            <div
              className="mb-5 px-4 py-3 text-sm"
              style={{
                background: 'var(--critical-bg)',
                border: '1px solid var(--critical-border)',
                borderRadius: 3,
                color: 'var(--critical)',
              }}
            >
              {globalError}
            </div>
          )}

          <form onSubmit={handleSubmit}>

            {/* Study Identification */}
            <div className="mb-6">
              <div className="section-header">
                <span>Study Identification</span>
              </div>
              <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 2fr' }}>
                <div>
                  <label className="block font-medium mb-1" style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    Protocol Number <span style={{ color: 'var(--critical)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={studyId}
                    onChange={e => setStudyId(e.target.value)}
                    placeholder="C1B06603"
                    style={{ ...fieldStyle('studyId'), fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}
                  />
                  {errors.studyId && (
                    <p style={{ fontSize: 11, color: 'var(--critical)', marginTop: 3 }}>{errors.studyId}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setStudyId(generateStudyId())}
                    className="text-xs hover:underline mt-1 block"
                    style={{ color: 'var(--teal)', fontSize: 11 }}
                  >
                    Regenerate ID
                  </button>
                </div>
                <div>
                  <label className="block font-medium mb-1" style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    Study Name
                  </label>
                  <input
                    type="text"
                    value={studyName}
                    onChange={e => setStudyName(e.target.value)}
                    placeholder="Auto-filled from drug name"
                    style={inputStyle}
                  />
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>Auto-derived from drug name</p>
                </div>
              </div>
            </div>

            {/* Test Product */}
            <div className="mb-6">
              <div className="section-header">
                <span>Test Product</span>
              </div>
              <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '2fr 1fr 100px 1fr' }}>
                <div>
                  <label className="block font-medium mb-1" style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    Drug (INN) <span style={{ color: 'var(--critical)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={drugName}
                    onChange={e => setDrugName(e.target.value)}
                    placeholder="e.g. Nilotinib"
                    style={fieldStyle('drugName')}
                  />
                  {errors.drugName && (
                    <p style={{ fontSize: 11, color: 'var(--critical)', marginTop: 3 }}>{errors.drugName}</p>
                  )}
                </div>
                <div>
                  <label className="block font-medium mb-1" style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    Dose
                  </label>
                  <input
                    type="text"
                    value={dose}
                    onChange={e => setDose(e.target.value)}
                    placeholder="200"
                    style={{ ...inputStyle, fontFamily: 'var(--mono)' }}
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1" style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    Unit
                  </label>
                  <select
                    value={doseUnit}
                    onChange={e => setDoseUnit(e.target.value)}
                    style={inputStyle}
                  >
                    {DOSE_UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1" style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    Formulation
                  </label>
                  <select
                    value={formulation}
                    onChange={e => setFormulation(e.target.value)}
                    style={inputStyle}
                  >
                    {FORMULATIONS.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-medium mb-1" style={{ fontSize: 11, color: 'var(--text-2)' }}>
                  Manufacturer / Applicant
                </label>
                <input
                  type="text"
                  value={manufacturer}
                  onChange={e => setManufacturer(e.target.value)}
                  placeholder="Manufacturing company name"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Reference Product */}
            <div className="mb-6">
              <div className="section-header">
                <span>Reference Product</span>
              </div>
              <div className="grid gap-4 mb-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <label className="block font-medium mb-1" style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    Innovator Brand Name <span style={{ color: 'var(--critical)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={refDrug}
                    onChange={e => setRefDrug(e.target.value)}
                    placeholder="e.g. TASIGNA 200mg"
                    style={fieldStyle('refDrug')}
                  />
                  {errors.refDrug && (
                    <p style={{ fontSize: 11, color: 'var(--critical)', marginTop: 3 }}>{errors.refDrug}</p>
                  )}
                </div>
                <div>
                  <label className="block font-medium mb-1" style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    Country of Origin
                  </label>
                  <select
                    value={refCountry}
                    onChange={e => setRefCountry(e.target.value)}
                    style={inputStyle}
                  >
                    {COUNTRIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {showRef2 && (
                <div className="mb-3">
                  <label className="block font-medium mb-1" style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    Second Reference (3-period crossover)
                  </label>
                  <input
                    type="text"
                    value={refDrug2}
                    onChange={e => setRefDrug2(e.target.value)}
                    placeholder="Brand name · country"
                    style={inputStyle}
                  />
                </div>
              )}

              {!showRef2 && (
                <button
                  type="button"
                  onClick={() => setShowRef2(true)}
                  style={{ fontSize: 12, color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  + Add second reference (for 3-period crossover)
                </button>
              )}
            </div>

            {/* Regulatory Submission */}
            <div className="mb-6">
              <div className="section-header">
                <span>Regulatory Submission</span>
              </div>
              <label className="block font-medium mb-2" style={{ fontSize: 11, color: 'var(--text-2)' }}>
                Target Agencies <span style={{ color: 'var(--critical)' }}>*</span>
              </label>
              <div className="flex flex-wrap gap-3">
                {REGULATORY_TARGETS.map(target => (
                  <label key={target} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={regulatoryTargets.includes(target)}
                      onChange={() => toggleRegulatory(target)}
                      style={{ accentColor: 'var(--teal)', width: 13, height: 13 }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{target}</span>
                  </label>
                ))}
              </div>
              {errors.regulatoryTargets && (
                <p style={{ fontSize: 11, color: 'var(--critical)', marginTop: 4 }}>{errors.regulatoryTargets}</p>
              )}
            </div>

            {/* Study Parameters */}
            <div className="mb-6">
              <div className="section-header">
                <span>Study Parameters</span>
              </div>
              <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '100px 1fr 160px' }}>
                <div>
                  <label className="block font-medium mb-1" style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    Planned Subjects
                  </label>
                  <input
                    type="number"
                    value={targetSubjects}
                    onChange={e => setTargetSubjects(parseInt(e.target.value) || 30)}
                    min={6}
                    max={200}
                    style={{ ...inputStyle, fontFamily: 'var(--mono)' }}
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1" style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    Sponsor Name <span style={{ color: 'var(--critical)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={sponsorName}
                    onChange={e => setSponsorName(e.target.value)}
                    placeholder="Pharmaceutical sponsor company"
                    style={fieldStyle('sponsorName')}
                  />
                  {errors.sponsorName && (
                    <p style={{ fontSize: 11, color: 'var(--critical)', marginTop: 3 }}>{errors.sponsorName}</p>
                  )}
                </div>
                <div>
                  <label className="block font-medium mb-1" style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    Sponsor Country
                  </label>
                  <select
                    value={sponsorCountry}
                    onChange={e => setSponsorCountry(e.target.value)}
                    style={inputStyle}
                  >
                    {COUNTRIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-medium mb-1" style={{ fontSize: 11, color: 'var(--text-2)' }}>
                  Special Notes
                  <span style={{ color: 'var(--text-3)', fontWeight: 400, marginLeft: 6 }}>
                    optional — drug-specific restrictions, known interactions
                  </span>
                </label>
                <textarea
                  value={specialInstructions}
                  onChange={e => setSpecialInstructions(e.target.value)}
                  placeholder="Any specific requirements, dietary restrictions, known drug interactions..."
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
            </div>

            {/* Bottom submit */}
            <div
              className="flex items-center justify-between pt-4"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <Link
                href="/"
                style={{ fontSize: 13, color: 'var(--text-3)' }}
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 font-medium text-white"
                style={{
                  background: 'var(--teal)',
                  padding: '8px 20px',
                  borderRadius: 3,
                  fontSize: 13,
                  border: 'none',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.75 : 1,
                }}
              >
                {submitting ? (
                  <>
                    <div
                      className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                      style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
                    />
                    Looking up pharmacokinetics...
                  </>
                ) : (
                  'Save & Look Up Drug →'
                )}
              </button>
            </div>

          </form>
        </div>
      </main>
    </div>
  );
}

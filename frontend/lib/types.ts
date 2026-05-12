export type StudyStatus = 'draft' | 'active' | 'complete';
export type Severity = 'critical' | 'warning' | 'info';

export interface Study {
  id: string;
  name: string;
  status: StudyStatus;
  created_at: string;
  updated_at: string;
  drug_profile?: DrugProfile;
  derived_pk?: DerivedPKProperties;   // legacy alias
  pk_properties?: DerivedPKProperties; // actual API key
  protocol_document?: ProtocolDocument;
  risk_report?: RiskReport;
  screening_forecast?: ScreeningForecast;
}

export interface DrugProfile {
  id: number;
  study_id: string;
  drug_name: string;
  dose: string;
  formulation: string;
  route: string;
  reference_product: string;
  reference_country: string;
  regulatory_targets: string[];
  manufacturer?: string;
  sponsor_name: string;
  sponsor_country: string;
  target_subjects: number;
  special_instructions?: string;
}

export interface DerivedPKProperties {
  id: number;
  study_id: string;
  half_life_hours: number;
  tmax_hours: number;
  absorption_class: string;
  pk_sampling_timepoints: number[];
  washout_days: number;
  confinement_hours: number;
  ambulatory_visits: string[];
  posture_restriction?: string;
  intrasubject_cv?: number;
  sample_size_recommended: number;
  sample_size_basis: string;
  safety_flags: SafetyFlag[];
  source_references: string[];
}

export interface SafetyFlag {
  type: string;
  description: string;
  requirements: string[];
}

export interface ProtocolDocument {
  id: number;
  study_id: string;
  template_filename?: string;
  filled_filename?: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  error_message?: string;
  created_at: string;
}

export interface RiskFinding {
  severity: Severity;
  section: string;
  issue: string;
  clinical_basis: string;
  fix: string;
}

export interface RiskReport {
  id: number;
  study_id: string;
  findings: RiskFinding[];
  critical_count: number;
  warning_count: number;
  info_count: number;
  generated_at: string;
}

export interface CriterionRisk {
  criterion_id: string;
  criterion_text: string;
  failure_probability: number;
  reason: string;
}

export interface ScreeningStep {
  step: number;
  test: string;
  rationale: string;
  cost_per_screen_inr: number;
}

export interface ScreeningForecast {
  id: number;
  study_id: string;
  predicted_failure_rate_low: number;
  predicted_failure_rate_high: number;
  subjects_to_screen: number;
  estimated_cost_inr?: number;
  criteria_risks: CriterionRisk[];
  screening_order: ScreeningStep[];
  generated_at: string;
}

export interface OrgTemplate {
  id: number;
  org_id: string;
  name: string;
  description?: string;
  filename: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ──────────────────────────────────────────────
# Study
# ──────────────────────────────────────────────

class StudyCreate(BaseModel):
    id: Optional[str] = None
    name: str


class StudyResponse(BaseModel):
    id: str
    org_id: str
    name: str
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Drug Profile
# ──────────────────────────────────────────────

class DrugProfileCreate(BaseModel):
    drug_name: str
    dose: str
    formulation: str
    route: str = "oral"
    reference_product: str = ""
    reference_country: str = ""
    regulatory_targets: List[str] = []
    manufacturer: Optional[str] = None
    sponsor_name: str = ""
    sponsor_country: str = ""
    target_subjects: int = 30
    special_instructions: Optional[str] = None


class DrugProfileResponse(BaseModel):
    id: Optional[str] = None
    study_id: str
    drug_name: str
    dose: str
    formulation: str
    route: str
    reference_product: str
    reference_country: str
    regulatory_targets: List[str]
    manufacturer: Optional[str] = None
    sponsor_name: str
    sponsor_country: str
    target_subjects: int
    special_instructions: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Safety Flag
# ──────────────────────────────────────────────

class SafetyFlag(BaseModel):
    type: str
    description: str
    requirements: List[str]


# ──────────────────────────────────────────────
# Derived PK Properties
# ──────────────────────────────────────────────

class DerivedPKPropertiesResponse(BaseModel):
    id: Optional[str] = None
    study_id: str
    half_life_hours: float
    tmax_hours: float
    absorption_class: str
    pk_sampling_timepoints: List[float]
    washout_days: int
    confinement_hours: int
    ambulatory_visits: List[str]
    posture_restriction: Optional[str] = None
    safety_flags: List[Dict[str, Any]]
    sample_size_recommended: int
    sample_size_basis: str
    intrasubject_cv: Optional[float] = None
    source_references: List[str]
    raw_response: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Protocol Document
# ──────────────────────────────────────────────

class ProtocolDocumentResponse(BaseModel):
    id: Optional[str] = None
    study_id: str
    template_filename: Optional[str] = None
    filled_filename: Optional[str] = None
    template_source: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Risk Report
# ──────────────────────────────────────────────

class RiskFinding(BaseModel):
    severity: str  # critical|warning|info
    section: str
    issue: str
    clinical_basis: str
    fix: str


class RiskReportResponse(BaseModel):
    id: Optional[str] = None
    study_id: str
    protocol_document_id: Optional[str] = None
    findings: List[Dict[str, Any]]
    critical_count: int
    warning_count: int
    info_count: int
    generated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Screening Forecast
# ──────────────────────────────────────────────

class CriterionRisk(BaseModel):
    criterion_id: str
    criterion_text: str
    failure_probability: float
    reason: str


class ScreeningStep(BaseModel):
    step: int
    test: str
    rationale: str
    cost_per_screen_inr: float


class ScreeningForecastResponse(BaseModel):
    id: Optional[str] = None
    study_id: str
    predicted_failure_rate_low: float
    predicted_failure_rate_high: float
    subjects_to_screen: int
    estimated_cost_inr: Optional[float] = None
    criteria_risks: List[Dict[str, Any]]
    screening_order: List[Dict[str, Any]]
    generated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# List item — flat, with drug_profile + risk summary (for dashboard table)
# ──────────────────────────────────────────────

class StudyListItemResponse(BaseModel):
    id: str
    org_id: str
    name: str
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    drug_profile: Optional[DrugProfileResponse] = None
    risk_report: Optional[RiskReportResponse] = None


# Full Study Detail (all related data)
# ──────────────────────────────────────────────

class StudyDetailResponse(BaseModel):
    study: StudyResponse
    drug_profile: Optional[DrugProfileResponse] = None
    pk_properties: Optional[DerivedPKPropertiesResponse] = None
    protocol_document: Optional[ProtocolDocumentResponse] = None
    risk_report: Optional[RiskReportResponse] = None
    screening_forecast: Optional[ScreeningForecastResponse] = None


# ──────────────────────────────────────────────
# Org Template
# ──────────────────────────────────────────────

class OrgTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None


class OrgTemplateOut(BaseModel):
    id: Optional[str] = None
    org_id: str
    name: str
    description: Optional[str] = None
    filename: str
    is_default: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

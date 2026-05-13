from beanie import Document
from pydantic import Field
from typing import Optional, List
from datetime import datetime


class Study(Document):
    id: str  # custom string ID like "C1B06600" — stored as _id
    org_id: str = "cliantha"
    name: str
    status: str = "draft"  # draft | active | complete
    study_phase: Optional[str] = None  # phase_1_be | early_fih | phase_1_2 | phase_2 | phase_3
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "studies"


class DrugProfile(Document):
    study_id: str
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
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "drug_profiles"


class DerivedPKProperties(Document):
    study_id: str
    half_life_hours: float
    tmax_hours: float
    absorption_class: str = ""
    pk_sampling_timepoints: List[float] = []
    washout_days: int
    confinement_hours: int
    ambulatory_visits: List[str] = []
    posture_restriction: Optional[str] = None
    intrasubject_cv: Optional[float] = None
    sample_size_recommended: int
    sample_size_basis: str = ""
    safety_flags: List[dict] = []
    source_references: List[str] = []
    raw_response: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "derived_pk_properties"


class ProtocolDocument(Document):
    study_id: str
    template_filename: Optional[str] = None
    template_gridfs_id: Optional[str] = None   # GridFS file ID for template
    filled_filename: Optional[str] = None
    filled_gridfs_id: Optional[str] = None     # GridFS file ID for filled doc
    template_source: Optional[str] = None       # "study_upload" | "org_template"
    status: str = "pending"                     # pending | processing | complete | failed
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "protocol_documents"


class RiskReport(Document):
    study_id: str
    protocol_document_id: Optional[str] = None
    findings: List[dict] = []
    critical_count: int = 0
    warning_count: int = 0
    info_count: int = 0
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "risk_reports"


class ScreeningForecast(Document):
    study_id: str
    protocol_document_id: Optional[str] = None
    predicted_failure_rate_low: float
    predicted_failure_rate_high: float
    subjects_to_screen: int
    estimated_cost_inr: Optional[float] = None
    criteria_risks: List[dict] = []
    screening_order: List[dict] = []
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "screening_forecasts"


class OrgTemplate(Document):
    org_id: str = "cliantha"
    name: str
    description: Optional[str] = None
    filename: str
    gridfs_id: str                              # GridFS file ID
    is_default: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "org_templates"

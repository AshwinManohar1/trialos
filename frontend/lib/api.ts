import { DrugProfile } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = {
  // Org Templates
  listTemplates: () => fetch(`${API_BASE}/api/templates`).then(r => r.json()),
  uploadOrgTemplate: (file: File, name: string, description: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', name);
    fd.append('description', description);
    return fetch(`${API_BASE}/api/templates/upload`, { method: 'POST', body: fd }).then(r => r.json());
  },
  setDefaultTemplate: (id: number) =>
    fetch(`${API_BASE}/api/templates/${id}/default`, { method: 'PATCH' }).then(r => r.json()),
  deleteTemplate: (id: number) =>
    fetch(`${API_BASE}/api/templates/${id}`, { method: 'DELETE' }).then(r => r.json()),

  // Studies
  listStudies: () => fetch(`${API_BASE}/api/studies`).then(r => r.json()),
  getStudy: (id: string) =>
    fetch(`${API_BASE}/api/studies/${id}`)
      .then(r => r.json())
      .then((data) => {
        // Backend returns StudyDetailResponse with nested `study:` field.
        // Flatten to match the frontend Study type so study.id, study.status etc. work.
        if (data && data.study) {
          return {
            ...data.study,
            drug_profile: data.drug_profile ?? null,
            pk_properties: data.pk_properties ?? null,
            derived_pk: data.pk_properties ?? null,      // legacy alias
            protocol_document: data.protocol_document ?? null,
            risk_report: data.risk_report ?? null,
            screening_forecast: data.screening_forecast ?? null,
          };
        }
        return data;
      }),
  createStudy: (data: { id: string; name: string }) =>
    fetch(`${API_BASE}/api/studies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  // Drug Profile
  saveDrugProfile: (studyId: string, data: Partial<DrugProfile>) =>
    fetch(`${API_BASE}/api/studies/${studyId}/drug-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  lookupDrug: (studyId: string) =>
    fetch(`${API_BASE}/api/studies/${studyId}/drug-lookup`, { method: 'POST' }).then(r => r.json()),
  getDerivedPK: (studyId: string) =>
    fetch(`${API_BASE}/api/studies/${studyId}/drug-lookup`).then(r => r.json()),

  // Protocol
  uploadTemplate: (studyId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch(`${API_BASE}/api/studies/${studyId}/protocol/upload`, {
      method: 'POST',
      body: fd,
    }).then(r => r.json());
  },
  fillProtocol: (studyId: string) =>
    fetch(`${API_BASE}/api/studies/${studyId}/protocol/fill`, { method: 'POST' }).then(r => r.json()),
  getProtocol: (studyId: string) =>
    fetch(`${API_BASE}/api/studies/${studyId}/protocol`).then(r => r.json()),

  // Risk
  uploadRiskDocument: (studyId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch(`${API_BASE}/api/studies/${studyId}/risk/upload`, {
      method: 'POST',
      body: fd,
    }).then(r => r.json());
  },
  analyzeRisk: (studyId: string) =>
    fetch(`${API_BASE}/api/studies/${studyId}/risk/analyze`, { method: 'POST' }).then(r => r.json()),
  getRisk: (studyId: string) =>
    fetch(`${API_BASE}/api/studies/${studyId}/risk`).then(r => r.json()),

  // Screening
  runScreening: (studyId: string) =>
    fetch(`${API_BASE}/api/studies/${studyId}/screening/run`, { method: 'POST' }).then(r => r.json()),
  getScreening: (studyId: string) =>
    fetch(`${API_BASE}/api/studies/${studyId}/screening`).then(r => r.json()),
};

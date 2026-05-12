export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(amount);
}

export function generateStudyId(): string {
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `C1B0${num}`;
}

export function deriveStudyName(drugName: string): string {
  if (!drugName) return '';
  return `BE Study — ${drugName}`;
}

export function getRiskLevel(probability: number): 'High' | 'Medium' | 'Low' {
  // Handle both decimal fraction (0.35) and percentage (35) formats from API
  const pct = probability <= 1 ? probability * 100 : probability;
  if (pct >= 30) return 'High';
  if (pct >= 15) return 'Medium';
  return 'Low';
}

export function getRiskBadgeClasses(level: 'High' | 'Medium' | 'Low'): string {
  switch (level) {
    case 'High':
      return 'bg-red-100 text-red-700';
    case 'Medium':
      return 'bg-yellow-100 text-yellow-700';
    case 'Low':
      return 'bg-green-100 text-green-700';
  }
}

export type ReportStatus = 'pending' | 'analysed' | 'linked' | 'closed';

export type DustCategory =
  | 'construction'
  | 'demolition'
  | 'road_dust'
  | 'industrial'
  | 'vehicle_emissions'
  | 'open_burning'
  | 'unknown';

export type SeverityLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface VisualAnalysis {
  dust_detected: boolean;
  dust_category: DustCategory;
  severity: SeverityLevel;
  confidence: number;
  description: string;
  suggested_action: string;
  analysis_failed: boolean;
}

export interface DustReportResponse {
  report_id: string;
  case_id?: string | null;
  latitude: number;
  longitude: number;
  address?: string | null;
  description?: string | null;
  image_url?: string | null;
  analysis?: VisualAnalysis | null;
  priority_score: number;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
}

export interface SubmitReportFormData {
  image: File | null;
  latitude: number | '';
  longitude: number | '';
  address: string;
  description: string;
  category: DustCategory;
}

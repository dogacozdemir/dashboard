import type { MetricValue } from '@/features/performance-hub/types';
import type { GeoStrategyLogContent } from '@/features/strategy/types';

export type GeoEngine = 'google' | 'bing' | 'perplexity' | 'chatgpt';

export interface GeoReport {
  id: string;
  keyword: string;
  engine: GeoEngine;
  /** DB column metric_source — gsc_query = GSC; geo_ai = DeepSeek GEO simulator. */
  metricSource?: 'geo_rank' | 'gsc_query' | 'geo_ai';
  rankData: {
    position: number | null;
    cited: boolean;
    citationSource: string | null;
    snippet: string | null;
    source?: string;
    siteUrl?: string;
    query?: string;
    clicks?: number;
    impressions?: number;
    ctr?: number;
    visibilityScore?: number;
    actionableSteps?: string;
    whyGeoLags?: string | null;
    gscImpressions?: number | null;
    gscClicks?: number | null;
    gscPosition?: number | null;
  };
  createdAt: string;
}

export interface GeoAiKeywordRow {
  keyword: string;
  visibilityScore: number;
  actionableSteps: string;
  gscImpressions?: number;
  gscClicks?: number;
  gscPosition?: number;
}

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in-progress' | 'upcoming';
  category: 'technical' | 'content' | 'geo' | 'performance';
  eta: string;
  etaDate?: string | null;
}

export interface MarketInsight {
  summary: string;
  opportunities: string[];
  threats: string[];
  geoRecommendation: string;
  confidence: number;
}

/** Flexible SEO payload stored in strategy_logs.content (report_type = seo). */
export interface SeoLogPayload {
  totalImpressions?: number;
  impressions?: number;
  visits?: number;
  sessions?: number;
  ctr?: number;
  averagePosition?: number;
  avgPosition?: number;
  aiInsight?: string;
  aiSummary?: string;
  coreWebVitals?: {
    lcp?: number;
    fid?: number;
    cls?: number;
    /** Seconds — optional explicit units */
    lcpSeconds?: number;
    fidMs?: number;
  };
}

/** SSOT-backed SEO & GEO dashboard aggregate (strategy_logs, geo_reports, technical_logs). */
export interface SeoGeoDashboardData {
  geoReports: GeoReport[];
  /** Latest DeepSeek GEO strategy note (strategy_logs.geo_strategy). */
  geoStrategy: (GeoStrategyLogContent & { logGeneratedAt: string }) | null;
  /** Per-keyword AI visibility (geo_reports.geo_ai). */
  geoAiKeywords: GeoAiKeywordRow[];
  geo: {
    serviceVisibilityPct: number;
    avgPosition: number | null;
    trackedKeywords: number;
  };
  seo: {
    impressions: MetricValue;
    visits: MetricValue;
    ctr: MetricValue;
    avgPosition: MetricValue;
  };
  cwv: {
    lcp: number;
    fid: number;
    cls: number;
    lcpRaw?: number;
    fidRaw?: number;
    clsRaw?: number;
  } | null;
  errorCount: number;
  aiInsight: string | null;
}

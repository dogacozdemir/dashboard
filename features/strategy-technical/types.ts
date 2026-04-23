export type GeoEngine = 'google' | 'bing' | 'perplexity' | 'chatgpt';

export interface GeoReport {
  id: string;
  keyword: string;
  engine: GeoEngine;
  rankData: {
    position: number | null;
    cited: boolean;
    citationSource: string | null;
    snippet: string | null;
  };
  createdAt: string;
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

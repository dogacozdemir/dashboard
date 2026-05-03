export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          slug: string;
          name: string;
          logo_url: string | null;
          brand_logo_url: string | null;
          custom_domain: string | null;
          plan: 'starter' | 'growth' | 'enterprise';
          primary_color: string | null;
          is_active: boolean;
          created_at: string;
          industry: string | null;
          dashboard_goal: 'sales' | 'awareness' | 'cost' | null;
          magic_onboarding_completed_at: string | null;
          is_demo: boolean;
        };
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>;
      };
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          role: 'super_admin' | 'tenant_admin' | 'tenant_user';
          tenant_id: string;
          role_id: string | null;
          /** Dashboard locale */
          locale: 'tr' | 'en';
          /** Total gamification XP */
          xp: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'xp'> & { xp?: number };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      ad_campaigns: {
        Row: {
          id: string;
          tenant_id: string;
          platform: 'meta' | 'google' | 'tiktok';
          campaign_name: string;
          data: Json;
          synced_at: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['ad_campaigns']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['ad_campaigns']['Insert']>;
      };
      creative_assets: {
        Row: {
          id: string;
          tenant_id: string;
          title: string;
          url: string;
          thumbnail_url: string | null;
          type: 'image' | 'video';
          status: 'pending' | 'approved' | 'revision';
          uploaded_by: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['creative_assets']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['creative_assets']['Insert']>;
      };
      revisions: {
        Row: {
          id: string;
          asset_id: string;
          tenant_id: string;
          comment: string;
          created_by: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['revisions']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['revisions']['Insert']>;
      };
      brand_assets: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          type: 'logo' | 'brand-book' | 'font' | 'color-palette' | 'other';
          url: string;
          file_size: number | null;
          is_public: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['brand_assets']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['brand_assets']['Insert']>;
      };
      geo_reports: {
        Row: {
          id: string;
          tenant_id: string;
          keyword: string;
          rank_data: Json;
          engine: 'google' | 'bing' | 'perplexity' | 'chatgpt';
          metric_source: 'geo_rank' | 'gsc_query';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['geo_reports']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['geo_reports']['Insert']>;
      };
      gsc_page_analytics: {
        Row: {
          id: string;
          tenant_id: string;
          page_url: string;
          clicks: number;
          impressions: number;
          ctr: number;
          position: number;
          synced_at: string;
        };
        Insert: Omit<Database['public']['Tables']['gsc_page_analytics']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['gsc_page_analytics']['Insert']>;
      };
    };
    Functions: {
      tenant_total_impressions: {
        Args: { p_tenant_id: string };
        Returns: string | number;
      };
    };
  };
}

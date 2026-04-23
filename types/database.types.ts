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
          custom_domain: string | null;
          plan: 'starter' | 'growth' | 'enterprise';
          primary_color: string | null;
          is_active: boolean;
          created_at: string;
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
          role: 'admin' | 'client' | 'viewer';
          tenant_id: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at'>;
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
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['geo_reports']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['geo_reports']['Insert']>;
      };
    };
  };
}

export type SystemLogLevel = 'error' | 'warn' | 'info' | 'debug';

export type SystemSettings = {
  id: 1;
  maintenanceMode: boolean;
  globalSignupsAllowed: boolean;
  systemLogLevel: SystemLogLevel;
  updatedAt: string;
  updatedBy: string | null;
};

export const SYSTEM_LOG_LEVELS: SystemLogLevel[] = ['error', 'warn', 'info', 'debug'];

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  id: 1,
  maintenanceMode: false,
  globalSignupsAllowed: true,
  systemLogLevel: 'info',
  updatedAt: new Date(0).toISOString(),
  updatedBy: null,
};

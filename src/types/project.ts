export type ProjectType = 
  | 'web-to-apk'
  | 'native-android'
  | 'love2d-lua'
  | 'python-mobile'
  | 'custom';

export interface ProjectFile {
  id: string;
  name: string;
  path: string; // Relative path, e.g. "index.html" or "src/main.js"
  size: number;
  type: string; // MIME type or extension
  content: string; // Text content or base64 data for binary
  isBinary: boolean;
  lastModified: number;
}

export interface AndroidPermissions {
  internet: boolean;
  networkState: boolean;
  camera: boolean;
  audioRecord: boolean;
  locationFine: boolean;
  locationCoarse: boolean;
  readStorage: boolean;
  writeStorage: boolean;
  vibrate: boolean;
  custom: string[];
}

export interface AppConfig {
  name: string;
  packageId: string;
  versionName: string;
  versionCode: number;
  minSdk: number;
  targetSdk: number;
  orientation: 'portrait' | 'landscape' | 'sensor' | 'unspecified';
  fullscreen: boolean;
  iconDataUrl?: string;
  iconShape: 'squircle' | 'circle' | 'rounded' | 'teardrop' | 'square';
  permissions: AndroidPermissions;
  webSettings?: {
    allowJavaScript: boolean;
    allowDomStorage: boolean;
    clearCacheOnExit: boolean;
    enableZoom: boolean;
    customUserAgent?: string;
  };
}

export interface CloudBuildConfig {
  provider: 'github-actions' | 'custom-webhook';
  webhookUrl: string;
  apiToken: string;
  autoDeploy: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  type: ProjectType;
  createdAt: number;
  updatedAt: number;
  files: ProjectFile[];
  config: AppConfig;
  cloudConfig: CloudBuildConfig;
}

export interface BuildLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  step?: string;
}

export interface ToolchainStatus {
  timestamp: string;
  toolchain: {
    java: { available: boolean; version: string; details: string };
    gradle: { available: boolean; version: string; details: string };
    androidSdk: { available: boolean; path: string | null; details: string };
  };
  readyForLocalBuild: boolean;
  localBuildEnabled?: boolean;
  recommendation: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  detectedType: string;
  fileCount: number;
}

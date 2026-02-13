/**
 * Smart Capture — Configuration types
 */

import type { StorageBackendType } from './storage';

export interface CaptureProfile {
  id: string;
  name: string;
  defaultTags: string[];
  autoClassify: boolean;
  extractContent: boolean;
  extractKeywords: boolean;
}

export interface ExtensionConfig {
  storageBackend: StorageBackendType;
  activeProfileId: string;
  profiles: CaptureProfile[];
  autoClassify: boolean;
  extractContent: boolean;
  extractKeywords: boolean;
}

export const DEFAULT_PROFILE: CaptureProfile = {
  id: 'default',
  name: 'Default',
  defaultTags: [],
  autoClassify: true,
  extractContent: true,
  extractKeywords: true,
};

export const DEFAULT_CONFIG: ExtensionConfig = {
  storageBackend: 'chrome-local',
  activeProfileId: 'default',
  profiles: [DEFAULT_PROFILE],
  autoClassify: true,
  extractContent: true,
  extractKeywords: true,
};

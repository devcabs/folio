/**
 * Generic Sequence Node Model
 * Document Reference: docs/tasks/task18_2_data_contracts_and_single_source_of_truth.md
 *
 * Parameterized milestone node model supporting dynamic sequence length (N >= 1).
 * Completely decoupled from institutional union constraints.
 */

export type NodeCode = string;

export interface NodeHeroImage {
  src: string;
  alt: string;
  caption?: string;
  showCaption?: boolean;
}

/** Canonical alias for hero image contract */
export type CanonicalPhoto = NodeHeroImage;

export interface SourceItem {
  id: string;
  title: string;
  dateStamp?: string;
  photo?: CanonicalPhoto;
  imageSrc?: string;
  reference?: string;
}

export interface StageStory {
  step: number;
  stageName: string;
  narrative: string;
}

export interface NodeItem {
  id: string;
  index: number;
  title: string;
  subtitle?: string;
  summary?: string;
  tagline?: string;
  accentColor: string;
  accentTint?: string;
  heroImage?: NodeHeroImage;
  annotation?: string;
  nodeNumber?: number;
  stages?: StageStory[];
  sourceItems?: SourceItem[];
  metadata?: Record<string, unknown>;
}

export interface NodeNavigationLink {
  id: string;
  index: number;
  title: string;
  path: string;
}

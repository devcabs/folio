import type { NodeItem } from '../types/node';
import type { NavItem } from '../types/navigation';

export interface NodeSection extends NavItem {
  id: string;
  label: string;
  number?: string;
  href: string;
}

/**
 * Generates the semantic sub-sections for a dedicated node page.
 * Strictly binds to authentic stages, project indicators status, and source.
 */
export function getNodeSections(node: NodeItem): NavItem[] {
  const stageLabels = [
    'Where We Are',
    'What We Need',
    'What We Are Doing',
    'What We Are Achieving',
    'Community Impact',
  ];

  const sections: NodeSection[] = [
    {
      id: 'node-overview',
      label: 'Overview',
      href: '#node-overview',
    },
  ];

  node.stages?.forEach((stage, idx) => {
    const stageNum = String(stage.step).padStart(2, '0');
    const label = stageLabels[idx] || stage.stageName;
    sections.push({
      id: `stage-${stage.step}`,
      label,
      number: stageNum,
      href: `#stage-${stage.step}`,
    });
  });

  sections.push({
    id: 'node-evidence',
    label: 'Evidence & Proof',
    href: '#node-evidence',
  });

  return sections;
}

// Aliases for backwards compatibility
export type PageSection = NodeSection;
export const getPageSections = getNodeSections;

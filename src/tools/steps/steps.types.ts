export const PROJECT_TYPES = ['http-api', 'library', 'cli', 'worker', 'mcp-server'] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export interface StepInfo {
  step: number;
  title: string;
  description: string;
  file: string;
  appliesTo: ProjectType[] | 'all';
  notes?: string;
}

export interface StepListItem extends StepInfo {
  appliesToCurrentType: boolean | null;
}

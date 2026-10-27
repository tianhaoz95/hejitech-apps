// Core type definitions for Polymath

export type DomainCategory =
  | "ai-inference"
  | "post-training-infra"
  | "distributed-systems"
  | "hardware-acceleration"
  | "robotics-control"
  | "compilers"
  | "cross-domain";

export type ComponentKind =
  | "MemoryBlockGrid"
  | "CodeExercise"
  | "RooflinePlot"
  | "ClusterTopology"
  | "InteractiveWhiteboard"
  | "SocraticQuiz";

export interface MemoryBlockGridProps {
  totalBlocks: number;
  allocatedBlocks: number;
  sharedPrefixBlocks: number;
  blockSizeTokens?: number;
  title?: string;
}

export interface CodeExerciseProps {
  id: string;
  title: string;
  targetFile: string;
  testFile: string;
  instructions: string;
  starterCode: string;
  solutionHint?: string;
}

export interface RooflinePlotProps {
  arithmeticIntensity: number;
  achievedTflops: number;
  memoryCeilingTbs: number;
  computeCeilingTflops: number;
  kernelLabel?: string;
}

export interface ClusterTopologyProps {
  nodeCount: number;
  gpusPerNode: number;
  interconnect: "nvlink" | "infiniband" | "pcie";
  tensorParallelSize?: number;
  pipelineParallelSize?: number;
  dataParallelSize?: number;
}

export interface InteractiveWhiteboardProps {
  diagramId: string;
  title: string;
  svgContent?: string;
  nodes?: Array<{ id: string; label: string; x: number; y: number }>;
}

export interface SocraticQuizProps {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export type CourseComponentProps =
  | { kind: "MemoryBlockGrid"; props: MemoryBlockGridProps }
  | { kind: "CodeExercise"; props: CodeExerciseProps }
  | { kind: "RooflinePlot"; props: RooflinePlotProps }
  | { kind: "ClusterTopology"; props: ClusterTopologyProps }
  | { kind: "InteractiveWhiteboard"; props: InteractiveWhiteboardProps }
  | { kind: "SocraticQuiz"; props: SocraticQuizProps };

export interface Chapter {
  id: string;
  slug: string;
  title: string;
  order: number;
  summary: string;
  markdownContent: string;
  components: CourseComponentProps[];
  estimatedMinutes: number;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  domain: DomainCategory;
  author: string;
  version: string;
  tags: string[];
  chapters: Chapter[];
  createdAt: string;
  updatedAt: string;
}

export interface PolymathPreferences {
  theme: "dark" | "light" | "system";
  fontSize: number;
  autoRunTests: boolean;
  activeDomainFilter?: string;
}

export interface RecentCourse {
  id: string;
  title: string;
  localPath: string;
  lastOpenedAt: string;
  progressPercent: number;
}

export interface PolymathProfile {
  userId: string;
  displayName: string;
  preferences: PolymathPreferences;
  recentCourses: RecentCourse[];
}

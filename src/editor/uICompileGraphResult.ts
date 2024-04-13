import { Graph, CompileResult } from '@core/graph';

export type UICompileGraphResult = CompileResult & {
  compileMs: string;
  graph: Graph;
};

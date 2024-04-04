import { Graph, CompileResult } from '@shaderfrog/core/graph';

export type UICompileGraphResult = CompileResult & {
  compileMs: string;
  graph: Graph;
};

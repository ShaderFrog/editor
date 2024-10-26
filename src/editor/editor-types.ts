import { Graph } from '@/core';

export type AddEngineNode = (
  nodeDataType: string,
  name: string,
  position: { x: number; y: number },
  defaultValue?: any
) => [Set<string>, Graph, string] | undefined;

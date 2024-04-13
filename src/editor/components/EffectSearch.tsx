import debounce from 'lodash.debounce';
import { useDraggable } from '@dnd-kit/core';
import {
  useEffect,
  useMemo,
  useState,
  HTMLAttributes,
  useCallback,
} from 'react';

import { SourceNode } from '@core/graph';

import ShaderPreview from './ShaderPreview';
import { Shader } from '@editor/model/Shader';
import SearchBox from './SearchBox';
import { useApi } from '@editor/api';

const DraggableShaderPreview = ({
  shader,
  ...props
}: { shader: Shader } & HTMLAttributes<HTMLDivElement>) => {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `draggable_${shader.id}`,
    data: { shader },
  });

  return (
    <ShaderPreview
      shader={shader}
      ref={setNodeRef}
      {...props}
      {...listeners}
      {...attributes}
    />
  );
};

const EffectSearch = ({
  engine,
  activeNode,
  onSelect,
}: {
  engine: string;
  activeNode: SourceNode;
  onSelect: (shader: Shader) => void;
}) => {
  const api = useApi();
  const [search, setSearch] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [effects, setEffects] = useState<{
    total: number;
    shaders: Shader[];
  }>({ total: 0, shaders: [] });

  const suggestions = ['Noise', 'Fractal', 'Glow', 'Liquid', 'Warp'];

  const doSearch = useCallback(
    async (text: string) => {
      try {
        setIsSearching(true);
        const { count, shaders } = await api.searchShaders({
          text,
          engine,
          tags: ['composable'],
        });

        // Remove shaders with engine nodes. There's probably a more important
        // criteria here that I don't know yet.
        const filtered = (shaders as Shader[]).filter((s) => {
          return (
            !s.config.graph.nodes.find((n) => (n as SourceNode).engine) &&
            // And make sure there's actually nodes in the graph
            s.config.graph.nodes.filter((n) => n.type !== 'output').length > 0
          );
        });

        setEffects({ total: count, shaders: filtered });
      } catch (e) {
        console.error('Error searching', e);
      }
      setIsSearching(false);
    },
    [engine, api]
  );

  const doSearchDebounced = useMemo(() => {
    return debounce(doSearch, 500);
  }, [doSearch]);

  useEffect(() => {
    doSearch('');
  }, [doSearch]);

  const onChange = (search: string) => {
    setSearch(search);
    doSearchDebounced(search);
  };

  const count = effects.shaders.length;

  return (
    <>
      <div>
        <label className="label">Effect Search</label>
        <div className="m-bottom-10">
          <SearchBox value={search} onChange={onChange} />
        </div>
        {suggestions.map((s) => (
          <div
            key={s}
            className="pill pillButton"
            onClick={() => {
              setSearch(s);
              doSearch(s);
            }}
          >
            {s}
          </div>
        ))}
      </div>
      {count && activeNode ? (
        <div className="m-top-10 secondary px12" style={{ height: '28px' }}>
          Replace <span className="primary">&quot;{activeNode.name}&quot;</span>{' '}
          with&hellip;
        </div>
      ) : null}
      <div className="m-top-10 relative">
        {isSearching ? (
          <div className="searching flexCentered">
            <span>Searching&hellip;</span>
          </div>
        ) : null}
        <div>
          <label className="label">Results{count ? ` (${count})` : null}</label>
        </div>
        {count ? (
          <div className="grid col2">
            {effects.shaders.map((shader) => (
              <DraggableShaderPreview
                key={shader.id}
                shader={shader}
                onClick={() => onSelect(shader)}
              />
            ))}
          </div>
        ) : (
          'No results'
        )}
      </div>
    </>
  );
};

export default EffectSearch;

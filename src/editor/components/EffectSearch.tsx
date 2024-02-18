import debounce from 'lodash.debounce';
import { useDraggable } from '@dnd-kit/core';
import React, { useEffect, useMemo, useState, HTMLAttributes } from 'react';

import { SourceNode } from '@core/graph';

import ShaderPreview from './ShaderPreview';
import { EditorShader } from './editorTypes';
import { post } from '@/util/network';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';

const DraggableShaderPreview = ({
  shader,
  ...props
}: { shader: EditorShader } & HTMLAttributes<HTMLDivElement>) => {
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
  searchUrl,
  activeNode,
  onSelect,
}: {
  engine: string;
  searchUrl: string;
  activeNode: SourceNode;
  onSelect: (shader: EditorShader) => void;
}) => {
  const [search, setSearch] = useState<string>('');
  const [effects, setEffects] = useState<{
    total: number;
    shaders: EditorShader[];
  }>({ total: 0, shaders: [] });

  const doSearch = useMemo(() => {
    return debounce(async (text: string) => {
      try {
        const { count, shaders } = await post(searchUrl, { text, engine });

        // Remove shaders with engine nodes. There's probably a more important
        // criteria here that I don't know yet.
        const filtered = (shaders as EditorShader[]).filter((s) => {
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
    }, 500);
  }, [engine, searchUrl]);

  useEffect(() => {
    doSearch('');
  }, [doSearch]);

  const onChange = (event: React.FormEvent<HTMLInputElement>) => {
    const search = event.currentTarget.value || '';
    setSearch(search);
    doSearch(search);
  };

  const count = effects.shaders.length;

  return (
    <>
      <div>
        <label className="label" htmlFor="efsrc">
          Effect Search
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            doSearch(search);
          }}
          className="searchwrap"
        >
          <FontAwesomeIcon icon={faMagnifyingGlass} />
          <input
            name="search"
            id="efsrc"
            className="textinput searchinput"
            placeholder="Effect name"
            onChange={onChange}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                doSearch(search);
              }
            }}
          />
        </form>
      </div>
      {count && activeNode ? (
        <div className="m-top-10 secondary px12" style={{ height: '28px' }}>
          Replace <span className="primary">&quot;{activeNode.name}&quot;</span>{' '}
          with&hellip;
        </div>
      ) : null}
      <div className="m-top-10">
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

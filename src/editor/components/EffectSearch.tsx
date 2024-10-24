import debounce from 'lodash.debounce';
import { useDraggable } from '@dnd-kit/core';
import {
  useEffect,
  useMemo,
  useState,
  HTMLAttributes,
  useCallback,
} from 'react';
import classnames from 'classnames/bind';

import { SourceNode } from '@core/graph';

import ShaderPreview from './ShaderPreview';
import { Shader } from '@editor/model/Shader';
import SearchBox from './SearchBox';
import { useApi } from '@editor/api';

import styles from '../styles/editor.module.css';
const cx = classnames.bind(styles);

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
  const [includeMy, setIncludeMy] = useState(false);
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
        const { count, shaders } = await api.searchEffects({
          text,
          engine,
          includeMy,
          limit: 1000,
        });
        setEffects({ total: count, shaders });
      } catch (e) {
        console.error('Error searching', e);
      }
      setIsSearching(false);
    },
    [engine, api, includeMy]
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
      <div className={styles.searchHeader}>
        <div className="m-bottom-5">
          <SearchBox
            value={search}
            onChange={onChange}
            placeholder="Search effects"
          />
        </div>
        <label className={cx('label px12', styles.controlGrid)}>
          <input
            className="checkbox"
            type="checkbox"
            checked={includeMy}
            onChange={(e) => setIncludeMy(e.target.checked)}
          ></input>
          Include my effects
        </label>
        {suggestions.map((s) => (
          <div
            key={s}
            className="pill pillButton m-right-5"
            onClick={() => {
              setSearch(s);
              doSearch(s);
            }}
          >
            {s}
          </div>
        ))}
      </div>

      <div className="relative p-5-10">
        {count && activeNode ? (
          <div
            className="m-bottom-10 secondary px12"
            style={{ height: '28px' }}
          >
            Replace{' '}
            <span className="primary">&quot;{activeNode.name}&quot;</span>{' '}
            with&hellip;
          </div>
        ) : null}
        {isSearching ? (
          <div className="searching flexCentered">
            <span>Searching&hellip;</span>
          </div>
        ) : null}
        <div>
          <label className="label">Results{count ? ` (${count})` : null}</label>
        </div>
        {count ? (
          <div className="grid col2 break">
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

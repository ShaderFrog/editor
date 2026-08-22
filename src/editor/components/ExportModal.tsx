import React, { useState, useMemo } from 'react';
import MonacoEditor, { BeforeMount } from '@monaco-editor/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClipboard,
  faFileArrowDown,
  faUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons';
import cx from 'classnames';

import { CompileResult, Graph, Grindex } from '@core/graph';
import { AssetsAndGroups } from '@editor/model/Asset';
import Modal from './Modal/Modal';
import { generateExport } from '../export/generateExport';
import styles from '../styles/editor.module.css';

interface ExportModalProps {
  onClose: () => void;
  compileResult: CompileResult;
  graph: Graph;
  grindex: Grindex;
  shaderName: string;
  shaderId?: string;
  hasCompiledGlsl?: boolean;
  assets?: AssetsAndGroups['assets'];
}

const beforeMount: BeforeMount = (monaco) => {
  monaco.editor.defineTheme('exportTheme', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#111111',
      'editor.lineHighlightBackground': '#1a1a1a',
    },
  });
};

const ExportModal = ({
  onClose,
  compileResult,
  graph,
  grindex,
  shaderName,
  shaderId,
  hasCompiledGlsl,
  assets,
}: ExportModalProps) => {
  const [copied, setCopied] = useState(false);

  const { code, usage } = useMemo(
    () => generateExport({ compileResult, graph, grindex, shaderName, assets }),
    [compileResult, graph, grindex, shaderName, assets]
  );

  const lineCount = code.split('\n').length;
  const editorHeight = Math.min(Math.max(lineCount * 19, 200), 500);

  const handleDownload = () => {
    const filename = `${(shaderName || 'shader')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()}.mjs`;
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Modal onClose={onClose}>
      <div className={styles.exportModal}>
        <div className={cx('grid growShrinkShrinkShrink gap-10')}>
          <div>
            <h2 className={styles.exportTitle}>Export Shader</h2>
          </div>
          <div className="nowrap m-top-5 secondary px14">
            {shaderId &&
              (hasCompiledGlsl ? (
                <a
                  href={`/editor/${shaderId}/export`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="linkSpan"
                >
                  <span>Live Export Preview</span>{' '}
                  <FontAwesomeIcon
                    icon={faUpRightFromSquare}
                    className="noHover"
                  />
                </a>
              ) : (
                <span>
                  Recompile the shader and save to generate the export preview
                </span>
              ))}
          </div>
          <div>
            <button
              className="buttonauto formbutton size2 secondary"
              onClick={handleCopy}
            >
              <FontAwesomeIcon icon={faClipboard} className="secondary" />
              {copied ? ' Copied!' : ' Copy'}
            </button>
          </div>
          <div>
            <button
              className="buttonauto formbutton size2 secondary"
              onClick={handleDownload}
            >
              <FontAwesomeIcon icon={faFileArrowDown} className="secondary" />{' '}
              Download
            </button>
          </div>
        </div>
        <div className={styles.exportEditorWrap}>
          <MonacoEditor
            height={editorHeight}
            language="javascript"
            theme="exportTheme"
            value={code}
            beforeMount={beforeMount}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'off',
              renderLineHighlight: 'none',
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              scrollbar: {
                vertical: 'auto',
                horizontal: 'auto',
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
              lineNumbersMinChars: 3,
              fontSize: 12,
              fontFamily:
                "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              padding: { top: 10, bottom: 10 },
            }}
          />
        </div>
      </div>
    </Modal>
  );
};

export default ExportModal;

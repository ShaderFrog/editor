import React, { useState, useMemo } from 'react';
import MonacoEditor, { BeforeMount } from '@monaco-editor/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';

import { CompileResult, Graph, Grindex } from '@core/graph';
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
}: ExportModalProps) => {
  const [copied, setCopied] = useState(false);

  const { code, usage } = useMemo(
    () => generateExport({ compileResult, graph, grindex, shaderName }),
    [compileResult, graph, grindex, shaderName],
  );

  const lineCount = code.split('\n').length;
  const editorHeight = Math.min(Math.max(lineCount * 19, 200), 500);

  const handleDownload = () => {
    const filename = `${(shaderName || 'shader').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mjs`;
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
        <h2 className={styles.exportTitle}>Export Shader</h2>
        <div className={styles.exportControls}>
          <div className={styles.exportActions}>
            <button
              className="buttonauto formbutton size2 secondary"
              onClick={handleCopy}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              className="buttonauto formbutton size2 secondary"
              onClick={handleDownload}
            >
              Download
            </button>
            {shaderId && (
              <a
                href={`/editor/${shaderId}/export`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Try it out&nbsp;
                <FontAwesomeIcon icon={faUpRightFromSquare} />
              </a>
            )}
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

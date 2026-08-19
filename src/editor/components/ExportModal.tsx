import React, { useState, useMemo } from 'react';
import MonacoEditor, { BeforeMount } from '@monaco-editor/react';

import { CompileResult, Graph, Grindex } from '@core/graph';
import Modal from './Modal/Modal';
import { generateExport, ExportFormat } from '../export/generateExport';
import styles from '../styles/editor.module.css';

interface ExportModalProps {
  onClose: () => void;
  compileResult: CompileResult;
  graph: Graph;
  grindex: Grindex;
  shaderName: string;
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
}: ExportModalProps) => {
  const [format, setFormat] = useState<ExportFormat>('es6');
  const [copied, setCopied] = useState(false);

  const exportCode = useMemo(
    () => generateExport({ compileResult, graph, grindex, shaderName, format }),
    [compileResult, graph, grindex, shaderName, format],
  );

  const lineCount = exportCode.split('\n').length;
  const editorHeight = Math.min(Math.max(lineCount * 19, 200), 500);

  const handleDownload = () => {
    const ext = format === 'es6' ? 'mjs' : 'js';
    const filename = `${(shaderName || 'shader').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${ext}`;
    const blob = new Blob([exportCode], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(exportCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Modal onClose={onClose}>
      <div className={styles.exportModal}>
        <h2 className={styles.exportTitle}>Export Shader</h2>
        <div className={styles.exportControls}>
          <div className={styles.exportFormatGroup}>
            <label className={styles.exportLabel}>Format</label>
            <div className={styles.exportFormatButtons}>
              <button
                className={`buttonauto formbutton size2${format === 'es6' ? ' primary' : ' secondary'}`}
                onClick={() => setFormat('es6')}
              >
                ES6 Modules
              </button>
              <button
                className={`buttonauto formbutton size2${format === 'vanilla' ? ' primary' : ' secondary'}`}
                onClick={() => setFormat('vanilla')}
              >
                Vanilla JS
              </button>
            </div>
          </div>
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
          </div>
        </div>
        <div className={styles.exportEditorWrap}>
          <MonacoEditor
            height={editorHeight}
            language="javascript"
            theme="exportTheme"
            value={exportCode}
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

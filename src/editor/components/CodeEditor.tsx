import MonacoEditor, {
  BeforeMount,
  Monaco,
  OnMount,
} from '@monaco-editor/react';
// import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { editor } from 'monaco-editor';
import { monacoGlsl } from '../monaco-glsl';

import { Engine, NodeErrors } from '@shaderfrog/core';
import { usePrevious } from '../hooks/usePrevious';
import { useCallback, useEffect, useRef } from 'react';
import { GlslSyntaxError } from '@shaderfrog/glsl-parser';

type AnyFn = (...args: any) => any;

type CodeEditorProps = {
  engine: Engine;
  identity?: string;
  defaultValue?: string;
  errors?: NodeErrors;
  value?: string;
  readOnly?: boolean;
  onChange?: AnyFn;
  onSave?: AnyFn;
  onCompile?: AnyFn;
};
const CodeEditor = ({
  engine,
  identity,
  errors,
  value,
  defaultValue,
  readOnly,
  onChange,
  onSave,
  onCompile,
}: CodeEditorProps) => {
  const lastErrors = usePrevious(errors);
  const lastIdentity = usePrevious(identity);
  const beforeMount: BeforeMount = (monaco) => {
    monacoGlsl(monaco);

    monaco.editor.defineTheme('frogTheme', {
      base: 'vs-dark', // can also be vs-dark or hc-black
      inherit: true, // can also be false to completely replace the builtin rules
      rules: [
        {
          token: 'comment',
          foreground: 'ffa500',
          fontStyle: 'italic underline',
        },
        { token: 'comment.js', foreground: '008800', fontStyle: 'bold' },
        { token: 'comment.css', foreground: '0000ff' }, // will inherit fontStyle from `comment` above
      ],
      colors: {
        'editor.background': '#000000',
      },
    });

    monaco.languages.registerCompletionItemProvider('glsl', {
      provideCompletionItems: (model, position) => {
        return {
          suggestions: [...engine.preserve.values()].map((keyword) => ({
            label: keyword,
            kind: monaco.languages.CompletionItemKind.Text,
            insertText: keyword,
            range: {
              startLineNumber: 0,
              endLineNumber: 0,
              startColumn: 0,
              endColumn: 0,
            },
          })),
        };
      },
    });
  };

  const lastDecorators = useRef<string[]>([]);
  const editorRef = useRef<editor.IStandaloneCodeEditor>();
  const monacoRef = useRef<Monaco>();

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    checkErrors();

    if (onSave) {
      editor.addAction({
        id: 'save',
        label: 'Save',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: () => {
          onSave?.();
        },
      });
      editor.addAction({
        id: 'compile',
        label: 'Compile',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Quote],
        run: () => {
          onCompile?.();
        },
      });
    }
  };

  const checkErrors = useCallback(() => {
    if (!editorRef.current || !monacoRef.current) {
      return;
    }

    // Highlight error lines
    const nodeErrors = errors?.errors || [];

    // Highlight the gutter and the code background. deltaDecorations clears
    // the previous decorations apparently. it's deprecated but there's no
    // clear replacement method, since createDecorationsCollection doesn't
    // have a way to clear
    lastDecorators.current = editorRef.current!.deltaDecorations(
      lastDecorators.current,

      (
        nodeErrors.filter(
          (error) => typeof error !== 'string'
        ) as GlslSyntaxError[]
      ).map((error) => ({
        range: {
          startLineNumber: error?.location?.start?.line || 0,
          startColumn: error?.location?.start?.column || 0,
          endLineNumber: error?.location?.end?.line || 0,
          endColumn: error?.location?.end?.column || 0,
        },
        options: {
          isWholeLine: true,
          inlineClassName: 'lineError',
          linesDecorationsClassName: 'lineError',
        },
      }))
    );

    monacoRef.current.editor.setModelMarkers(
      editorRef.current.getModel()!,
      'owner',
      nodeErrors.map((error) =>
        typeof error === 'string'
          ? {
              startLineNumber: 1,
              startColumn: 1,
              endLineNumber: 1,
              endColumn: 1,
              message: error,
              severity: monacoRef.current!.MarkerSeverity.Error,
            }
          : {
              startLineNumber: error?.location?.start?.line,
              startColumn: error?.location?.start?.column,
              endLineNumber: error?.location?.end?.line,
              endColumn: error?.location?.end?.column,
              message: error.message,
              severity: monacoRef.current!.MarkerSeverity.Error,
            }
      )
    );
  }, [errors]);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }
    if (identity !== lastIdentity) {
      editorRef.current.setValue(defaultValue || '');
    }
    checkErrors();
  }, [identity, lastIdentity, defaultValue, checkErrors]);

  return (
    <MonacoEditor
      height="100%"
      language="glsl"
      theme="frogTheme"
      {...(value !== undefined ? { value } : {})}
      defaultValue={defaultValue}
      onChange={onChange}
      options={{
        readOnly,
        minimap: { enabled: false },
      }}
      onMount={onMount}
      beforeMount={beforeMount}
    />
  );
};

export default CodeEditor;

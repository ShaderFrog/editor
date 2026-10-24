import MonacoEditor, {
  BeforeMount,
  Monaco,
  OnMount,
} from '@monaco-editor/react';
// import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { languages, editor } from 'monaco-editor';

const scrollCache = new Map<
  string,
  { scrollTop: number; scrollLeft: number }
>();
import { monacoGlsl } from '../monaco-glsl';

import { Engine, NodeErrors } from '@core';
import { usePrevious } from '../hooks/usePrevious';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GlslSyntaxError } from '@shaderfrog/glsl-parser';
import { AnyFn } from '@editor/util/types';

import styles from '../styles/editor.module.css';
import { SMALL_SCREEN_WIDTH, useWindowSize } from '../hooks/useWindowSize';

const consoleError = console.error;
let callback: Function;
console.error = (...args: any[]) => {
  if (callback) {
    callback(...args);
  }
  return consoleError.apply(console, args);
};

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
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    callback = (...args: any[]) => {
      const arg = args?.[0];
      if (
        typeof arg === 'string' &&
        arg.startsWith('Monaco initialization: error')
      ) {
        setErrored(true);
      }
    };
  }, []);

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
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        const suggestions = [
          ...engine.preserve.values(),
        ].map<languages.CompletionItem>((keyword) => ({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Text,
          insertText: keyword,
          range,
        }));
        return {
          suggestions,
        };
      },
    });
  };

  const lastDecorators = useRef<string[]>([]);
  const editorRef = useRef<editor.IStandaloneCodeEditor>();
  const monacoRef = useRef<Monaco>();
  const identityRef = useRef(identity);
  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    checkErrors();

    if (identity && scrollCache.has(identity)) {
      editor.setScrollPosition(scrollCache.get(identity)!);
    }

    editor.onDidScrollChange((e) => {
      const id = identityRef.current;
      if (id) {
        scrollCache.set(id, {
          scrollTop: e.scrollTop,
          scrollLeft: e.scrollLeft,
        });
      }
    });

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
    const model = editorRef.current.getModel()!;

    // Show the first error on each line inline after the code, like VSCode's
    // Error Lens. Hovering the line still shows every full message.
    const messagesByLine = nodeErrors.reduce<Record<number, string[]>>(
      (acc, error) => {
        const line = Math.min(
          typeof error === 'string' ? 1 : error?.location?.start?.line || 1,
          model.getLineCount()
        );
        const message = (typeof error === 'string' ? error : error.message)
          .split('\n')[0]
          .trim();
        acc[line] = [...(acc[line] || []), message];
        return acc;
      },
      {}
    );
    const inlineMessages = Object.entries(messagesByLine).map(
      ([lineStr, messages]) => {
        const line = parseInt(lineStr, 10);
        const first =
          messages[0].length > 150
            ? `${messages[0].substring(0, 150)}…`
            : messages[0];
        const more =
          messages.length > 1 ? ` (+${messages.length - 1} more)` : '';
        return {
          // Cover the whole line, and grow when typing at the end, so the
          // message stays after the code while editing
          range: {
            startLineNumber: line,
            startColumn: 1,
            endLineNumber: line,
            endColumn: model.getLineMaxColumn(line),
          },
          options: {
            stickiness:
              monacoRef.current!.editor.TrackedRangeStickiness
                .GrowsOnlyWhenTypingAfter,
            after: {
              content: `${first}${more}`,
              inlineClassName: 'lineErrorMessage',
              cursorStops:
                monacoRef.current!.editor.InjectedTextCursorStops.None,
            },
          },
        };
      }
    );

    // Highlight the gutter and the code background. deltaDecorations clears
    // the previous decorations apparently. it's deprecated but there's no
    // clear replacement method, since createDecorationsCollection doesn't
    // have a way to clear
    lastDecorators.current = editorRef.current!.deltaDecorations(
      lastDecorators.current,
      [
        ...(
          nodeErrors.filter(
            (error) => typeof error !== 'string'
          ) as GlslSyntaxError[]
        ).map((error) => ({
          range: {
            startLineNumber: error?.location?.start?.line || 0,
            startColumn: 1,
            endLineNumber: error?.location?.end?.line || 0,
            endColumn: 1000,
          },
          options: {
            isWholeLine: true,
            inlineClassName: 'lineError',
            linesDecorationsClassName: 'lineError',
          },
        })),
        ...inlineMessages,
      ]
    );

    monacoRef.current.editor.setModelMarkers(
      model,
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
              startColumn: 1, // error?.location?.start?.column,
              endLineNumber: error?.location?.end?.line,
              endColumn: 1000, // error?.location?.end?.column,
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
      if (identity && scrollCache.has(identity)) {
        editorRef.current.setScrollPosition(scrollCache.get(identity)!);
      }
    }
    checkErrors();
  }, [identity, lastIdentity, defaultValue, checkErrors]);

  const windowSize = useWindowSize();
  const isSmallScreen = windowSize.width < SMALL_SCREEN_WIDTH;

  // Monaco is not supported on mobile
  return errored || isSmallScreen ? (
    <textarea
      spellCheck={false}
      className={styles.fallbackEditor}
      {...(value !== undefined ? { value } : {})}
      defaultValue={defaultValue}
      onChange={(e) => {
        onChange?.(e.target.value);
      }}
      style={{ width: '100%', height: '100%' }}
    ></textarea>
  ) : (
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

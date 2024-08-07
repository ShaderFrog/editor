import { Monaco } from '@monaco-editor/react';

export const monacoGlsl = (monaco: Monaco) => {
  // Register a new language
  monaco.languages.register({ id: 'glsl' });

  // Monarch language example https://microsoft.github.io/monaco-editor/monarch.html
  monaco.languages.setMonarchTokensProvider('glsl', {
    // Set defaultToken to invalid to see what you do not tokenize yet
    defaultToken: 'invalid',
    tokenPostfix: '.js',

    keywords: [
      'attribute',
      'varying',
      'const',
      'bool',
      'float',
      'double',
      'int',
      'uint',
      'break',
      'continue',
      'do',
      'else',
      'for',
      'if',
      'discard',
      'return',
      'switch',
      'case',
      'default',
      'subroutine',
      'bvec2',
      'bvec3',
      'bvec4',
      'ivec2',
      'ivec3',
      'ivec4',
      'uvec2',
      'uvec3',
      'uvec4',
      'vec2',
      'vec3',
      'vec4',
      'mat2',
      'mat3',
      'mat4',
      'centroid',
      'in',
      'out',
      'inout',
      'uniform',
      'patch',
      'sample',
      'buffer',
      'shared',
      'coherent',
      'volatile',
      'restrict',
      'readonly',
      'writeonly',
      'dvec2',
      'dvec3',
      'dvec4',
      'dmat2',
      'dmat3',
      'dmat4',
      'noperspective',
      'flat',
      'smooth',
      'layout',
      'mat2x2',
      'mat2x3',
      'mat2x4',
      'mat3x2',
      'mat3x3',
      'mat3x4',
      'mat4x2',
      'mat4x3',
      'mat4x4',
      'dmat2x2',
      'dmat2x3',
      'dmat2x4',
      'dmat3x2',
      'dmat3x3',
      'dmat3x4',
      'dmat4x2',
      'dmat4x3',
      'dmat4x4',
      'atomic_uint',
      'sampler1D',
      'sampler2D',
      'sampler3D',
      'samplerCube',
      'sampler1DShadow',
      'sampler2DShadow',
      'samplerCubeShadow',
      'sampler1DArray',
      'sampler2DArray',
      'sampler1DArrayShadow',
      'sampler2DArrayshadow',
      'isampler1D',
      'isampler2D',
      'isampler3D',
      'isamplerCube',
      'isampler1Darray',
      'isampler2DArray',
      'usampler1D',
      'usampler2D',
      'usampler3D',
      'usamplerCube',
      'usampler1DArray',
      'usampler2DArray',
      'sampler2DRect',
      'sampler2DRectshadow',
      'isampler2DRect',
      'usampler2DRect',
      'samplerBuffer',
      'isamplerBuffer',
      'usamplerBuffer',
      'samplerCubeArray',
      'samplerCubeArrayShadow',
      'isamplerCubeArray',
      'usamplerCubeArray',
      'sampler2DMS',
      'isampler2DMS',
      'usampler2DMS',
      'sampler2DMSArray',
      'isampler2DMSArray',
      'usampler2DMSArray',
      'image1D',
      'iimage1D',
      'uimage1D',
      'image2D',
      'iimage2D',
      'uimage2D',
      'image3D',
      'iimage3D',
      'uimage3D',
      'image2DRect',
      'iimage2DRect',
      'uimage2DRect',
      'imageCube',
      'iimageCube',
      'uimageCube',
      'imageBuffer',
      'iimageBuffer',
      'uimageBuffer',
      'image1DArray',
      'iimage1DArray',
      'uimage1DArray',
      'image2DArray',
      'iimage2DArray',
      'uimage2DArray',
      'imageCubeArray',
      'iimageCubeArray',
      'uimageCubeArray',
      'image2DMS',
      'iimage2DMS',
      'uimage2DMS',
      'image2DMArray',
      'iimage2DMSArray',
      'uimage2DMSArray',
      'struct',
      'void',
      'while',
      'invariant',
      'precise',
      'highp',
      'mediump',
      'lowp',
      'precision',
    ],

    typeKeywords: ['any', 'boolean', 'number', 'object', 'string', 'undefined'],

    operators: [
      '<=',
      '>=',
      '==',
      '!=',
      '===',
      '!==',
      '=>',
      '+',
      '-',
      '**',
      '*',
      '/',
      '%',
      '++',
      '--',
      '<<',
      '</',
      '>>',
      '>>>',
      '&',
      '|',
      '^',
      '!',
      '~',
      '&&',
      '||',
      '?',
      ':',
      '=',
      '+=',
      '-=',
      '*=',
      '**=',
      '/=',
      '%=',
      '<<=',
      '>>=',
      '>>>=',
      '&=',
      '|=',
      '^=',
      '@',
    ],

    // we include these common regular expressions
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    escapes:
      /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
    digits: /\d+(_+\d+)*/,
    octaldigits: /[0-7]+(_+[0-7]+)*/,
    binarydigits: /[0-1]+(_+[0-1]+)*/,
    hexdigits: /[[0-9a-fA-F]+(_+[0-9a-fA-F]+)*/,

    regexpctl: /[(){}\[\]\$\^|\-*+?\.]/,
    regexpesc:
      /\\(?:[bBdDfnrstvwWn0\\\/]|@regexpctl|c[A-Z]|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4})/,

    // The main tokenizer for our languages
    tokenizer: {
      root: [[/[{}]/, 'delimiter.bracket'], { include: 'common' }],

      common: [
        // identifiers and keywords
        [
          /[a-z_$][\w$]*/,
          {
            cases: {
              '@typeKeywords': 'keyword',
              '@keywords': 'keyword',
              '@default': 'identifier',
            },
          },
        ],
        [/[A-Z][\w\$]*/, 'type.identifier'], // to show class names nicely
        // [/[A-Z][\w\$]*/, 'identifier'],

        // whitespace
        { include: '@whitespace' },

        // regular expression: ensure it is terminated before beginning (otherwise it is an opeator)
        [
          /\/(?=([^\\\/]|\\.)+\/([gimsuy]*)(\s*)(\.|;|\/|,|\)|\]|\}|$))/,
          { token: 'regexp', bracket: '@open', next: '@regexp' },
        ],

        // delimiters and operators
        [/[()\[\]]/, '@brackets'],
        [/[<>](?!@symbols)/, '@brackets'],
        [
          /@symbols/,
          {
            cases: {
              '@operators': 'delimiter',
              '@default': '',
            },
          },
        ],

        // numbers
        [/(@digits)[eE]([\-+]?(@digits))?/, 'number.float'],
        [/(@digits)\.(@digits)([eE][\-+]?(@digits))?/, 'number.float'],
        [/0[xX](@hexdigits)/, 'number.hex'],
        [/0[oO]?(@octaldigits)/, 'number.octal'],
        [/0[bB](@binarydigits)/, 'number.binary'],
        [/(@digits)/, 'number'],

        // delimiter: after number because of .\d floats
        [/[;,.]/, 'delimiter'],

        // strings
        [/"([^"\\]|\\.)*$/, 'string.invalid'], // non-teminated string
        [/'([^'\\]|\\.)*$/, 'string.invalid'], // non-teminated string
        [/"/, 'string', '@string_double'],
        [/'/, 'string', '@string_single'],
        [/`/, 'string', '@string_backtick'],
      ],

      whitespace: [
        [/[ \t\r\n]+/, ''],
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*$/, 'comment'],
      ],

      comment: [
        [/[^\/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[\/*]/, 'comment'],
      ],

      preprocessor: [[/^#.*$/, 'preprocessor']],

      // We match regular expression quite precisely
      regexp: [
        [
          /(\{)(\d+(?:,\d*)?)(\})/,
          [
            'regexp.escape.control',
            'regexp.escape.control',
            'regexp.escape.control',
          ],
        ],
        [
          /(\[)(\^?)(?=(?:[^\]\\\/]|\\.)+)/,
          [
            'regexp.escape.control',
            { token: 'regexp.escape.control', next: '@regexrange' },
          ],
        ],
        [
          /(\()(\?:|\?=|\?!)/,
          ['regexp.escape.control', 'regexp.escape.control'],
        ],
        [/[()]/, 'regexp.escape.control'],
        [/@regexpctl/, 'regexp.escape.control'],
        [/[^\\\/]/, 'regexp'],
        [/@regexpesc/, 'regexp.escape'],
        [/\\\./, 'regexp.invalid'],
        [
          /(\/)([gimsuy]*)/,
          [
            { token: 'regexp', bracket: '@close', next: '@pop' },
            'keyword.other',
          ],
        ],
      ],

      regexrange: [
        [/-/, 'regexp.escape.control'],
        [/\^/, 'regexp.invalid'],
        [/@regexpesc/, 'regexp.escape'],
        [/[^\]]/, 'regexp'],
        [
          /\]/,
          { token: 'regexp.escape.control', next: '@pop', bracket: '@close' },
        ],
      ],

      string_double: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, 'string', '@pop'],
      ],

      string_single: [
        [/[^\\']+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/'/, 'string', '@pop'],
      ],

      string_backtick: [
        [/\$\{/, { token: 'delimiter.bracket', next: '@bracketCounting' }],
        [/[^\\`$]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/`/, 'string', '@pop'],
      ],

      bracketCounting: [
        [/\{/, 'delimiter.bracket', '@bracketCounting'],
        [/\}/, 'delimiter.bracket', '@pop'],
        { include: 'common' },
      ],
    },
  });
};

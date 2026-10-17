import { defineConfig } from 'vitest/config';

const VIRTUAL_KUROMOJI_BROWSER_ID = '\0virtual:kuromoji-browser';

const KUROMOJI_BROWSER_CODE = `
import Tokenizer from 'kuromoji/src/Tokenizer.js';
import DynamicDictionaries from 'kuromoji/src/dict/DynamicDictionaries.js';

async function loadGzipArrayBuffer(url) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error('Failed to load dictionary: ' + url);
  }
  const decompressedStream = response.body.pipeThrough(new DecompressionStream('gzip'));
  return new Response(decompressedStream).arrayBuffer();
}

async function loadDictionaries(dicPath) {
  const basePath = dicPath.endsWith('/') ? dicPath : dicPath + '/';
  const files = [
    'base.dat.gz',
    'check.dat.gz',
    'tid.dat.gz',
    'tid_pos.dat.gz',
    'tid_map.dat.gz',
    'cc.dat.gz',
    'unk.dat.gz',
    'unk_pos.dat.gz',
    'unk_map.dat.gz',
    'unk_char.dat.gz',
    'unk_compat.dat.gz',
    'unk_invoke.dat.gz',
  ];
  const buffers = await Promise.all(files.map((file) => loadGzipArrayBuffer(basePath + file)));
  const dic = new DynamicDictionaries();
  dic.loadTrie(new Int32Array(buffers[0]), new Int32Array(buffers[1]));
  dic.loadTokenInfoDictionaries(
    new Uint8Array(buffers[2]),
    new Uint8Array(buffers[3]),
    new Uint8Array(buffers[4]),
  );
  dic.loadConnectionCosts(new Int16Array(buffers[5]));
  dic.loadUnknownDictionaries(
    new Uint8Array(buffers[6]),
    new Uint8Array(buffers[7]),
    new Uint8Array(buffers[8]),
    new Uint8Array(buffers[9]),
    new Uint32Array(buffers[10]),
    new Uint8Array(buffers[11]),
  );
  return new Tokenizer(dic);
}

const kuromoji = {
  builder(option) {
    const dicPath = option && option.dicPath ? option.dicPath : '/dict/';
    return {
      build(callback) {
        loadDictionaries(dicPath).then(
          (tokenizer) => callback(null, tokenizer),
          (err) => callback(err, null),
        );
      },
    };
  },
};

export default kuromoji;
`;

export default defineConfig({
  optimizeDeps: {
    include: ['kuromoji/src/Tokenizer.js', 'kuromoji/src/dict/DynamicDictionaries.js'],
    exclude: ['kuromoji'],
  },
  plugins: [
    {
      name: 'kuromoji-browser-compat',
      enforce: 'pre',
      resolveId(id, _importer, options) {
        if (id === 'kuromoji' && !options?.ssr) {
          return VIRTUAL_KUROMOJI_BROWSER_ID;
        }
        return null;
      },
      load(id) {
        if (id === VIRTUAL_KUROMOJI_BROWSER_ID) {
          return KUROMOJI_BROWSER_CODE;
        }
        return null;
      },
    },
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});

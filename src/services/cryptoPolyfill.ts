import { CryptoDigestAlgorithm, digest, getRandomValues } from 'expo-crypto';

type RuntimeCrypto = {
  getRandomValues?: (array: Uint8Array) => Uint8Array;
  subtle?: {
    digest?: (algorithm: string | { name: string }, data: ArrayBuffer | ArrayBufferView) => Promise<ArrayBuffer>;
  };
};

type RuntimeGlobals = {
  crypto?: RuntimeCrypto;
  TextEncoder?: new () => { encode(value?: string): Uint8Array };
};

const runtime = globalThis as unknown as RuntimeGlobals;

if (!runtime.TextEncoder) {
  runtime.TextEncoder = class TextEncoderPolyfill {
    encode(value = ''): Uint8Array {
      const utf8 = encodeURIComponent(value).replace(/%([0-9A-F]{2})/gi, (_match, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
      );
      return Uint8Array.from(utf8, (character) => character.charCodeAt(0));
    }
  };
}

const currentCrypto = runtime.crypto;
if (!currentCrypto?.getRandomValues || !currentCrypto.subtle?.digest) {
  const cryptoPolyfill: RuntimeCrypto = {
    getRandomValues: currentCrypto?.getRandomValues?.bind(currentCrypto) ?? getRandomValues,
    subtle: currentCrypto?.subtle?.digest
      ? currentCrypto.subtle
      : {
          digest: async (algorithm, data) => {
            const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
            if (name.toUpperCase() !== 'SHA-256') {
              throw new Error(`Unsupported digest algorithm: ${name}`);
            }
            return digest(CryptoDigestAlgorithm.SHA256, data as ArrayBuffer);
          },
        },
  };

  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: cryptoPolyfill,
  });
}

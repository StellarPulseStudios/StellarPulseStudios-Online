declare module 'heic-convert' {
  interface Options {
    buffer: Buffer | ArrayBuffer | Uint8Array;
    format: 'JPEG' | 'PNG';
    /** De 0 a 1, solo para JPEG. */
    quality?: number;
  }

  export default function heicConvert(options: Options): Promise<ArrayBuffer>;
}

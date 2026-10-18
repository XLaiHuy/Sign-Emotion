/** Pinned Sherpa 1.13.8 browser adaptation and MIT Gipformer weights; no remote catalogue. */
export const GIPFORMER_MANIFEST = {
  profile: 'gipformer1.5-int8@sherpa-1.13.8',
  revision: 'dd9227dcd8705c13f33bdbe59728d546ab94480f',
  assets: [
    {
      file: 'encoder.int8.onnx',
      size: 70876359,
      sha256: 'b528768939c7711a889be81a718ea7f2ee50d0d2d384d53f399e15b44bd9408c',
    },
    {
      file: 'decoder.int8.onnx',
      size: 1308690,
      sha256: 'e0a156b5454722a524230f9e35d5d928cfcdd3723437b418e5bd5e04f1c3a101',
    },
    {
      file: 'joiner.int8.onnx',
      size: 1033417,
      sha256: '12636559d135315f002a1e1b477077d415e888477378db0fd450aee5b21ac551',
    },
    {
      file: 'tokens.txt',
      size: 25847,
      sha256: 'f536d03c2e95ebd2930cf0abec88e823bd17d3c1933da7ae6a82db3b80605e15',
    },
    {
      file: 'sherpa.mjs',
      size: 102774,
      sha256: 'ef7b6ba64e5f030b14f3c16ec36fee89f41a8f84615091ba7d237f0697f404c5',
    },
    {
      file: 'asr.mjs',
      size: 53698,
      sha256: '40a56e955a76829a050dbcf725504a1fdb1579c4ea0cfbef7228fe8355d4341b',
    },
    {
      file: 'sherpa.wasm',
      size: 15133706,
      sha256: 'a802c2e20151126789e24792b76cfc3ab9d9bda60bcd5c6a514f06eb35131a1a',
    },
  ],
} as const;

export default {
  // Emit pure-ASCII JS (non-ASCII becomes \uXXXX). The single-file artifact build
  // inlines this bundle into the HTML, where the document charset is not ours to
  // control, so escaping keeps glyphs like the middle dot from being mangled.
  esbuild: { charset: 'ascii' },
  build: {
    chunkSizeWarningLimit: 800,
  },
};

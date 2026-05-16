./esbuild \
    --bundle frontend_src/js/index.ts frontend_src/index.html \
    --outdir=frontend_dist \
    --outbase=frontend_src \
    --sourcemap \
    --loader:.svg=file \
    --loader:.html=copy \
    --public-path=/debug \
    --asset-names=assets/[name]-[hash] \
    --watch
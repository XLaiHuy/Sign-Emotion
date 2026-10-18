# Research builder only. No publishing flags, model weights or application data.
FROM emscripten/emsdk:4.0.8@sha256:92c97951b9a6835cb5da9592e9d95226f67e09ecd01a541d817a5b4801f235a4 AS builder
RUN apt-get update && apt-get install -y --no-install-recommends git python3-pip ninja-build ca-certificates curl && rm -rf /var/lib/apt/lists/*
ENV GIT_LFS_SKIP_SMUDGE=1 MOONSHINE_ORT_ROOT=/build/ort ORT_WASM_BUILD_DIR=/build/ort EMSDK_VERSION=4.0.8
RUN git clone --depth 1 --branch v0.1.5 https://github.com/moonshine-ai/moonshine.git /build/moonshine && test "$(git -C /build/moonshine rev-parse HEAD)" = 234f60faa0eb388b01cdf7e60aca232af37aefda
RUN curl -fsSL https://media.githubusercontent.com/media/moonshine-ai/moonshine/v0.1.5/core/moonshine-tts/src/zipvoice-voices-data.cpp -o /build/moonshine/core/moonshine-tts/src/zipvoice-voices-data.cpp && echo "f3e4d62cae93c465e1de8521bc5706b9a20f834cbbf37404bf03f0d35dffa012  /build/moonshine/core/moonshine-tts/src/zipvoice-voices-data.cpp" | sha256sum -c -
RUN curl -fsSL https://media.githubusercontent.com/media/moonshine-ai/moonshine/v0.1.5/core/cpp-annote/src/community1_cpp_annote_embedded.cpp -o /build/moonshine/core/cpp-annote/src/community1_cpp_annote_embedded.cpp && echo "9424da4176b33e67e4000ea2a776d64b6a78ee9bbf72d40405fb6805d12758c4  /build/moonshine/core/cpp-annote/src/community1_cpp_annote_embedded.cpp" | sha256sum -c -
RUN python3 -m pip install cmake==3.31.6 packaging numpy sympy flatbuffers setuptools wheel
WORKDIR /build/moonshine
RUN python3 -c 'from pathlib import Path; p=Path("scripts/build-ort-wasm.sh"); s=p.read_text().replace("--parallel ", "--parallel 4 --allow_running_as_root "); p.write_text(s)'
RUN --mount=type=cache,target=/build/ort scripts/build-wasm.sh single-thread
RUN mkdir -p /artifacts/single && cp language-bindings/wasm/dist/moonshine.mjs language-bindings/wasm/dist/moonshine.wasm /artifacts/single/
# Bound the global ORT pool; default Emscripten PThread wrappers alone do not bound compute.
RUN python3 -c 'from pathlib import Path; p=Path("core/ort-utils/ort-utils.cpp"); s=p.read_text(); old="status = ort_api->CreateEnvWithGlobalThreadPools"; assert old in s; s=s.replace(old, "ort_api->SetGlobalIntraOpNumThreads(threading_options, 2);\n  ort_api->SetGlobalInterOpNumThreads(threading_options, 1);\n  ort_api->SetGlobalSpinControl(threading_options, 0);\n  "+old); p.write_text(s)'
RUN python3 -c 'from pathlib import Path; p=Path("language-bindings/wasm/CMakeLists.txt"); s=p.read_text(); old="-sPTHREAD_POOL_SIZE=navigator.hardwareConcurrency"; assert old in s; p.write_text(s.replace(old, "-sPTHREAD_POOL_SIZE=2"))'
RUN scripts/build-wasm.sh skip-ort
RUN mkdir -p /artifacts/two && cp language-bindings/wasm/dist/moonshine.mjs language-bindings/wasm/dist/moonshine.wasm /artifacts/two/ && cp LICENSE /artifacts/LICENSE && git diff > /artifacts/two-thread.patch
RUN --mount=type=cache,target=/build/ort git -C /build/ort/onnxruntime rev-parse HEAD > /artifacts/ort-revision.txt && cp /build/ort/onnxruntime/LICENSE /artifacts/ONNXRUNTIME-LICENSE && cp /build/ort/onnxruntime/ThirdPartyNotices.txt /artifacts/ONNXRUNTIME-THIRD-PARTY-NOTICES
RUN for variant in single two; do cp /artifacts/LICENSE /artifacts/ONNXRUNTIME-LICENSE /artifacts/ONNXRUNTIME-THIRD-PARTY-NOTICES /artifacts/$variant/; done
FROM scratch AS artifacts
COPY --from=builder /artifacts/ /

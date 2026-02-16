module.exports = function override(config) {
  // Enable WebAssembly support
  config.experiments = {
    ...config.experiments,
    asyncWebAssembly: true,
  };

  // Prevent webpack from parsing ONNX runtime WASM files
  config.module.rules.push({
    test: /\.wasm$/,
    type: 'asset/resource',
  });

  return config;
};

import resolve from "@rollup/plugin-node-resolve";

export default {
  input: "./colab_viz.js",
  output: [
    {
      format: "esm",
      file: "./bundle_colab.js",
    },
  ],
  plugins: [resolve()],
};

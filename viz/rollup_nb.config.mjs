import resolve from "@rollup/plugin-node-resolve";

export default {
  input: "./nb_viz.js",
  output: [
    {
      format: "esm",
      file: "./bundle_nb.js",
    },
  ],
  plugins: [resolve()],
};

import resolve from "@rollup/plugin-node-resolve";

export default {
  input: "./quarto_viz.js",
  output: [
    {
      format: "esm",
      file: "./bundle_quarto.js",
    },
  ],
  plugins: [resolve()],
};

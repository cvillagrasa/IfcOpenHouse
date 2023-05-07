import { loadIfcCommon } from "./viz_common.mjs";


async function loadIfc(ifcUrl, fromString=false) {
  const container = document.getElementById("ifcjs-container");
  container.style.width = "60vw";
  container.style.height = "55vh";

  if (ifcUrl === undefined) {
    ifcUrl = "https://cdn.jsdelivr.net/gh/cvillagrasa/IfcOpenHouse@latest/ifc/IfcOpenHouse.ifc";
  }

  loadIfcCommon(ifcUrl, "55vh", "60vw", fromString);
}

// We can access these variables from the Jupyter Notebook
window.loadIfc = loadIfc;

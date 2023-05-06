import { loadIfcCommon } from "./viz_common.mjs";


async function loadIfc(ifcUrl, ifcStr) {
  const container = document.getElementById("ifcjs-container");
  container.style.width = "60vw";
  container.style.height = "55vh";

  let reload = false;
  let fromString = false;
  if (ifcUrl === undefined) {
    if (ifcStr === undefined) {
      ifcUrl = "https://cdn.jsdelivr.net/gh/cvillagrasa/IfcOpenHouse@latest/ifc/IfcOpenHouse.ifc";
    } else {
      ifcUrl = ifcStr;
      reload = true;
      fromString = true;
    }
  }

  loadIfcCommon(ifcUrl, "55vh", "60vw", fromString, reload);
}

// We can access these variables from the Jupyter Notebook
window.loadIfc = loadIfc;

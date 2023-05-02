import { Color } from "three";
import { IfcViewerAPI } from "web-ifc-viewer";


async function loadIfc() {
  const container = document.getElementById("ifcjs-container");
  container.style.height = "25vh";

  const ifcUrl = "https://cdn.jsdelivr.net/gh/cvillagrasa/IfcOpenHouse@latest/ifc/IfcOpenHouse.ifc";
  const viewer = new IfcViewerAPI({
      container,
      backgroundColor: new Color(0xa3adc9),
  });
  viewer.axes.setAxes();
  const model = await viewer.IFC.loadIfcUrl(ifcUrl);
  await viewer.shadowDropper.renderShadow(model.modelID);
  window.ondblclick = () => viewer.IFC.selector.pickIfcItem(true);
  window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
  viewer.clipper.active = true;
}

// Useful to play in the browser / debugging
window.viewer = viewer;
window.model = model;

loadIfc();

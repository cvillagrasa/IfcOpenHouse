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
  window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
  window.ondblclick = async () => {
    const {modelID, stepId} = await viewer.IFC.selector.pickIfcItem(true);
    const ifcType = model.getIfcType(stepId);
    console.log(`#${stepId} ${ifcType}`);
  }

  viewer.clipper.active = true;

  // Useful to play in the browser / debugging
  window.viewer = viewer;
  window.model = model;
}

loadIfc();

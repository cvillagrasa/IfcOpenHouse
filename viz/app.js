import { Color } from "three";
import { IfcViewerAPI } from "web-ifc-viewer";


let viewer = null;
let model = null;


async function loadIfc(ifcUrl, ifcStr) {
  const container = document.getElementById("ifcjs-container");
  container.style.width = "1200px";
  container.style.height = "600px";

  if (ifcUrl === undefined) {
    ifcUrl = "https://github.com/cvillagrasa/IfcOpenHouse/raw/master/ifc/IfcOpenHouse.ifc";
  }

  if (model === null) {
    viewer = new IfcViewerAPI({
      container,
      backgroundColor: new Color(0xa3adc9),
    });
    viewer.axes.setAxes();
  } else {
    await viewer.IFC.removeIfcModel(model.modelID);
  }

  if (ifcStr === undefined) {
    model = await viewer.IFC.loadIfcUrl(ifcUrl);
  } else {
    if (ifcStr.charAt(0) === '"') {
      ifcStr = ifcStr.slice(1, ifcStr.length - 1);
    }
    window.ifcStr = ifcStr;
    let ifcStrArray = ifcStr.split("\\n");
    let ifcFile = await new File(ifcStrArray, "", {type: "text/plain"});
    model = await viewer.IFC.loadIfc(ifcFile);
  }

  await viewer.shadowDropper.renderShadow(model.modelID);
  window.ondblclick = () => viewer.IFC.selector.pickIfcItem(true);
  window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
  viewer.clipper.active = true;
}

window.viewer = viewer;
window.model = model;
window.loadIfc = loadIfc;

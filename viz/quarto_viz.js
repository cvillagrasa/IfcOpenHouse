import { Color } from "three";
import { IfcViewerAPI } from "web-ifc-viewer";


async function loadIfc() {
  const titleHeader = document.getElementById("title-block-header");

  const container = document.createElement("div");
  titleHeader.after(container);
  //container.style.width = "1200px";
  //container.style.height = "600px";

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

loadIfc();
import { loadIfcCommon } from "./viz_common.mjs";


async function loadIfc() {
  const ifcUrl = "https://cdn.jsdelivr.net/gh/cvillagrasa/IfcOpenHouse@latest/ifc/IfcOpenHouse.ifc";
  loadIfcCommon(ifcUrl, "25vh");
}

loadIfc();

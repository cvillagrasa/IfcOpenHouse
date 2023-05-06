import { Color, MeshLambertMaterial } from "three";
import { IfcViewerAPI } from "web-ifc-viewer";


const col2hex = (color) => {
    const hexadecimal = Math.round(color * 255).toString(16);
    return hexadecimal.length === 1 ? "0" + hexadecimal : hexadecimal;
}


const rgb2hex = (red, green, blue) => `#${col2hex(red)}${col2hex(green)}${col2hex(blue)}`


async function makeSubsetWithColourTransparency(stepIDs, colour, transparency) {
    const ifcManager = window.viewer.IFC.loader.ifcManager;
    const scene = window.viewer.context.scene;

    const material = new MeshLambertMaterial({
        transparent: true,
        opacity: 1 - transparency,
        color: colour,
        depthTest: true,
        depthWrite: true
    });

    const subset = ifcManager.createSubset({
        modelID: window.model.modelID,
        ids: stepIDs,
        material: material,
        scene: scene,
        removePrevious: true,
    });
}


async function getSurfaceShadingInfo(model, representation) {
    const ifcManager = window.viewer.IFC.loader.ifcManager;
    const ifcAPI = ifcManager.ifcAPI;
    const definitionShape = await ifcAPI.GetLine(model.modelID, representation["value"]);

        const representationItems = (await Promise.all(
            definitionShape["Representations"]
                .map(async representation => ifcAPI.GetLine(model.modelID, representation["value"]))
                .filter(
                    async shape => (
                        (await shape)["RepresentationIdentifier"]["value"].toUpperCase() === "BODY"
                    )
                )
                .map(async shape => (await shape)["Items"])
        )).flat()

        const styledItems = (await Promise.all(
            representationItems
                .map(
                    async item => ifcAPI.GetLine(
                        model.modelID, (await item)["value"], false, true
                    )
                )
                .map(async item => (await item)["StyledByItem"])
        )).flat()

        const styles = (await Promise.all(
            styledItems
                .map(async styledItem => ifcAPI.GetLine(model.modelID, styledItem["value"]))
                .map(async styledItem => (await styledItem)["Styles"])
        )).flat()

        const surfaceStyles = (await Promise.all(
            styles
                .map(async style => ifcAPI.GetLine(model.modelID, style["value"]))
                .filter(
                    async style => (
                        ifcAPI.GetNameFromTypeCode(
                            (await style)["type"]
                        ).toUpperCase() === "IfcSurfaceStyle".toUpperCase()
                    )
                )
                .map(async style => (await style)["Styles"])
        )).flat()

        const shading = await Promise.all(
            surfaceStyles
                .map(async style => ifcAPI.GetLine(model.modelID, style["value"]))
                .filter(
                    async style => (
                        ifcAPI.GetNameFromTypeCode(
                            (await style)["type"]
                        ).toUpperCase() === "IfcSurfaceStyleShading".toUpperCase()
                    )
                )
                .map(async style => ({
                    "colour": ifcAPI.GetLine(model.modelID, (await style)["SurfaceColour"]["value"]),
                    "transparency": (await style)["Transparency"]["value"]
                }))
                .map(async shading => ({
                    "colour": rgb2hex(
                        (await shading)["colour"]["Red"]["value"],
                        (await shading)["colour"]["Green"]["value"],
                        (await shading)["colour"]["Blue"]["value"]
                    ),
                    "transparency": (await shading)["transparency"]
                }))
        )

        return shading.filter(  // removing duplicates
            (value, index, self) =>
                index === self.findIndex(t => (
                    t["colour"] === value["colour"] && t["transparency"] === value["transparency"]
                ))
        );
}


async function getSurfaceShadingInfoRecursively(model, element) {
    const ifcManager = window.viewer.IFC.loader.ifcManager;
    const ifcAPI = ifcManager.ifcAPI;
    const result = {};
    const ifcLine = await ifcAPI.GetLine(model.modelID, element["expressID"], false, true);
    const ifcClass = await ifcAPI.GetNameFromTypeCode(ifcLine["type"]);
    const spatialStructures = ["IfcProject", "IfcSite", "IfcBuilding", "IfcBuildingStorey"]
        .map(name => name.toUpperCase()
    )
    let hasRepresentation = false;

    if (spatialStructures.includes(ifcClass)) {
        for (const subelement of element["children"]) {
            const currentResults = await getSurfaceShadingInfoRecursively(model, subelement);
            Object.assign(result, currentResults);
            if (ifcLine["Representation"]) hasRepresentation = true;
        }
    } else if (ifcLine["Representation"]) {
        hasRepresentation = true;
    }

    if (hasRepresentation) {
        result[element["expressID"]] = await getSurfaceShadingInfo(model, ifcLine["Representation"]);
    } else if (ifcLine["IsDecomposedBy"].length > 0) {
        const relAggregates = (await Promise.all(ifcLine["IsDecomposedBy"]
            .map(aggregate => aggregate["value"])
            .map(async aggregate => ifcAPI.GetLine(model.modelID, aggregate))
            .map(async aggregate => (await aggregate)["RelatedObjects"])
        )).flat()
        if (relAggregates) {
            const relatedObjects = await Promise.all(relAggregates
                .map(async object => ifcAPI.GetLine(model.modelID, object["value"]))
            )
            for (relatedObject of relatedObjects) {
                if (relatedObject["Representation"]) {
                    result[relatedObject["expressID"]] = await getSurfaceShadingInfo(
                        model, relatedObject["Representation"]
                    );
                }
            }
        }
    }

    return result
}


async function showTransparentSurfaceStyles(model) {
    const ifcManager = window.viewer.IFC.loader.ifcManager;
    const scene = window.viewer.context.scene;
    const ifcProject = await window.model.getSpatialStructure();

    if (ifcProject["type"].toUpperCase() !== "IfcProject".toUpperCase()) {
        console.log(`Main node is not an IfcProject, but a ${ifcProject["type"]}`)
        return;
    }

    const shadingResults = await getSurfaceShadingInfoRecursively(model, ifcProject);
    const shadingInverted = {"noShading": []};

    for (let [stepID, shading] of Object.entries(shadingResults)) {
        stepID = Number(stepID);
        if (shading.length === 0) {
            shadingInverted["noShading"].push(stepID);
            continue;
        } else if (shading.length > 1) {
            const ifcType = await model.getIfcType(stepID);
            console.log(`Entity #${stepID} ${ifcType} has ${shading.length} styles. Ignoring from 2nd onwards...`)
        }
        const chosenShading = shading[0];
        const encodedShading = `${chosenShading["colour"]}${chosenShading["transparency"].toFixed(3)}`
        if (encodedShading in shadingInverted) {
            shadingInverted[encodedShading].push(stepID);
        } else {
            shadingInverted[encodedShading] = [stepID];
        }
    }

    let noShadingIDs = [];

    for (let [encodedShading, stepIDs] of Object.entries(shadingInverted)) {
        if (encodedShading === "noShading") {
            noShadingIDs = noShadingIDs.concat(stepIDs);
            continue;
        }
        const colour = encodedShading.slice(0, 7);
        const transparency = parseFloat(encodedShading.slice(8));

        if (transparency > 0.001) {
            makeSubsetWithColourTransparency(stepIDs, colour, transparency);
        } else {
            noShadingIDs = noShadingIDs.concat(stepIDs);
        }
    }

    const noShadingSubset = ifcManager.createSubset({
        modelID: window.model.modelID,
        ids: noShadingIDs,
        scene: scene,
        removePrevious: true,
    });

    window.model.visible = false;
}

export async function loadIfcCommon(ifcUrl, height, width) {
    const container = document.getElementById("ifcjs-container");
    const infoPanelContainer = document.getElementById("id-info-div");
    const infoPanel = document.getElementById("id-info-p");
    if (width) container.style.width = width;
    if (height) container.style.height = height;

    const viewer = new IfcViewerAPI({
        container,
        backgroundColor: new Color(0x86a6c3),
    });
    viewer.axes.setAxes();
    const model = await viewer.IFC.loadIfcUrl(ifcUrl);
    await viewer.shadowDropper.renderShadow(model.modelID);

    const ifcManager = viewer.IFC.loader.ifcManager;
    const ifcAPI = ifcManager.ifcAPI;
    window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
    window.ondblclick = async () => {
    const pickResult = await viewer.IFC.selector.pickIfcItem(true);
    if (pickResult) {
        const ifcType = await model.getIfcType(pickResult["id"]);
        const element = await ifcAPI.GetLine(model.modelID, pickResult["id"]);

        let info = `#${pickResult["id"]} ${ifcType}`;
        if (element["PredefinedType"]) info += ` [${element["PredefinedType"]["value"]}]`;
        if (element["Name"]) info += ` - ${element["Name"]["value"]}`

        infoPanelContainer.classList.remove("hidden");
        infoPanel.innerHTML = info;
        console.log(info);
    } else {
        viewer.IFC.selector.unpickIfcItems();
        infoPanelContainer.classList.add("hidden");
        infoPanel.innerHTML = "";
    }
    }

    viewer.clipper.active = true;
    window.viewer = viewer;
    window.model = model;
    showTransparentSurfaceStyles(model);
}

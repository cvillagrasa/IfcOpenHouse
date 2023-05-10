from dataclasses import dataclass, field, asdict
from enum import Enum, auto
import ast
import types
from typing import Callable, Optional, Any
import ifcopenshell
import ifcopenshell.api
import ifcopenshell.util.element
import numpy as np
from nptyping import NDArray, Shape, Float


@dataclass
class IfcOpenShellPythonAPI:
    """Helper class to make use of pythonic notation with the IfcOpenShell API
    standard use -> ifcopenshell.api.run('root.create_entity', file, ifc_class='IfcWall')
    instantiating this class as "ios" -> ios.root.create_entity(file, ifc_class='IfcWall')"""

    module_stack: list[str] = field(default_factory=list)

    def __getattr__(self, module: str) -> Optional[Callable]:
        if module == 'shape' or module.startswith('_'):
            return  # weird PyCharm and/or JupyterLab silent calls
        self.module_stack.append(module)
        return self

    def __call__(self, *args, **kwargs) -> Any:
        result: Any = ifcopenshell.api.run('.'.join(self.module_stack), *args, **kwargs)
        self.reset()
        return result

    def reset(self) -> None:
        self.module_stack = []


def entities_to_remove(
        file: ifcopenshell.file, element: ifcopenshell.entity_instance,
        also_consider: Optional[list] = None, do_not_delete: Optional[list] = None
) -> tuple[set, list]:
    also_consider = [] if also_consider is None else also_consider
    do_not_delete = [] if do_not_delete is None else do_not_delete
    to_delete: set = set()
    subgraph: list = list(file.traverse(element, breadth_first=True))
    subgraph.extend(also_consider)
    subgraph_set: set = set(subgraph)
    subelement_queue: list = file.traverse(element, max_levels=1)
    while subelement_queue:
        subelement: ifcopenshell.entity_instance = subelement_queue.pop(0)
        if (
                subelement.id()
                and subelement not in do_not_delete
                and len(set(file.get_inverse(subelement)) - subgraph_set) == 0
        ):
            to_delete.add(subelement)
            subelement_queue.extend(file.traverse(subelement, max_levels=1)[1:])
    return to_delete, subgraph


def remove_entities(file: ifcopenshell.file, entities: set, subgraph: list) -> None:
    for subelement in filter(lambda e: e in entities, subgraph[::-1]):
        try:
            file.remove(subelement)
        except RuntimeError:
            pass  # Instance not part of this file


def remove_references_to_entities(entities: set, module: types.ModuleType) -> None:
    for namespace_name, namespace_var in module.__dict__.items():
        if isinstance(namespace_var, ifcopenshell.entity_instance) and namespace_var in entities:
            module.__dict__[namespace_name] = None


removing_ios_references: bool = False


class RemovingIOSReferences:
    def __enter__(self):
        global removing_ios_references
        removing_ios_references = True

    def __exit__(self, exc_type, exc_value, exc_traceback):
        global removing_ios_references
        removing_ios_references = False


def ios_entity_overwrite_hook(file: ifcopenshell.file, module: types.ModuleType, do_not_delete=None) -> Callable:
    """Audit hook to deal with the removal of ifcopenshell entities when overwriting in the typical experimental
    workflow on a Jupyter Notebook environment. Don't ever use this code in production if you don't understand it."""

    def remove_entity_subgraph_previous_references(variable_name: str, entity: ifcopenshell.entity_instance) -> None:
        entity_type: str = entity.is_a()
        entity_id: int = entity.id()
        to_delete, subgraph = entities_to_remove(file, entity, do_not_delete=do_not_delete)
        with RemovingIOSReferences():
            remove_references_to_entities(to_delete, module)
        remove_entities(file, to_delete, subgraph)
        txt: str = 'was' if len(to_delete) == 0 else 'and its subgraph were'
        print(f'Entity #{entity_id} "{variable_name}" ({entity_type}) {txt} overwritten')

    def _hook(event: str, args: tuple) -> None:
        if event != 'compile' or not args:
            return
        ast_module: Any = args[0]
        if not isinstance(ast_module, ast.Module):
            return
        for token in ast_module.body:
            if not isinstance(token, ast.Assign):
                continue
            target: Any = token.targets[0]
            if not isinstance(target, ast.Name):
                continue
            variable_name: str = target.id
            if variable_name not in module.__dict__:
                continue
            variable: Any = module.__dict__[variable_name]
            if not isinstance(variable, ifcopenshell.entity_instance):
                continue
            global removing_ios_references
            if not removing_ios_references:
                remove_entity_subgraph_previous_references(variable_name, variable)

    return _hook


def placement_matrix(
        placement: list[float, float, float],
        x_local: Optional[list[float, float, float]] = None,
        z_local: Optional[list[float, float, float]] = None,
        scale: float = 1.
) -> NDArray[Shape['4, 4'], Float]:
    """Utility function to obtain the placement matrix for a given position, axis coordinates and scale factor"""

    arr_placement: NDArray[Shape['3'], Float] = np.array(placement)
    arr_x_local: NDArray[Shape['3'], Float] = np.array([1., 0., 0.]) if x_local is None else np.array(x_local)
    arr_z_local: NDArray[Shape['3'], Float] = np.array([0., 0., 1.]) if z_local is None else np.array(z_local)
    arr_y_local = np.cross(arr_z_local, arr_x_local).reshape(-1, 1)  # X (RefDirection) and Z (Axis) are enough
    arr_x_local, arr_z_local = arr_x_local.reshape(-1, 1), arr_z_local.reshape(-1, 1)
    scale_row = np.array([0., 0., 0., scale])
    arr = np.hstack([arr_x_local, arr_y_local, arr_z_local])
    arr = np.hstack([arr, arr_placement.reshape(-1, 1)])
    return np.vstack([arr, scale_row])


lfloat4 = list[float, float, float, float]


def clipping_matrix(
    point: list[float, float, float],
    x_dir: list[float, float, float],
    z_dir: list[float, float, float]
) -> list[lfloat4, lfloat4, lfloat4]:
    """Utility function to obtain the clipping matrix for a plane defined by X, Z directions, and a point"""
    y_dir: list[float, float, float] = np.vectorize(float)(np.cross(
        np.array(z_dir), np.array(x_dir)
    )).tolist()  # X (RefDirection) and Z (Axis) are enough
    return [[x, y, z, p] for x, y, z, p in zip(x_dir, y_dir, z_dir, point)]


@dataclass
class Size2D:
    """Utility class to improve readability of sizes"""
    x: float
    y: float


@dataclass
class Size3D(Size2D):
    """Utility class to improve readability of 3D sizes"""
    z: float


@dataclass
class ColourRGB:
    """Utility class to indicate surface colours in style.add_surface_style"""
    red: float
    green: float
    blue: float
    name: Optional[str] = None
    transparency: float = 0.  # opaque by default

    @property
    def info(self) -> dict[str, float | dict[str, float | str | None]]:
        surface_colour = {key.capitalize(): value for key, value in asdict(self).items() if key != 'transparency'}
        return {'SurfaceColour': surface_colour, 'Transparency': self.transparency}


class TerrainBuildMethod(Enum):
    NONE = auto()
    NATIVE_BSPLINE = auto()  # fancy NURBS surface not supported in the some IFC viewers
    TESSELATE_OCC_SHAPE = auto()  # needs Open Cascade "mamba install -c conda-forge pythonocc-core"


def build_native_bspline_terrain(
        file: ifcopenshell.file, body: ifcopenshell.entity_instance,
        terrain_control_points: list[list[tuple[float, ...], ...], ...], degree: int, multiplicity: int
) -> ifcopenshell.entity_instance:
    terrain_control_point_list = [
        [
            file.create_entity('IfcCartesianPoint', Coordinates=coord) for coord in row
        ] for row in terrain_control_points
    ]
    cpoints_curve = {
        'west': terrain_control_point_list[0],
        'east': terrain_control_point_list[-1],
        'south': [row[0] for row in terrain_control_point_list],
        'north': [row[-1] for row in terrain_control_point_list]
    }
    spline_surface = file.create_entity(
        'IfcBSplineSurfaceWithKnots', UDegree=degree, VDegree=degree,
        ControlPointsList=terrain_control_point_list, SurfaceForm='UNSPECIFIED', UClosed=False,
        VClosed=False, SelfIntersect=False, UMultiplicities=[multiplicity, multiplicity],
        VMultiplicities=[multiplicity, multiplicity], UKnots=[0., 1.], VKnots=[0., 1.],
        KnotSpec='UNSPECIFIED'
    )
    edge_curve_geometries = {
        side: file.create_entity(
            'IfcBSplineCurveWithKnots', Degree=degree, ControlPointsList=curve,
            CurveForm='UNSPECIFIED', ClosedCurve=False, SelfIntersect=False,
            KnotMultiplicities=[multiplicity, multiplicity], Knots=[0., 1.], KnotSpec='UNSPECIFIED'
        ) for side, curve in cpoints_curve.items()
    }
    edge_curve_end_indices = {
        'south': ([0, 0], [-1, 0]), 'north': ([0, -1], [-1, -1]), 'west': ([0, 0], [0, -1]), 'east': ([-1, 0], [-1, -1])
    }
    edge_curve_ends = {
        side: [
            file.create_entity(
                'IfcVertexPoint', VertexGeometry=terrain_control_point_list[indices[i][0]][indices[i][1]]
            ) for i in range(2)
        ] for side, indices in edge_curve_end_indices.items()
    }
    edge_curves = {
        side: file.create_entity(
            'IfcEdgeCurve', EdgeStart=edge_curve_ends[side][0], EdgeEnd=edge_curve_ends[side][1],
            EdgeGeometry=edge_curve_geometry, SameSense=True
        ) for side, edge_curve_geometry in edge_curve_geometries.items()
    }
    oriented_edges = {
        side: file.create_entity('IfcOrientedEdge', EdgeElement=edge_curve, Orientation=side in ('west', 'north'))
        for side, edge_curve in edge_curves.items()
    }
    edge_loop = file.create_entity(
        'IfcEdgeLoop', EdgeList=[oriented_edges[side] for side in ('west', 'north', 'east', 'south')]
    )
    bound = file.create_entity('IfcFaceOuterBound', Bound=edge_loop, Orientation=True)
    advanced_face = file.create_entity(
        'IfcAdvancedFace', Bounds=[bound], FaceSurface=spline_surface, SameSense=True
    )
    closed_shell = file.create_entity('IfcClosedShell', CfsFaces=[advanced_face])
    advanced_brep = file.create_entity('IfcAdvancedBrep', Outer=closed_shell)
    terrain_representation = file.create_entity(
        'IfcShapeRepresentation', ContextOfItems=body, RepresentationIdentifier='Body',
        RepresentationType='AdvancedBrep', Items=[advanced_brep]
    )
    return terrain_representation


def build_tesselated_occ_terrain(
        file: ifcopenshell.file, body: ifcopenshell.entity_instance,
        terrain_control_points: list[list[tuple[float, ...], ...], ...], degree: int, multiplicity: int
) -> ifcopenshell.entity_instance:
    import ifcopenshell.geom
    from OCC.Core.BRepBuilderAPI import BRepBuilderAPI_MakeFace
    from OCC.Core.Geom import Geom_BSplineSurface
    from OCC.Core.TColgp import TColgp_Array2OfPnt
    from OCC.Core.TColStd import TColStd_Array1OfReal, TColStd_Array1OfInteger
    from OCC.Core.gp import gp_Pnt
    from OCC.Core.Precision import precision_Confusion

    cv = TColgp_Array2OfPnt(0, 4, 0, 4)

    for i, row in enumerate(terrain_control_points):
        for j, coord in enumerate(row):
            cv.SetValue(i, j, gp_Pnt(*coord))

    knots = TColStd_Array1OfReal(0, 1)
    knots[0], knots[1] = 0, 1
    mult = TColStd_Array1OfInteger(0, 1)
    mult[0], mult[1] = multiplicity, multiplicity

    surf = Geom_BSplineSurface(cv, knots, knots, mult, mult, degree, degree)
    terrain_shape = BRepBuilderAPI_MakeFace(surf, precision_Confusion())
    terrain_definition_shape = ifcopenshell.geom.tesselate(file.schema, terrain_shape.Shape(), 0.1)
    terrain_representation = terrain_definition_shape.Representations[0]
    terrain_representation.ContextOfItems = body
    file.add(terrain_representation)
    return terrain_representation

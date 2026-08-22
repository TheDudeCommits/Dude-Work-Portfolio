#!/usr/bin/env python3
"""Build the authored v3 torii-to-bridge vertical slice in Blender.

Run with:
  blender --background --factory-startup \
    --python art/blender/gate_bridge_vertical_slice.py -- \
    --output public/art/v3/gate-bridge/gate-bridge-vertical-slice.raw.glb \
    --blend art/blender/gate_bridge_vertical_slice.blend

The script is deterministic and intentionally creates a small number of joined,
material-batched hero meshes. It does not depend on runtime procedural geometry.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from pathlib import Path
from typing import Iterable, Sequence

import bpy
from mathutils import Vector


CONTRACT = "dude.work.sumi-v3/1"
SUMI_ATTRIBUTE = "SumiData"
REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = REPO_ROOT / "public/art/v3/gate-bridge/gate-bridge.raw.glb"
DEFAULT_BLEND = REPO_ROOT / "art/blender/gate_bridge_vertical_slice.blend"

# Preview colors only. The runtime replaces these semantic slots through its
# shared SumiSurfaceMaterial registry.
MATERIAL_SPECS = {
    "MAT_SUMI_WASHI": (0.81, 0.77, 0.68, 1.0, 0.94, 0.0),
    "MAT_SUMI_STONE": (0.36, 0.41, 0.38, 1.0, 0.92, 0.0),
    "MAT_SUMI_TIMBER": (0.22, 0.16, 0.12, 1.0, 0.88, 0.0),
    "MAT_SUMI_VERMILION": (0.50, 0.13, 0.08, 1.0, 0.82, 0.0),
    "MAT_SUMI_FOLIAGE": (0.10, 0.23, 0.18, 1.0, 0.95, 0.0),
    "MAT_SUMI_WATER": (0.18, 0.36, 0.37, 0.82, 0.72, 0.0),
    "MAT_SUMI_SPIRIT": (0.57, 0.64, 0.59, 0.72, 0.80, 0.0),
    "MAT_SUMI_METAL": (0.43, 0.32, 0.14, 1.0, 0.72, 0.18),
}

materials: dict[str, bpy.types.Material] = {}


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def wave(seed: float) -> float:
    return math.sin(seed * 12.9898 + 78.233) * 0.5 + math.sin(seed * 4.117 + 9.17) * 0.5


def clean_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def configure_scene() -> None:
    scene = bpy.context.scene
    bpy.context.preferences.filepaths.save_version = 0
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    # Blender 5.2 exposes Eevee as BLENDER_EEVEE; 4.x used the NEXT suffix.
    try:
        scene.render.engine = "BLENDER_EEVEE"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.world.color = (0.78, 0.81, 0.76)
    scene["asset_contract"] = CONTRACT
    scene["coordinate_contract"] = "Blender Z-up; glTF Y-up; Three.js journey uses -BlenderY as world Z"
    scene["source_provenance"] = "Original project-authored procedural DCC build; no external model sources"


def build_materials() -> None:
    for name, (r, g, b, a, roughness, metallic) in MATERIAL_SPECS.items():
        material = bpy.data.materials.new(name=name)
        material.diffuse_color = (r, g, b, a)
        material.use_nodes = True
        material["runtime_resolver"] = "SumiSurfaceMaterial"
        material["palette_role"] = name.removeprefix("MAT_SUMI_").lower()
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (r, g, b, a)
            bsdf.inputs["Roughness"].default_value = roughness
            bsdf.inputs["Metallic"].default_value = metallic
            if "Alpha" in bsdf.inputs:
                bsdf.inputs["Alpha"].default_value = a
        materials[name] = material


def deselect() -> None:
    bpy.ops.object.select_all(action="DESELECT")


def set_active(obj: bpy.types.Object) -> None:
    deselect()
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def assign_material(obj: bpy.types.Object, material_name: str) -> None:
    if obj.data and hasattr(obj.data, "materials"):
        obj.data.materials.append(materials[material_name])


def apply_transform(obj: bpy.types.Object) -> None:
    set_active(obj)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def apply_modifier(obj: bpy.types.Object, modifier_name: str) -> None:
    set_active(obj)
    bpy.ops.object.modifier_apply(modifier=modifier_name)


def bevel(obj: bpy.types.Object, width: float, segments: int = 2) -> None:
    modifier = obj.modifiers.new(name="DCC_Bevel", type="BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    apply_modifier(obj, modifier.name)


def triangulate(obj: bpy.types.Object) -> None:
    modifier = obj.modifiers.new(name="DCC_Triangulate", type="TRIANGULATE")
    modifier.quad_method = "BEAUTY"
    modifier.ngon_method = "BEAUTY"
    apply_modifier(obj, modifier.name)


def create_empty(
    name: str,
    location: Sequence[float] = (0.0, 0.0, 0.0),
    parent: bpy.types.Object | None = None,
    extras: dict | None = None,
) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.4
    obj.parent = parent
    for key, value in (extras or {}).items():
        obj[key] = value
    return obj


def create_mesh(
    name: str,
    vertices: Sequence[Sequence[float]],
    faces: Sequence[Sequence[int]],
    material_name: str,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    assign_material(obj, material_name)
    return obj


def cube_part(
    name: str,
    location: Sequence[float],
    scale: Sequence[float],
    rotation: Sequence[float],
    material_name: str,
    bevel_width: float,
    bevel_segments: int,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    assign_material(obj, material_name)
    apply_transform(obj)
    if bevel_width > 0:
        bevel(obj, bevel_width, bevel_segments)
    return obj


def cylinder_part(
    name: str,
    location: Sequence[float],
    radius: float,
    depth: float,
    rotation: Sequence[float],
    material_name: str,
    vertices: int,
    bevel_width: float,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    assign_material(obj, material_name)
    if bevel_width:
        bevel(obj, bevel_width, 1)
    return obj


def curve_tube(
    name: str,
    points: Sequence[Sequence[float]],
    radii: Sequence[float],
    material_name: str,
    bevel_depth: float,
    resolution: int,
    bevel_resolution: int,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(name=f"{name}_Curve", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = resolution
    curve.render_resolution_u = resolution
    curve.bevel_depth = bevel_depth
    curve.bevel_resolution = bevel_resolution
    curve.twist_smooth = 8
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate, radius in zip(spline.bezier_points, points, radii):
        point.co = coordinate
        point.radius = radius
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    assign_material(obj, material_name)
    set_active(obj)
    bpy.ops.object.convert(target="MESH")
    return bpy.context.object


def irregular_tapered_post(
    name: str,
    points: Sequence[Sequence[float]],
    radii: Sequence[float],
    material_name: str,
    longitudinal_segments: int,
    radial_segments: int,
    seed: float,
) -> bpy.types.Object:
    """A hand-hewn quadratic post with a changing, non-circular cross-section."""
    p0, p1, p2 = (Vector(point) for point in points)
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    for ring in range(longitudinal_segments + 1):
        t = ring / longitudinal_segments
        center = p0 * (1.0 - t) ** 2 + p1 * (2.0 * (1.0 - t) * t) + p2 * t**2
        if t < 0.5:
            radius = radii[0] + (radii[1] - radii[0]) * (t * 2.0)
        else:
            radius = radii[1] + (radii[2] - radii[1]) * ((t - 0.5) * 2.0)
        ring_turn = 0.025 * math.sin(ring * 1.71 + seed)
        for segment in range(radial_segments):
            angle = segment / radial_segments * math.tau + ring_turn
            hew = 1.0 + 0.055 * wave(seed + segment * 1.9 + ring * 0.37)
            oval = 0.92 + 0.035 * math.sin(segment * 2.3 + seed)
            vertices.append(tuple(center + Vector((
                math.cos(angle) * radius * hew,
                math.sin(angle) * radius * hew * oval,
                0.018 * math.sin(angle * 3.0 + ring * 0.8 + seed),
            ))))
        if ring:
            previous = (ring - 1) * radial_segments
            current = ring * radial_segments
            for segment in range(radial_segments):
                next_segment = (segment + 1) % radial_segments
                faces.append((previous + segment, current + segment, current + next_segment, previous + next_segment))
    faces.append(tuple(reversed(range(radial_segments))))
    last = longitudinal_segments * radial_segments
    faces.append(tuple(last + segment for segment in range(radial_segments)))
    obj = create_mesh(name, vertices, faces, material_name)
    bevel(obj, 0.014, 1)
    return obj


def bent_beam(
    name: str,
    centers: Sequence[Sequence[float]],
    depth: float,
    height: float,
    material_name: str,
    bevel_width: float,
    bevel_segments: int,
) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    for index, center in enumerate(centers):
        x, y, z = center
        taper = 1.0 - 0.035 * abs(index - (len(centers) - 1) * 0.5) / max(1.0, len(centers) * 0.5)
        half_depth = depth * taper * 0.5
        half_height = height * taper * 0.5
        vertices.extend([
            (x, y - half_depth, z - half_height),
            (x, y + half_depth, z - half_height),
            (x, y + half_depth, z + half_height),
            (x, y - half_depth, z + half_height),
        ])
        if index:
            previous = (index - 1) * 4
            current = index * 4
            faces.extend([
                (previous + 0, current + 0, current + 1, previous + 1),
                (previous + 1, current + 1, current + 2, previous + 2),
                (previous + 2, current + 2, current + 3, previous + 3),
                (previous + 3, current + 3, current + 0, previous + 0),
            ])
    faces.extend([(0, 3, 2, 1), tuple(range((len(centers) - 1) * 4, len(centers) * 4))])
    obj = create_mesh(name, vertices, faces, material_name)
    bevel(obj, bevel_width, bevel_segments)
    return obj


def arch_height(x: float) -> float:
    normalized = clamp(abs(x) / 7.1)
    return 0.18 + (1.0 - normalized**1.8) * 1.72


def arch_ribbon(
    name: str,
    segments: int,
    width: float,
    thickness: float,
    material_name: str,
    bevel_width: float,
    asymmetry: float = 0.0,
) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    for index in range(segments + 1):
        t = index / segments
        x = -7.1 + 14.2 * t
        z = arch_height(x) + asymmetry * math.sin(t * math.pi * 1.7)
        derivative = (arch_height(min(7.1, x + 0.02)) - arch_height(max(-7.1, x - 0.02))) / 0.04
        tangent = Vector((1.0, 0.0, derivative)).normalized()
        normal = Vector((-tangent.z, 0.0, tangent.x)).normalized()
        half_width = width * (1.0 + 0.018 * math.sin(index * 1.83)) * 0.5
        center = Vector((x, 3.4 + asymmetry * 0.15 * math.sin(index * 0.7), z))
        top = center + normal * (thickness * 0.5)
        bottom = center - normal * (thickness * 0.5)
        vertices.extend([
            tuple(top + Vector((0.0, -half_width, 0.0))),
            tuple(top + Vector((0.0, half_width, 0.0))),
            tuple(bottom + Vector((0.0, half_width, 0.0))),
            tuple(bottom + Vector((0.0, -half_width, 0.0))),
        ])
        if index:
            p = (index - 1) * 4
            c = index * 4
            faces.extend([
                (p + 0, c + 0, c + 1, p + 1),
                (p + 1, c + 1, c + 2, p + 2),
                (p + 2, c + 2, c + 3, p + 3),
                (p + 3, c + 3, c + 0, p + 0),
            ])
    faces.extend([(0, 3, 2, 1), tuple(range(segments * 4, (segments + 1) * 4))])
    obj = create_mesh(name, vertices, faces, material_name)
    bevel(obj, bevel_width, 2)
    return obj


def radial_landform(
    name: str,
    center: Sequence[float],
    radius_x: float,
    radius_y: float,
    height: float,
    rings: int,
    segments: int,
    seed: float,
    material_name: str,
    flatness: float = 1.0,
) -> bpy.types.Object:
    """Create an irregular, low sculpted bank or basin without a grid silhouette."""
    cx, cy, base_z = center
    vertices: list[tuple[float, float, float]] = [(cx, cy, base_z + height)]
    faces: list[tuple[int, ...]] = []
    for ring in range(1, rings + 1):
        ratio = ring / rings
        for segment in range(segments):
            angle = segment / segments * math.tau
            edge_noise = 1.0 + 0.08 * wave(seed + segment * 0.73) * ratio
            x = cx + math.cos(angle) * radius_x * ratio * edge_noise
            y = cy + math.sin(angle) * radius_y * ratio * (1.0 + 0.055 * wave(seed + segment * 1.17 + ring))
            crown = max(0.0, 1.0 - ratio**1.65)
            z = base_z + height * crown * (1.0 + 0.12 * wave(seed + x * 0.3 + y * 0.24))
            z += 0.035 * flatness * math.sin(angle * 3.0 + seed)
            vertices.append((x, y, z))
    for segment in range(segments):
        faces.append((0, 1 + segment, 1 + (segment + 1) % segments))
    for ring in range(2, rings + 1):
        previous_start = 1 + (ring - 2) * segments
        current_start = 1 + (ring - 1) * segments
        for segment in range(segments):
            next_segment = (segment + 1) % segments
            faces.append((
                previous_start + segment,
                current_start + segment,
                current_start + next_segment,
                previous_start + next_segment,
            ))
    obj = create_mesh(name, vertices, faces, material_name)
    bevel(obj, 0.035, 1)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def path_bed(name: str, segments: int, material_name: str) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    for index in range(segments + 1):
        t = index / segments
        y = -18.6 + 12.2 * t
        center_x = 0.14 * math.sin(t * math.pi * 2.4) - 0.06 * math.sin(t * math.pi * 5.1)
        width = 1.48 + 0.34 * math.sin(t * math.pi) + 0.10 * math.sin(index * 1.7)
        z = -0.015 + 0.035 * math.sin(t * math.pi * 1.6)
        vertices.extend([
            (center_x - width, y, z + 0.08),
            (center_x + width, y, z + 0.08),
            (center_x + width * 1.04, y, z - 0.10),
            (center_x - width * 1.04, y, z - 0.10),
        ])
        if index:
            p = (index - 1) * 4
            c = index * 4
            faces.extend([
                (p + 0, c + 0, c + 1, p + 1),
                (p + 1, c + 1, c + 2, p + 2),
                (p + 2, c + 2, c + 3, p + 3),
                (p + 3, c + 3, c + 0, p + 0),
            ])
    faces.extend([(0, 3, 2, 1), tuple(range(segments * 4, (segments + 1) * 4))])
    obj = create_mesh(name, vertices, faces, material_name)
    bevel(obj, 0.045, 2)
    return obj


def brush_leaf(
    name: str,
    location: Sequence[float],
    length: float,
    width: float,
    rotation: Sequence[float],
    material_name: str = "MAT_SUMI_FOLIAGE",
) -> bpy.types.Object:
    # A thin, skewed six-point brush stroke reads as foliage rather than a card.
    vertices = [
        (-length * 0.52, 0.0, 0.0),
        (-length * 0.10, -width * 0.55, width * 0.08),
        (length * 0.54, 0.0, 0.0),
        (-length * 0.08, width * 0.48, -width * 0.04),
        (-length * 0.45, 0.0, -0.035),
        (length * 0.45, 0.0, -0.035),
    ]
    faces = [(0, 1, 2, 3), (5, 1, 0, 4), (2, 1, 5), (4, 3, 2, 5)]
    obj = create_mesh(name, vertices, faces, material_name)
    obj.location = location
    obj.rotation_euler = rotation
    apply_transform(obj)
    return obj


def pine_needle_cluster(
    name: str,
    center: Sequence[float],
    extent: Sequence[float],
    seed: int,
    count: int,
) -> bpy.types.Object:
    """Create a dense double-sided needle tuft with no billboard or paddle mass."""
    rng = random.Random(seed)
    cx, cy, cz = center
    ex, ey, ez = extent
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    for _index in range(count):
        angle = rng.uniform(0.0, math.tau)
        radius = math.sqrt(rng.random())
        root = Vector((
            cx + math.cos(angle) * ex * radius,
            cy + math.sin(angle) * ey * radius,
            cz + rng.uniform(-ez, ez) * (0.35 + radius * 0.65),
        ))
        direction = Vector((
            math.cos(angle) * rng.uniform(0.72, 1.12),
            math.sin(angle) * rng.uniform(0.32, 0.70),
            rng.uniform(-0.28, 0.38),
        )).normalized()
        length = rng.uniform(0.32, 0.66) * (0.82 + ex * 0.18)
        tip = root + direction * length
        side = direction.cross(Vector((0.0, 0.0, 1.0)))
        if side.length < 0.01:
            side = Vector((1.0, 0.0, 0.0))
        side.normalize()
        second_side = direction.cross(side).normalized()
        width = rng.uniform(0.018, 0.038)
        thickness = width * 0.42
        base = len(vertices)
        vertices.extend([
            tuple(root - side * width - second_side * thickness),
            tuple(root + side * width - second_side * thickness),
            tuple(tip - second_side * thickness * 0.24),
            tuple(root - side * width + second_side * thickness),
            tuple(root + side * width + second_side * thickness),
            tuple(tip + second_side * thickness * 0.24),
        ])
        # A closed triangular prism keeps each needle present from every camera
        # angle without duplicate opposite-winding faces.
        faces.extend([
            (base + 0, base + 1, base + 2),
            (base + 5, base + 4, base + 3),
            (base + 0, base + 3, base + 4),
            (base + 0, base + 4, base + 1),
            (base + 1, base + 4, base + 5),
            (base + 1, base + 5, base + 2),
            (base + 2, base + 5, base + 3),
            (base + 2, base + 3, base + 0),
        ])
    return create_mesh(name, vertices, faces, "MAT_SUMI_FOLIAGE")


def irregular_rock(
    name: str,
    location: Sequence[float],
    scale: Sequence[float],
    rotation: Sequence[float],
    subdivisions: int,
    seed: float,
    material_name: str = "MAT_SUMI_STONE",
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1.0, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    assign_material(obj, material_name)
    apply_transform(obj)
    for vertex in obj.data.vertices:
        position = vertex.co
        variation = 1.0 + 0.095 * wave(seed + position.x * 2.7 + position.y * 4.1 + position.z * 5.3)
        position *= variation
        position.x += 0.025 * math.sin(position.z * 4.0 + seed)
    obj.data.update()
    bevel(obj, 0.025 if subdivisions > 1 else 0.04, 1)
    return obj


def join_parts(
    parts: Iterable[bpy.types.Object],
    name: str,
    parent: bpy.types.Object,
    lod: int,
    wind: float,
    wind_materials: dict[str, float] | None = None,
    ink_profile: str = "default",
) -> bpy.types.Object:
    objects = [obj for obj in parts if obj and obj.type == "MESH"]
    if not objects:
        raise RuntimeError(f"No mesh parts created for {name}")
    deselect()
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    result = bpy.context.object
    result.name = name
    result.data.name = f"{name}_Mesh"
    result.parent = parent
    triangulate(result)
    result["asset_contract"] = CONTRACT
    result["lod"] = lod
    result["lod_policy"] = "exclusive; runtime must show exactly one LOD"
    result["streaming_zone"] = "gate-bridge"
    result["vertex_color_contract"] = "COLOR_0: R pigment, G wetness, B dry-edge, A wind"
    result["runtime_materials"] = "semantic slots; replace through shared SumiSurfaceMaterial registry"
    result["ink_profile"] = ink_profile
    paint_sumi_data(result, wind, wind_materials, ink_profile)
    return result


def paint_sumi_data(
    obj: bpy.types.Object,
    wind: float,
    wind_materials: dict[str, float] | None = None,
    ink_profile: str = "default",
) -> None:
    mesh = obj.data
    existing = mesh.color_attributes.get(SUMI_ATTRIBUTE)
    if existing:
        mesh.color_attributes.remove(existing)
    attribute = mesh.color_attributes.new(name=SUMI_ATTRIBUTE, type="BYTE_COLOR", domain="POINT")
    if not mesh.vertices:
        return
    zs = [vertex.co.z for vertex in mesh.vertices]
    z_min, z_max = min(zs), max(zs)
    span = max(0.001, z_max - z_min)
    vertex_wind = [wind] * len(mesh.vertices)
    if wind_materials:
        for polygon in mesh.polygons:
            material = obj.material_slots[polygon.material_index].material if polygon.material_index < len(obj.material_slots) else None
            material_wind = wind_materials.get(material.name, wind) if material else wind
            for vertex_index in polygon.vertices:
                resolved_wind = material_wind
                if material and material.name == "MAT_SUMI_TIMBER" and mesh.vertices[vertex_index].co.z < 1.8:
                    resolved_wind = 0.0
                vertex_wind[vertex_index] = max(vertex_wind[vertex_index], resolved_wind)
    for vertex in mesh.vertices:
        normal = vertex.normal.normalized() if vertex.normal.length else Vector((0.0, 0.0, 1.0))
        height = (vertex.co.z - z_min) / span
        grain = wave(vertex.co.x * 1.73 + vertex.co.y * 2.31 + vertex.co.z * 3.17)
        if ink_profile == "weathered-vermilion":
            vertical_streak = 0.5 + 0.5 * math.sin(vertex.co.z * 7.4 + vertex.co.x * 2.1 + grain * 2.8)
            cross_grain = 0.5 + 0.5 * math.sin(vertex.co.x * 11.7 + vertex.co.y * 8.3 + vertex.co.z * 1.9)
            pigment = clamp(0.30 + vertical_streak * 0.48 + grain * 0.18 - cross_grain * 0.12)
            wetness = clamp(0.12 + (1.0 - height) * 0.20 + vertical_streak * 0.12)
            dry_edge = clamp(0.52 + (1.0 - vertical_streak) * 0.34 + cross_grain * 0.18)
        else:
            pigment = clamp(0.58 + grain * 0.18 + (1.0 - normal.z) * 0.08)
            wetness = clamp(0.28 + (1.0 - height) * 0.24 - grain * 0.08)
            dry_edge = clamp(0.38 + abs(normal.z) * 0.20 + grain * 0.12)
        wind_weight = clamp(vertex_wind[vertex.index] * (0.22 + height * 0.78))
        attribute.data[vertex.index].color = (pigment, wetness, dry_edge, wind_weight)
    try:
        mesh.color_attributes.active_color = attribute
    except Exception:
        try:
            mesh.color_attributes.active_color_index = list(mesh.color_attributes).index(attribute)
        except Exception:
            pass


def build_torii(parent: bpy.types.Object, lod: int) -> bpy.types.Object:
    high = lod == 0
    parts: list[bpy.types.Object] = []
    y = -11.7
    bevel_resolution = 3 if high else 1
    posts = [
        ("L", -2.57, -0.05, (-2.57, y, 0.08), (-2.76, y + 0.10, 2.18), (-2.49, y - 0.06, 5.46)),
        ("R", 2.55, 0.04, (2.55, y, 0.08), (2.40, y - 0.08, 2.30), (2.66, y + 0.05, 5.38)),
    ]
    for side, _x, _lean, p0, p1, p2 in posts:
        parts.append(irregular_tapered_post(
            f"Torii_Post_{side}_{lod}", [p0, p1, p2], [0.47, 0.39, 0.31],
            "MAT_SUMI_VERMILION",
            14 if high else 7,
            12 if high else 8,
            401.0 if side == "L" else 419.0,
        ))
        parts.append(irregular_rock(
            f"Torii_Foot_{side}_{lod}", (p0[0], y, 0.18),
            (0.72 if side == "L" else 0.66, 0.58, 0.30),
            (0.04, -0.12 if side == "L" else 0.10, 0.08),
            2 if high else 1, 11.0 if side == "L" else 17.0,
        ))
    beam_sections = 13 if high else 7
    crown_centers = []
    inner_centers = []
    nuki_centers = []
    for index in range(beam_sections):
        t = index / (beam_sections - 1)
        x = -4.65 + 9.3 * t
        edge_lift = (abs(t - 0.5) * 2.0) ** 1.65
        crown_centers.append((x, y + 0.055 * math.sin(t * math.pi * 3.0), 5.46 + 0.36 * edge_lift + 0.035 * math.sin(t * math.pi * 5.0)))
        inner_centers.append((x * 0.82, y + 0.028 * math.sin(t * math.pi * 2.0), 5.00 + 0.20 * edge_lift))
        nuki_centers.append((x * 0.82, y - 0.02, 4.37 - 0.09 * (1.0 - edge_lift) + 0.045 * math.sin(t * math.pi * 3.0 + 0.4)))
    parts.extend([
        bent_beam(f"Torii_Crown_{lod}", crown_centers, 0.58, 0.46, "MAT_SUMI_TIMBER", 0.085, bevel_resolution),
        bent_beam(f"Torii_Inner_{lod}", inner_centers, 0.42, 0.28, "MAT_SUMI_VERMILION", 0.045, bevel_resolution),
        bent_beam(f"Torii_Nuki_{lod}", nuki_centers, 0.36, 0.30, "MAT_SUMI_VERMILION", 0.045, bevel_resolution),
    ])
    if high:
        # Unequal timber wedges create a handmade silhouette at the beam/post joins.
        parts.append(cube_part("Torii_Wedge_L", (-2.57, y, 4.72), (0.42, 0.24, 0.17), (0.02, -0.08, -0.06), "MAT_SUMI_TIMBER", 0.06, 2))
        parts.append(cube_part("Torii_Wedge_R", (2.55, y, 4.68), (0.38, 0.23, 0.15), (-0.03, 0.05, 0.08), "MAT_SUMI_TIMBER", 0.05, 2))
    result = join_parts(parts, f"VIS_Torii_LOD{lod}", parent, lod, 0.02, ink_profile="weathered-vermilion")
    result["next_lod"] = "VIS_Torii_LOD1" if lod == 0 else ""
    result["screen_coverage"] = 0.22 if lod == 0 else 0.0
    return result


def build_rope_bells(parent: bpy.types.Object, lod: int) -> bpy.types.Object:
    high = lod == 0
    y = -11.42
    parts: list[bpy.types.Object] = []
    rope_points = [(-2.25, y, 3.90), (-1.16, y + 0.05, 3.56), (0.08, y + 0.08, 3.42), (1.32, y + 0.04, 3.60), (2.24, y, 3.88)]
    parts.append(curve_tube(f"Rope_Main_{lod}", rope_points, [0.9, 1.04, 1.1, 1.0, 0.88], "MAT_SUMI_TIMBER", 0.072, 4 if high else 2, 2 if high else 1))
    if high:
        for strand in (-1.0, 1.0):
            strand_points = []
            for index in range(17):
                t = index / 16
                x = -2.22 + 4.44 * t
                z = 3.42 + 0.47 * (abs(t - 0.5) * 2.0) ** 1.65
                phase = t * math.pi * 8.0 + strand * 0.7
                strand_points.append((x, y + math.sin(phase) * 0.045, z + math.cos(phase) * 0.045))
            parts.append(curve_tube(f"Rope_Braid_{strand:+.0f}", strand_points, [1.0] * len(strand_points), "MAT_SUMI_TIMBER", 0.025, 1, 1))
    bell_positions = [(-0.92, y + 0.02, 3.36), (0.12, y + 0.09, 3.20), (1.18, y + 0.03, 3.43)] if high else [(0.10, y + 0.08, 3.22)]
    for index, (x, bell_y, z) in enumerate(bell_positions):
        parts.append(curve_tube(f"Bell_Cord_{index}_{lod}", [(x, bell_y, z + 0.12), (x + 0.025 * (-1) ** index, bell_y, z - 0.28)], [0.9, 0.7], "MAT_SUMI_TIMBER", 0.026, 1, 1))
        bpy.ops.mesh.primitive_cone_add(vertices=16 if high else 10, radius1=0.22 if index == 1 else 0.17, radius2=0.095, depth=0.31, location=(x, bell_y, z - 0.43))
        bell = bpy.context.object
        bell.name = f"Bell_{index}_{lod}"
        assign_material(bell, "MAT_SUMI_METAL")
        bevel(bell, 0.025, 2 if high else 1)
        parts.append(bell)
    # Wordless folded washi prayers; unequal lengths avoid a templated rhythm.
    strips = [(-1.48, 0.70, -0.10), (-0.46, 0.86, 0.05), (0.74, 0.62, 0.13), (1.54, 0.78, -0.08)] if high else [(-0.62, 0.70, -0.06), (0.78, 0.65, 0.08)]
    for index, (x, length, tilt) in enumerate(strips):
        strip = cube_part(f"Prayer_Strip_{index}_{lod}", (x, y + 0.06, 3.15 - length * 0.5), (0.11, 0.018, length * 0.5), (0.02, tilt, tilt), "MAT_SUMI_WASHI", 0.018, 1)
        parts.append(strip)
    result = join_parts(parts, f"VIS_RopeBells_LOD{lod}", parent, lod, 0.88)
    result["next_lod"] = "VIS_RopeBells_LOD1" if lod == 0 else ""
    result["screen_coverage"] = 0.30 if lod == 0 else 0.0
    return result


def build_bridge(parent: bpy.types.Object, lod: int) -> bpy.types.Object:
    high = lod == 0
    parts: list[bpy.types.Object] = [
        arch_ribbon(f"Bridge_Deck_{lod}", 48 if high else 20, 2.46, 0.27, "MAT_SUMI_VERMILION", 0.055 if high else 0.075, 0.035),
    ]
    rail_samples = 11 if high else 7
    for side, y_offset in (("L", -1.18), ("R", 1.18)):
        points = []
        for index in range(rail_samples):
            t = index / (rail_samples - 1)
            x = -7.04 + 14.08 * t
            irregular = (0.028 if side == "L" else -0.018) * math.sin(index * 1.91)
            points.append((x, 3.4 + y_offset + irregular, arch_height(x) + 1.12 + 0.025 * math.sin(index * 0.83)))
        parts.append(curve_tube(f"Bridge_Rail_{side}_{lod}", points, [0.78 + 0.04 * math.sin(i * 0.8) for i in range(rail_samples)], "MAT_SUMI_TIMBER", 0.14, 3 if high else 2, 2 if high else 1))
    upright_xs = [-5.85, -4.15, -2.25, -0.18, 1.92, 3.92, 5.72] if high else [-5.6, -2.8, 0.0, 2.8, 5.6]
    for index, x in enumerate(upright_xs):
        for side_index, y_offset in enumerate((-1.18, 1.18)):
            lean = 0.035 * math.sin(index * 1.4 + side_index)
            parts.append(curve_tube(
                f"Bridge_Upright_{index}_{side_index}_{lod}",
                [(x, 3.4 + y_offset, arch_height(x) + 0.04), (x + lean, 3.4 + y_offset, arch_height(x) + 1.16)],
                [1.0, 0.72], "MAT_SUMI_TIMBER", 0.10, 1, 1,
            ))
    if high:
        for index in range(19):
            t = index / 18
            x = -6.72 + 13.44 * t
            slope = -math.copysign(max(0.04, abs(x) / 7.1 * 0.35), x)
            plank = cube_part(
                f"Bridge_Plank_{index}",
                (x, 3.4 + 0.012 * math.sin(index * 2.1), arch_height(x) + 0.18),
                (0.27 + 0.015 * math.sin(index), 1.20, 0.055),
                (0.0, slope, 0.006 * math.sin(index * 1.7)),
                "MAT_SUMI_TIMBER", 0.025, 1,
            )
            parts.append(plank)
    result = join_parts(parts, f"VIS_MoonBridge_LOD{lod}", parent, lod, 0.04)
    result["next_lod"] = "VIS_MoonBridge_LOD1" if lod == 0 else ""
    result["screen_coverage"] = 0.18 if lod == 0 else 0.0
    return result


def build_rocks(parent: bpy.types.Object, lod: int) -> bpy.types.Object:
    high = lod == 0
    specifications = [
        ((6.45, 0.95, 0.64), (1.85, 1.12, 2.35), (0.10, -0.42, 0.08), 4.0),
        ((7.86, 0.42, 0.30), (1.34, 1.56, 0.92), (-0.08, 0.28, -0.12), 7.0),
        ((5.22, 0.05, 0.24), (1.12, 0.88, 0.64), (0.06, 0.52, 0.04), 10.0),
        ((8.62, 1.60, 0.20), (0.82, 0.70, 0.52), (0.12, -0.18, 0.10), 13.0),
        ((6.02, 2.20, 0.18), (0.72, 0.62, 0.44), (-0.04, 0.84, -0.08), 18.0),
    ]
    if not high:
        specifications = specifications[:3]
    parts = [
        irregular_rock(f"Rock_Composition_{index}_{lod}", location, scale, rotation, 2 if high else 1, seed)
        for index, (location, scale, rotation, seed) in enumerate(specifications)
    ]
    result = join_parts(parts, f"VIS_RockComposition_LOD{lod}", parent, lod, 0.02)
    result["next_lod"] = "VIS_RockComposition_LOD1" if lod == 0 else ""
    result["screen_coverage"] = 0.15 if lod == 0 else 0.0
    return result


def build_pine(parent: bpy.types.Object, lod: int) -> bpy.types.Object:
    high = lod == 0
    parts: list[bpy.types.Object] = []
    trunk_points = [(-8.65, 6.30, 0.0), (-8.82, 6.16, 1.8), (-8.38, 6.28, 3.6), (-8.92, 6.10, 5.45), (-8.18, 6.32, 7.1)]
    parts.append(curve_tube(f"Pine_Trunk_{lod}", trunk_points, [1.34, 1.16, 0.95, 0.72, 0.48], "MAT_SUMI_TIMBER", 0.46, 4 if high else 2, 3 if high else 1))
    branches = [
        ([(-8.48, 6.25, 3.45), (-6.95, 6.38, 4.10), (-5.15, 6.15, 4.28)], [0.92, 0.65, 0.34]),
        ([(-8.80, 6.12, 4.65), (-10.28, 6.38, 5.20), (-11.82, 6.72, 5.08)], [0.88, 0.62, 0.30]),
        ([(-8.56, 6.18, 5.55), (-7.35, 5.55, 6.14), (-6.10, 5.36, 6.02)], [0.75, 0.50, 0.26]),
        ([(-8.55, 6.24, 6.18), (-9.55, 5.62, 6.78), (-10.55, 5.40, 6.72)], [0.65, 0.44, 0.24]),
        ([(-8.18, 6.30, 7.02), (-7.35, 6.52, 7.62), (-6.52, 6.64, 7.55)], [0.54, 0.36, 0.21]),
    ]
    if not high:
        branches = branches[:3]
    for index, (points, radii) in enumerate(branches):
        parts.append(curve_tube(f"Pine_Branch_{index}_{lod}", points, radii, "MAT_SUMI_TIMBER", 0.27, 3 if high else 2, 2 if high else 1))
    # Each branch resolves into a hierarchy of thin twigs and discrete needle
    # sprays. No ellipsoid or paddle canopy geometry is used.
    needle_specs = [
        ((-4.72, 6.04, 4.52), (0.82, 0.42, 0.34), 211),
        ((-5.62, 6.28, 4.70), (0.74, 0.38, 0.31), 223),
        ((-6.46, 6.02, 4.42), (0.66, 0.36, 0.29), 227),
        ((-12.42, 6.78, 5.20), (0.88, 0.40, 0.34), 229),
        ((-11.48, 6.58, 5.48), (0.74, 0.36, 0.30), 233),
        ((-10.58, 6.38, 5.12), (0.62, 0.34, 0.27), 239),
        ((-5.70, 5.18, 6.15), (0.82, 0.38, 0.32), 241),
        ((-6.58, 5.42, 6.42), (0.74, 0.36, 0.30), 251),
        ((-7.42, 5.54, 6.06), (0.62, 0.34, 0.28), 257),
        ((-10.90, 5.24, 6.80), (0.76, 0.36, 0.30), 263),
        ((-9.96, 5.48, 7.04), (0.70, 0.34, 0.28), 269),
        ((-5.98, 6.72, 7.70), (0.80, 0.38, 0.32), 271),
        ((-6.88, 6.58, 7.98), (0.72, 0.36, 0.29), 277),
        ((-8.02, 6.32, 7.38), (0.68, 0.34, 0.30), 281),
        ((-8.82, 6.12, 7.70), (0.58, 0.32, 0.27), 283),
    ]
    twig_specs = [
        ((-5.15, 6.15, 4.28), (-4.92, 6.10, 4.42), (-4.72, 6.04, 4.52)),
        ((-5.45, 6.20, 4.36), (-5.52, 6.25, 4.56), (-5.62, 6.28, 4.70)),
        ((-6.05, 6.26, 4.18), (-6.24, 6.12, 4.32), (-6.46, 6.02, 4.42)),
        ((-11.82, 6.72, 5.08), (-12.08, 6.76, 5.14), (-12.42, 6.78, 5.20)),
        ((-11.25, 6.58, 5.18), (-11.38, 6.56, 5.36), (-11.48, 6.58, 5.48)),
        ((-10.55, 6.44, 5.04), (-10.58, 6.42, 5.10), (-10.58, 6.38, 5.12)),
        ((-6.10, 5.36, 6.02), (-5.92, 5.24, 6.10), (-5.70, 5.18, 6.15)),
        ((-6.48, 5.42, 6.10), (-6.54, 5.42, 6.28), (-6.58, 5.42, 6.42)),
        ((-7.10, 5.52, 5.98), (-7.26, 5.54, 6.02), (-7.42, 5.54, 6.06)),
        ((-10.55, 5.40, 6.72), (-10.72, 5.30, 6.76), (-10.90, 5.24, 6.80)),
        ((-9.72, 5.54, 6.74), (-9.86, 5.50, 6.92), (-9.96, 5.48, 7.04)),
        ((-6.52, 6.64, 7.55), (-6.24, 6.68, 7.64), (-5.98, 6.72, 7.70)),
        ((-6.80, 6.62, 7.62), (-6.84, 6.60, 7.84), (-6.88, 6.58, 7.98)),
        ((-8.18, 6.30, 7.10), (-8.12, 6.32, 7.26), (-8.02, 6.32, 7.38)),
        ((-8.48, 6.18, 7.24), (-8.66, 6.14, 7.52), (-8.82, 6.12, 7.70)),
    ]
    selected_indices = list(range(len(needle_specs))) if high else [0, 2, 3, 6, 9, 11, 13]
    for index in selected_indices:
        location, extent, seed = needle_specs[index]
        parts.append(pine_needle_cluster(
            f"Pine_NeedleSpray_{index}_{lod}", location, extent, seed,
            118 if high else 44,
        ))
        twig = twig_specs[index]
        parts.append(curve_tube(
            f"Pine_Twig_{index}_{lod}", twig, [0.82, 0.48, 0.16],
            "MAT_SUMI_TIMBER", 0.058 if high else 0.072, 2 if high else 1, 1,
        ))
    # Root flare ties the pine into the ground rather than reading as a planted cylinder.
    root_specs = [((-8.58, 6.26, 0.18), (1.55, 0.48, 0.24), 44.0), ((-9.18, 6.02, 0.15), (1.10, 0.42, 0.20), 47.0)]
    for index, (location, scale, seed) in enumerate(root_specs[: 2 if high else 1]):
        parts.append(irregular_rock(f"Pine_Root_{index}_{lod}", location, scale, (0.05, index * 0.8, 0.12), 1, seed, "MAT_SUMI_TIMBER"))
    result = join_parts(
        parts,
        f"VIS_OldPine_LOD{lod}",
        parent,
        lod,
        0.0,
        wind_materials={"MAT_SUMI_FOLIAGE": 0.96, "MAT_SUMI_TIMBER": 0.16},
    )
    result["next_lod"] = "VIS_OldPine_LOD1" if lod == 0 else ""
    result["screen_coverage"] = 0.20 if lod == 0 else 0.0
    return result


def build_stepping_approach(parent: bpy.types.Object, lod: int) -> bpy.types.Object:
    high = lod == 0
    stones = []
    for index in range(18):
        y = -18.35 + index * 0.68
        x = 0.26 * math.sin(index * 1.63) + 0.10 * math.sin(index * 0.47)
        location = (x, y, 0.055 + 0.035 * math.sin(index * 0.72))
        scale = (
            0.72 + 0.18 * (0.5 + 0.5 * math.sin(index * 1.19)),
            0.43 + 0.13 * (0.5 + 0.5 * math.cos(index * 1.57)),
            0.13 + 0.035 * (0.5 + 0.5 * math.sin(index * 2.03)),
        )
        stones.append((location, scale, 0.16 * math.sin(index * 1.31)))
    if not high:
        stones = stones[::3]
    parts = [
        irregular_rock(
            f"Approach_Stone_{index}_{lod}", location, scale,
            (0.025 * math.sin(index), 0.035 * math.cos(index * 0.8), rotation),
            2 if high else 1, 60.0 + index,
        )
        for index, (location, scale, rotation) in enumerate(stones)
    ]
    result = join_parts(parts, f"VIS_SteppingApproach_LOD{lod}", parent, lod, 0.01)
    result["next_lod"] = "VIS_SteppingApproach_LOD1" if lod == 0 else ""
    result["screen_coverage"] = 0.12 if lod == 0 else 0.0
    return result


def build_garden_frame(parent: bpy.types.Object, lod: int) -> bpy.types.Object:
    """Authored foreground/environment counter-masses for the hero vertical slice."""
    high = lod == 0
    parts: list[bpy.types.Object] = []

    # The center remains low and luminous. Side banks carry the visual weight and
    # deliberately disagree in height, length, and curvature.
    parts.extend([
        radial_landform(
            f"Garden_WaterBed_{lod}", (0.0, 3.4, -0.18), 9.15, 6.65, 0.07,
            6 if high else 3, 48 if high else 20, 73.0, "MAT_SUMI_WATER", 0.25,
        ),
        radial_landform(
            f"Garden_Bank_Left_{lod}", (-8.75, -3.4, -0.24), 4.25, 13.8, 1.35,
            8 if high else 3, 54 if high else 22, 79.0, "MAT_SUMI_STONE",
        ),
        radial_landform(
            f"Garden_Bank_Right_{lod}", (8.55, -0.4, -0.22), 3.95, 11.6, 0.92,
            8 if high else 3, 52 if high else 22, 83.0, "MAT_SUMI_STONE",
        ),
        radial_landform(
            f"Garden_Moss_Left_{lod}", (-9.02, -1.9, 0.18), 3.72, 10.4, 0.50,
            6 if high else 3, 46 if high else 20, 89.0, "MAT_SUMI_FOLIAGE",
        ),
        radial_landform(
            f"Garden_Moss_Right_{lod}", (8.78, 0.8, 0.08), 3.30, 8.35, 0.34,
            6 if high else 3, 44 if high else 20, 97.0, "MAT_SUMI_FOLIAGE",
        ),
        path_bed(f"Garden_ApproachBed_{lod}", 22 if high else 10, "MAT_SUMI_STONE"),
    ])

    edge_stones = [
        ((-7.10, -1.20, 0.15), (0.74, 0.56, 0.46), 101.0),
        ((-7.52, 0.20, 0.18), (0.96, 0.62, 0.52), 103.0),
        ((-7.18, 2.05, 0.12), (0.66, 0.48, 0.38), 107.0),
        ((-7.48, 4.15, 0.20), (1.02, 0.70, 0.55), 109.0),
        ((-6.92, 6.18, 0.15), (0.72, 0.52, 0.42), 113.0),
        ((-6.35, 8.10, 0.12), (0.84, 0.58, 0.46), 127.0),
        ((6.92, -0.85, 0.14), (0.82, 0.52, 0.44), 131.0),
        ((7.34, 0.72, 0.12), (0.64, 0.46, 0.36), 137.0),
        ((7.10, 2.50, 0.17), (0.92, 0.60, 0.48), 139.0),
        ((7.42, 4.42, 0.18), (0.76, 0.55, 0.42), 149.0),
        ((6.86, 6.48, 0.12), (0.68, 0.46, 0.36), 151.0),
        ((6.20, 8.22, 0.10), (0.78, 0.50, 0.40), 157.0),
    ]
    if not high:
        edge_stones = edge_stones[::2]
    for index, (location, scale, seed) in enumerate(edge_stones):
        parts.append(irregular_rock(
            f"Garden_EdgeStone_{index}_{lod}", location, scale,
            (0.05 * math.sin(index), index * 0.37, 0.07 * math.cos(index)),
            2 if high else 1, seed,
        ))

    # Discrete boulder shelves break the near banks into authored masses. Their
    # sizes and setbacks form a rhythm without repeating one rock silhouette.
    bank_stones_per_side = 26 if high else 9
    for side_index, side in enumerate((-1.0, 1.0)):
        for index in range(bank_stones_per_side):
            t = index / max(1, bank_stones_per_side - 1)
            y = -14.8 + 22.3 * t + 0.42 * math.sin(index * 1.83 + side_index)
            setback = 0.38 + 1.35 * (0.5 + 0.5 * math.sin(index * 1.27 + side_index * 0.8))
            x = side * (4.78 + setback)
            hero_scale = 1.28 if index % 6 == side_index else 1.0
            scale = (
                hero_scale * (0.48 + 0.52 * (0.5 + 0.5 * math.sin(index * 2.17))),
                hero_scale * (0.42 + 0.46 * (0.5 + 0.5 * math.cos(index * 1.41))),
                hero_scale * (0.30 + 0.50 * (0.5 + 0.5 * math.sin(index * 1.09 + 0.4))),
            )
            z = 0.10 + scale[2] * 0.42
            parts.append(irregular_rock(
                f"Garden_BankStone_{side_index}_{index}_{lod}",
                (x, y, z), scale,
                (0.07 * math.sin(index), 0.42 * math.sin(index * 1.61), side * 0.11 * math.cos(index)),
                2 if high else 1,
                311.0 + side_index * 53.0 + index,
            ))

    crevices_per_side = 9 if high else 3
    for side_index, side in enumerate((-1.0, 1.0)):
        for index in range(crevices_per_side):
            y = -12.8 + index * (19.0 / max(1, crevices_per_side - 1))
            x = side * (5.05 + 0.42 * math.sin(index * 1.7 + side_index))
            direction = side * (0.34 + 0.16 * math.sin(index * 0.9))
            points = [
                (x, y - 0.78, 0.24 + 0.05 * math.sin(index)),
                (x + direction * 0.42, y, 0.31 + 0.07 * math.cos(index * 1.3)),
                (x + direction, y + 0.82, 0.20 + 0.06 * math.sin(index * 1.8)),
            ]
            parts.append(curve_tube(
                f"Garden_Crevice_{side_index}_{index}_{lod}", points,
                [0.22, 1.0, 0.12], "MAT_SUMI_TIMBER",
                0.038 if high else 0.052, 1, 1,
            ))

    reed_count = 44 if high else 16
    for index in range(reed_count):
        side = -1.0 if index % 2 == 0 else 1.0
        local_index = index // 2
        t = local_index / max(1, reed_count // 2 - 1)
        y = -1.1 + 9.2 * t + 0.18 * math.sin(index * 1.73)
        x = side * (6.35 + 0.55 * math.sin(t * math.pi) + 0.24 * math.sin(index * 2.1))
        height = 0.72 + 0.82 * (0.5 + 0.5 * math.sin(index * 1.37))
        lean_x = side * (0.07 + 0.05 * math.sin(index))
        parts.append(curve_tube(
            f"Garden_Reed_{index}_{lod}",
            [(x, y, 0.08), (x + lean_x * 0.5, y + 0.035 * math.cos(index), height * 0.58), (x + lean_x, y + 0.08 * math.sin(index * 0.8), height)],
            [1.0, 0.72, 0.20], "MAT_SUMI_FOLIAGE", 0.026 if high else 0.032, 1, 1,
        ))

    bamboo_clusters = [(-10.65, -5.2, -1.0), (10.10, 5.8, 1.0)]
    stalks_per_cluster = 7 if high else 3
    for cluster_index, (base_x, base_y, direction) in enumerate(bamboo_clusters):
        for stalk_index in range(stalks_per_cluster):
            phase = stalk_index + cluster_index * 9.0
            x = base_x + 0.48 * math.sin(phase * 1.9)
            y = base_y + 0.55 * math.cos(phase * 1.37)
            height = 4.4 + 2.2 * (0.5 + 0.5 * math.sin(phase * 2.17))
            lean = direction * (0.24 + 0.20 * math.sin(phase))
            parts.append(curve_tube(
                f"Garden_Bamboo_{cluster_index}_{stalk_index}_{lod}",
                [(x, y, 0.12), (x + lean * 0.30, y + 0.06, height * 0.46), (x + lean, y + 0.12 * math.sin(phase), height)],
                [1.05, 0.90, 0.60], "MAT_SUMI_TIMBER", 0.075 if high else 0.09, 2, 1,
            ))
            leaf_count = 4 if high else 2
            for leaf_index in range(leaf_count):
                leaf_height = height * (0.52 + leaf_index * 0.12)
                leaf_direction = direction * (-1.0 if leaf_index % 2 else 1.0)
                parts.append(brush_leaf(
                    f"Garden_BambooLeaf_{cluster_index}_{stalk_index}_{leaf_index}_{lod}",
                    (x + lean * leaf_height / height, y + 0.08 * leaf_index, leaf_height),
                    0.72 + 0.16 * math.sin(phase + leaf_index), 0.18,
                    (0.08 * math.sin(phase), 0.42 * leaf_direction, 0.22 * math.sin(leaf_index + phase)),
                ))

    lanterns = [
        ("L", (-5.25, -7.15, 0.12), -0.18),
        ("R", (5.86, -0.45, 0.10), 0.24),
    ]
    if not high:
        lanterns = lanterns[:1]
    for index, (side, (x, y, z), tilt) in enumerate(lanterns):
        parts.extend([
            cylinder_part(f"Garden_LanternBase_{side}_{lod}", (x, y, z + 0.16), 0.48, 0.28, (0.0, 0.0, tilt), "MAT_SUMI_STONE", 8, 0.045),
            cube_part(f"Garden_LanternStem_{side}_{lod}", (x + 0.05 * (-1) ** index, y, z + 0.78), (0.17, 0.18, 0.52), (0.05, tilt, -0.06 + tilt * 0.4), "MAT_SUMI_STONE", 0.055, 2),
            cube_part(f"Garden_LanternCap_{side}_{lod}", (x + 0.11 * (-1) ** index, y - 0.04, z + 1.23), (0.53, 0.48, 0.11), (0.08, tilt * 0.6, 0.12 * (-1) ** index), "MAT_SUMI_STONE", 0.075, 2),
        ])
        if high:
            # The second tier is displaced and incomplete, reading as a remnant.
            parts.append(cube_part(
                f"Garden_LanternBrokenTier_{side}_{lod}",
                (x + 0.30 * (-1) ** index, y + 0.16, z + 1.48),
                (0.28, 0.24, 0.10),
                (0.18, tilt, 0.28 * (-1) ** index),
                "MAT_SUMI_STONE", 0.055, 2,
            ))

    result = join_parts(
        parts,
        f"VIS_GardenFrame_LOD{lod}",
        parent,
        lod,
        0.0,
        wind_materials={"MAT_SUMI_FOLIAGE": 0.94, "MAT_SUMI_TIMBER": 0.42},
    )
    result["next_lod"] = "VIS_GardenFrame_LOD1" if lod == 0 else ""
    result["screen_coverage"] = 0.10 if lod == 0 else 0.0
    result["navigation_clearance"] = "center corridor x=-4.4..4.4 remains open"
    return result


def add_contract_nodes(root: bpy.types.Object) -> None:
    create_empty("COL_Torii_Post_L_00", (-2.57, -11.7, 2.7), root, {"shape": "cylinder", "radius": 0.46, "half_height": 2.7})
    create_empty("COL_Torii_Post_R_00", (2.56, -11.7, 2.7), root, {"shape": "cylinder", "radius": 0.46, "half_height": 2.7})
    for index in range(9):
        x = -6.3 + index * 1.575
        normalized = abs(x) / 7.1
        z = arch_height(x) - 0.03
        slope = -math.copysign(max(0.08, normalized * 0.39), x)
        node = create_empty(f"COL_MoonBridge_Deck_{index:02d}", (x, 3.4, z), root, {
            "shape": "box", "half_extents": [0.84, 1.18, 0.16], "rotation_y": slope,
        })
        node.rotation_euler.y = slope
    create_empty("SOCKET_Torii_Bell", (0.10, -11.61, 3.22), root, {"purpose": "bell-pivot"})
    create_empty("SOCKET_MoonBridge_Camera", (0.0, 3.4, 3.35), root, {"purpose": "cinematic-anchor"})
    create_empty("TRG_Torii_Bell", (0.10, -11.61, 3.20), root, {"event": "garden-bell", "radius": 3.8})
    create_empty("FX_Torii_InkBloom", (0.10, -11.61, 3.20), root, {"effect": "ink-bloom"})
    create_empty("AUD_Torii_Bell", (0.10, -11.61, 3.20), root, {"event": "bell-strike", "surface_audio": "aged-bronze"})


def build_scene() -> bpy.types.Object:
    root = create_empty("ROOT_GateBridge_V3", extras={
        "asset_contract": CONTRACT,
        "version": 3,
        "streaming_zone": "gate-bridge",
        "units": "meters",
        "lod_selection": "exclusive",
        "palette_roles": json.dumps(sorted(MATERIAL_SPECS)),
        "provenance": "Project original",
        "license": "Project original",
    })
    for asset_name, builder in (
        ("ASSET_Torii", build_torii),
        ("ASSET_RopeBells", build_rope_bells),
        ("ASSET_MoonBridge", build_bridge),
        ("ASSET_RockComposition", build_rocks),
        ("ASSET_OldPine", build_pine),
        ("ASSET_SteppingApproach", build_stepping_approach),
        ("ASSET_GardenFrame", build_garden_frame),
    ):
        asset_root = create_empty(asset_name, parent=root, extras={"asset_contract": CONTRACT, "lod_count": 2})
        builder(asset_root, 0)
        builder(asset_root, 1)
    add_contract_nodes(root)
    return root


def export_glb(filepath: Path) -> None:
    filepath.parent.mkdir(parents=True, exist_ok=True)
    kwargs = {
        "filepath": str(filepath),
        "export_format": "GLB",
        "export_yup": True,
        "export_apply": True,
        "export_extras": True,
        "export_animations": False,
        "export_skins": False,
        "export_morph": False,
        "export_cameras": False,
        "export_lights": False,
        "export_materials": "EXPORT",
        "export_attributes": True,
        "export_texcoords": False,
        "export_vertex_color": "ACTIVE",
        "export_visible": False,
    }
    properties = {prop.identifier for prop in bpy.ops.export_scene.gltf.get_rna_type().properties}
    supported = {key: value for key, value in kwargs.items() if key in properties}
    bpy.ops.export_scene.gltf(**supported)


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--blend", type=Path, default=DEFAULT_BLEND)
    parser.add_argument("--no-blend", action="store_true")
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    clean_scene()
    configure_scene()
    build_materials()
    build_scene()
    if not args.no_blend:
        args.blend.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(args.blend))
    export_glb(args.output)
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    triangles = sum(len(obj.data.polygons) for obj in mesh_objects)
    print(json.dumps({
        "contract": CONTRACT,
        "output": str(args.output),
        "blend": None if args.no_blend else str(args.blend),
        "mesh_nodes": len(mesh_objects),
        "triangles": triangles,
        "materials": sorted(materials),
    }, indent=2))


if __name__ == "__main__":
    main()

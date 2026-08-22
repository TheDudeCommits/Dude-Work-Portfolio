#!/usr/bin/env python3
"""Author the v3 destination-court frame as a compact, semantic GLB.

The court is authored at local origin. At runtime place ROOT_ProjectCourtFrame_V3
at Three.js world position [12.4, 0.0, -10.3]. Blender is Z-up; glTF is Y-up,
so local Three.js Z is -Blender Y.

Run with:
  blender --background --factory-startup \
    --python art/blender/project_court_frame.py -- \
    --output public/art/v3/project-court/project-court-frame.raw.glb \
    --blend art/blender/project_court_frame.blend
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import random
import sys
from pathlib import Path
from typing import Iterable, Sequence

import bpy
from mathutils import Vector


CONTRACT = "dude.work.sumi-v3/1"
REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = REPO_ROOT / "public/art/v3/project-court/project-court-frame.raw.glb"
DEFAULT_BLEND = REPO_ROOT / "art/blender/project_court_frame.blend"
RUNTIME_ANCHOR = (12.4, 0.0, -10.3)
SCREEN_RADIUS = 4.6
SCREEN_ARC_DEGREES = (208.0, 332.0)
SCREEN_COUNT = 9


def load_common():
    """Reuse the project's proven semantic-material and mesh helpers."""
    source = Path(__file__).with_name("gate_bridge_vertical_slice.py")
    spec = importlib.util.spec_from_file_location("sumi_asset_common", source)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load shared authoring helpers from {source}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


common = load_common()


def curve_branch(
    name: str,
    points: Sequence[Sequence[float]],
    start_radius: float,
    end_radius: float,
    material_name: str,
    high: bool,
) -> bpy.types.Object:
    count = len(points)
    radii = [1.0 + (end_radius / start_radius - 1.0) * (index / max(1, count - 1)) for index in range(count)]
    return common.curve_tube(
        name,
        points,
        radii,
        material_name,
        start_radius,
        3 if high else 1,
        2 if high else 0,
    )


def hewn_slab(
    name: str,
    center: Sequence[float],
    width: float,
    depth: float,
    height: float,
    seed: float,
) -> bpy.types.Object:
    """A low hand-cut slab with deliberately unequal corners and split edges."""
    cx, cy, cz = center
    rng = random.Random(seed)
    outline = [
        (-0.50, -0.50), (-0.12, -0.53), (0.32, -0.49), (0.51, -0.35),
        (0.49, 0.04), (0.52, 0.42), (0.30, 0.51), (-0.17, 0.48),
        (-0.51, 0.34), (-0.48, -0.08),
    ]
    vertices: list[tuple[float, float, float]] = []
    for z_side in (-1.0, 1.0):
        for index, (x, y) in enumerate(outline):
            jitter = 1.0 + rng.uniform(-0.045, 0.045)
            edge_drop = rng.uniform(-0.035, 0.025) if z_side > 0 else 0.0
            vertices.append((
                cx + x * width * jitter,
                cy + y * depth * (1.0 + rng.uniform(-0.03, 0.03)),
                cz + (height * 0.5 * z_side) + edge_drop,
            ))
    ring = len(outline)
    faces: list[tuple[int, ...]] = [tuple(reversed(range(ring))), tuple(range(ring, ring * 2))]
    for index in range(ring):
        nxt = (index + 1) % ring
        faces.append((index, nxt, ring + nxt, ring + index))
    obj = common.create_mesh(name, vertices, faces, "MAT_SUMI_STONE")
    common.bevel(obj, min(0.075, height * 0.14), 2)
    return obj


def lantern_parts(prefix: str, at: Sequence[float], scale: float, high: bool, seed: int) -> list[bpy.types.Object]:
    """Build a sculptural yukimi-inspired lantern without a perfect CAD profile."""
    x, y, z = at
    rng = random.Random(seed)
    sides = 9 if high else 6
    parts: list[bpy.types.Object] = []
    parts.append(common.irregular_rock(
        f"{prefix}_Foot", (x, y, z + 0.12 * scale),
        (0.56 * scale, 0.48 * scale, 0.20 * scale),
        (rng.uniform(-0.05, 0.05), rng.uniform(-0.07, 0.07), rng.uniform(-0.12, 0.12)),
        2 if high else 1, seed + 0.3,
    ))
    parts.append(common.irregular_tapered_post(
        f"{prefix}_Stem",
        [(x, y, z + 0.18 * scale), (x + 0.08 * scale, y - 0.03 * scale, z + 0.87 * scale),
         (x - 0.035 * scale, y + 0.03 * scale, z + 1.44 * scale)],
        [0.24 * scale, 0.19 * scale, 0.23 * scale], "MAT_SUMI_STONE",
        8 if high else 4, sides, seed + 4.0,
    ))
    parts.append(common.cylinder_part(
        f"{prefix}_LowerCap", (x, y, z + 1.51 * scale), 0.43 * scale, 0.16 * scale,
        (0.02, -0.03, 0.03), "MAT_SUMI_STONE", sides, 0.025 * scale,
    ))
    # Four uneven stone piers leave a readable hollow light chamber.
    for index, (ox, oy) in enumerate(((-0.26, -0.22), (0.24, -0.20), (0.25, 0.21), (-0.23, 0.24))):
        parts.append(common.cube_part(
            f"{prefix}_ChamberPier_{index}",
            (x + ox * scale, y + oy * scale, z + (1.81 + rng.uniform(-0.025, 0.025)) * scale),
            (0.075 * scale, 0.075 * scale, 0.28 * scale),
            (rng.uniform(-0.025, 0.025), rng.uniform(-0.025, 0.025), rng.uniform(-0.045, 0.045)),
            "MAT_SUMI_STONE", 0.025 * scale, 1,
        ))
    parts.append(common.cube_part(
        f"{prefix}_ChamberRoof", (x, y, z + 2.10 * scale),
        (0.48 * scale, 0.43 * scale, 0.095 * scale),
        (0.015, -0.02, rng.uniform(-0.045, 0.045)), "MAT_SUMI_STONE", 0.07 * scale, 2 if high else 1,
    ))
    # An offset mushroom cap gives the silhouette a hand-set, aged imbalance.
    parts.append(common.cylinder_part(
        f"{prefix}_Umbrella", (x - 0.035 * scale, y + 0.02 * scale, z + 2.25 * scale),
        0.70 * scale, 0.18 * scale, (0.015, -0.035, rng.uniform(-0.05, 0.05)),
        "MAT_SUMI_STONE", 11 if high else 7, 0.045 * scale,
    ))
    parts.append(common.irregular_rock(
        f"{prefix}_Finial", (x - 0.06 * scale, y + 0.01 * scale, z + 2.43 * scale),
        (0.18 * scale, 0.15 * scale, 0.20 * scale), (0.0, 0.1, 0.0),
        2 if high else 1, seed + 9.4,
    ))
    return parts


def repaint_court_mesh(obj: bpy.types.Object) -> None:
    """Strengthen ink-breakup and wind masks per semantic material."""
    mesh = obj.data
    attribute = mesh.color_attributes.get(common.SUMI_ATTRIBUTE)
    if attribute is None:
        raise RuntimeError(f"{obj.name} has no {common.SUMI_ATTRIBUTE} color attribute")
    vertex_material: list[str] = [""] * len(mesh.vertices)
    for polygon in mesh.polygons:
        material = obj.material_slots[polygon.material_index].material if polygon.material_index < len(obj.material_slots) else None
        role = material.name if material else ""
        for vertex_index in polygon.vertices:
            vertex_material[vertex_index] = role
    z_values = [vertex.co.z for vertex in mesh.vertices]
    z_min = min(z_values, default=0.0)
    z_span = max(0.001, max(z_values, default=1.0) - z_min)
    for vertex in mesh.vertices:
        x, y, z = vertex.co
        height = (z - z_min) / z_span
        grain = math.sin(x * 4.71 + y * 7.19 + z * 2.83) * 0.5 + 0.5
        fracture = abs(math.sin(x * 9.1 - y * 5.3 + z * 6.7))
        role = vertex_material[vertex.index]
        if role == "MAT_SUMI_FOLIAGE":
            pigment = common.clamp(0.45 + grain * 0.46)
            wetness = common.clamp(0.22 + (1.0 - grain) * 0.28)
            dry_edge = common.clamp(0.43 + fracture * 0.42)
            wind = common.clamp(0.68 + height * 0.28)
        elif role == "MAT_SUMI_TIMBER":
            scar = abs(math.sin(z * 7.3 + x * 2.6 + y * 1.7))
            pigment = common.clamp(0.25 + scar * 0.62)
            wetness = common.clamp(0.10 + (1.0 - height) * 0.28 + grain * 0.10)
            dry_edge = common.clamp(0.58 + fracture * 0.36)
            wind = common.clamp((0.04 + height * 0.18) if z < 5.2 else (0.24 + height * 0.18))
        else:
            pigment = common.clamp(0.38 + grain * 0.34 + fracture * 0.10)
            wetness = common.clamp(0.24 + (1.0 - height) * 0.34 - fracture * 0.08)
            dry_edge = common.clamp(0.50 + fracture * 0.42)
            wind = 0.0
        attribute.data[vertex.index].color = (pigment, wetness, dry_edge, wind)


def join_visual(
    parts: Iterable[bpy.types.Object],
    name: str,
    parent: bpy.types.Object,
    lod: int,
    ink_profile: str,
) -> bpy.types.Object:
    result = common.join_parts(parts, name, parent, lod, 0.0, ink_profile=ink_profile)
    result["streaming_zone"] = "project-court"
    result["next_lod"] = name.replace("LOD0", "LOD1") if lod == 0 else ""
    result["occlusion_rule"] = "preserve nine-screen arc and approach center"
    repaint_court_mesh(result)
    return result


def build_pine_arch(parent: bpy.types.Object, lod: int) -> bpy.types.Object:
    high = lod == 0
    parts: list[bpy.types.Object] = []
    # The left tree carries almost all the visual weight, Kurosawa-style; the
    # smaller right tree catches the descending canopy without mirroring it.
    left_segments = [
        ([(-6.40, 2.72, 0.05), (-6.42, 2.58, 2.55), (-5.45, 2.72, 4.82)], [0.74, 0.60, 0.46], 110.0),
        ([(-5.45, 2.72, 4.72), (-5.18, 2.78, 6.05), (-4.27, 2.95, 7.18)], [0.47, 0.38, 0.28], 121.0),
    ]
    for index, (points, radii, seed) in enumerate(left_segments):
        parts.append(common.irregular_tapered_post(
            f"Pine_LeftTrunk_{index}_L{lod}", points, radii, "MAT_SUMI_TIMBER",
            14 if high else 7, 12 if high else 8, seed,
        ))
    parts.append(common.irregular_tapered_post(
        f"Pine_RightTrunk_L{lod}",
        [(6.46, 2.98, 0.05), (6.20, 2.92, 2.18), (5.66, 3.16, 5.68)],
        [0.50, 0.42, 0.25], "MAT_SUMI_TIMBER", 13 if high else 6, 11 if high else 7, 144.0,
    ))
    branch_specs = [
        ([(-4.55, 2.92, 6.82), (-2.92, 3.04, 8.25), (-0.70, 3.20, 8.83), (1.72, 3.39, 8.66), (4.06, 3.54, 8.03), (6.02, 3.49, 7.16)], 0.28, 0.09),
        ([(-5.18, 2.80, 5.72), (-3.20, 3.04, 7.05), (-0.95, 3.27, 7.56), (1.35, 3.48, 7.48), (3.78, 3.57, 6.82), (5.68, 3.18, 5.64)], 0.25, 0.08),
        ([(-5.65, 2.68, 4.46), (-4.12, 2.35, 5.58), (-2.32, 2.16, 6.02), (-0.38, 2.30, 6.12)], 0.22, 0.06),
        ([(5.85, 3.12, 5.20), (4.62, 3.58, 6.47), (3.30, 3.66, 7.22), (1.92, 3.52, 7.68)], 0.20, 0.055),
    ]
    for index, (points, start, end) in enumerate(branch_specs):
        parts.append(curve_branch(f"Pine_ArchBranch_{index}_L{lod}", points, start, end, "MAT_SUMI_TIMBER", high))

    cluster_centers = [
        (-4.85, 2.83, 7.12), (-3.70, 2.87, 8.12), (-2.35, 3.02, 8.67), (-0.80, 3.18, 9.02),
        (0.75, 3.38, 8.96), (2.30, 3.53, 8.64), (3.72, 3.58, 8.18), (5.08, 3.52, 7.64),
        (-4.20, 2.44, 6.00), (-2.72, 2.25, 6.37), (-1.15, 2.28, 6.46), (0.48, 3.42, 7.62),
        (2.04, 3.62, 7.42), (3.52, 3.66, 6.92), (5.30, 3.30, 6.24), (6.02, 3.18, 5.56),
        (-5.45, 2.66, 5.48), (-3.18, 3.05, 7.35), (1.54, 3.34, 8.05), (4.28, 3.54, 7.34),
    ]
    cluster_count = len(cluster_centers) if high else 10
    needles_per_cluster = 112 if high else 35
    for index, center in enumerate(cluster_centers[:cluster_count]):
        widen = 1.15 + 0.16 * math.sin(index * 1.7)
        parts.append(common.pine_needle_cluster(
            f"Pine_Needles_{index:02d}_L{lod}", center,
            (widen, 0.58 + 0.08 * (index % 3), 0.46 + 0.07 * ((index + 1) % 3)),
            7100 + index * 37 + lod * 1000, needles_per_cluster,
        ))
        # Each needle cloud is tied to the authored branch skeleton by a fine twig.
        if high and index % 2 == 0:
            cx, cy, cz = center
            parts.append(curve_branch(
                f"Pine_Twig_{index:02d}_L{lod}",
                [(cx - 0.48, cy, cz - 0.28), (cx - 0.12, cy + 0.04, cz - 0.08), (cx + 0.25, cy, cz + 0.02)],
                0.052, 0.018, "MAT_SUMI_TIMBER", high,
            ))
    # Root flares ground the two silhouettes into the rock court.
    for side, (x, y), seed in (("L", (-6.35, 2.72), 771), ("R", (6.40, 2.98), 792)):
        direction = 1.0 if side == "L" else -1.0
        for index in range(4 if high else 2):
            parts.append(curve_branch(
                f"Pine_Root_{side}_{index}_L{lod}",
                [(x, y, 0.24), (x + direction * (0.65 + index * 0.17), y + (index - 1.3) * 0.36, 0.12),
                 (x + direction * (1.35 + index * 0.25), y + (index - 1.4) * 0.64, 0.03)],
                0.15, 0.045, "MAT_SUMI_TIMBER", high,
            ))
    return join_visual(parts, f"VIS_CourtPineArch_LOD{lod}", parent, lod, "weathered-pine")


def build_dais(parent: bpy.types.Object, lod: int) -> bpy.types.Object:
    high = lod == 0
    parts: list[bpy.types.Object] = []
    parts.append(common.radial_landform(
        f"Dais_Bed_L{lod}", (0.0, 0.45, -0.08), 6.05, 5.15, 0.38,
        7 if high else 4, 40 if high else 20, 301.0, "MAT_SUMI_STONE", 0.42,
    ))
    # Broad, shallow approach slabs lead from the front but stop before the
    # screen fan, leaving the luminous center legible.
    step_specs = [
        ((0.12, -4.74, 0.12), 4.60, 1.12, 0.24, 341),
        ((-0.10, -3.60, 0.25), 5.10, 1.28, 0.30, 347),
        ((0.08, -2.36, 0.39), 5.52, 1.42, 0.34, 353),
        ((-0.06, -1.02, 0.52), 6.02, 1.55, 0.36, 359),
    ]
    for index, (center, width, depth, height, seed) in enumerate(step_specs[:4 if high else 3]):
        parts.append(hewn_slab(f"Dais_Step_{index}_L{lod}", center, width, depth, height, seed + lod * 100))
    # Three rear plates loosely echo raked-island strata under the folding screens.
    for index, (x, y, width, depth) in enumerate(((-2.9, 2.55, 4.1, 2.7), (0.1, 3.30, 4.8, 2.6), (3.05, 2.58, 3.9, 2.5))):
        parts.append(hewn_slab(
            f"Dais_RearPlate_{index}_L{lod}", (x, y, 0.24 + 0.04 * index), width, depth,
            0.28 if high else 0.24, 410 + index * 19 + lod * 200,
        ))
    return join_visual(parts, f"VIS_CourtDais_LOD{lod}", parent, lod, "mineral-wash")


def build_rock_roots(parent: bpy.types.Object, lod: int) -> bpy.types.Object:
    high = lod == 0
    parts: list[bpy.types.Object] = []
    rock_specs = [
        (-6.35, 2.62, 0.48, 1.40, 1.04, 0.72, 0.14), (-5.45, 3.45, 0.34, 0.92, 0.71, 0.49, -0.22),
        (-6.10, 0.84, 0.31, 0.88, 0.67, 0.44, 0.16), (-5.18, -0.44, 0.22, 0.70, 0.52, 0.34, -0.09),
        (6.34, 2.84, 0.44, 1.25, 0.92, 0.65, -0.12), (5.53, 3.66, 0.30, 0.84, 0.62, 0.42, 0.25),
        (6.02, 1.18, 0.28, 0.78, 0.61, 0.39, -0.21), (5.12, -0.56, 0.20, 0.65, 0.48, 0.31, 0.18),
        (-4.76, 4.36, 0.24, 0.62, 0.50, 0.34, 0.07), (-3.70, 4.76, 0.18, 0.52, 0.42, 0.27, -0.13),
        (4.80, 4.28, 0.22, 0.59, 0.48, 0.32, 0.19), (3.64, 4.72, 0.17, 0.48, 0.40, 0.25, -0.18),
        (-4.42, -2.66, 0.18, 0.54, 0.41, 0.28, 0.21), (4.52, -2.72, 0.16, 0.49, 0.38, 0.25, -0.15),
    ]
    count = len(rock_specs) if high else 9
    for index, (x, y, z, sx, sy, sz, turn) in enumerate(rock_specs[:count]):
        parts.append(common.irregular_rock(
            f"CourtRock_{index:02d}_L{lod}", (x, y, z), (sx, sy, sz),
            (0.05 * math.sin(index), turn * 0.4, turn), 2 if high else 1, 520 + index * 13 + lod * 500,
        ))
    # Gnarled exposed roots cross selected rocks, never the central walking line.
    root_specs = [
        ([(-6.15, 2.62, 0.34), (-5.72, 1.80, 0.20), (-5.10, 0.90, 0.08)], 0.16),
        ([(-5.82, 2.86, 0.42), (-5.26, 3.54, 0.24), (-4.48, 4.18, 0.10)], 0.13),
        ([(6.22, 2.82, 0.32), (5.72, 1.95, 0.18), (5.15, 1.18, 0.07)], 0.13),
        ([(6.18, 3.02, 0.38), (5.56, 3.62, 0.20), (4.82, 4.22, 0.08)], 0.11),
    ]
    for index, (points, radius) in enumerate(root_specs[:4 if high else 2]):
        parts.append(curve_branch(f"CourtRoot_{index}_L{lod}", points, radius, 0.035, "MAT_SUMI_TIMBER", high))
    return join_visual(parts, f"VIS_CourtRockRoots_LOD{lod}", parent, lod, "weathered-rootstone")


def build_lanterns(parent: bpy.types.Object, lod: int) -> bpy.types.Object:
    high = lod == 0
    parts: list[bpy.types.Object] = []
    # All are outside the screen fan's central silhouette; differing scales and
    # depth establish a cinematic triangle rather than a symmetrical gateway.
    lantern_specs = [
        ("Lantern_Left", (-5.48, -0.64, 0.10), 1.06, 901),
        ("Lantern_Right", (5.30, 0.10, 0.10), 0.92, 937),
        ("Lantern_FarRight", (6.18, 4.02, 0.12), 0.68, 971),
    ]
    for prefix, at, scale, seed in lantern_specs:
        parts.extend(lantern_parts(f"{prefix}_L{lod}", at, scale, high, seed + lod * 100))
    return join_visual(parts, f"VIS_CourtLanterns_LOD{lod}", parent, lod, "lantern-stone")


def three_screen_position(index: int) -> tuple[float, float, float]:
    progress = index / (SCREEN_COUNT - 1)
    angle = math.radians(SCREEN_ARC_DEGREES[0] + (SCREEN_ARC_DEGREES[1] - SCREEN_ARC_DEGREES[0]) * progress)
    return (math.cos(angle) * SCREEN_RADIUS, 0.0, math.sin(angle) * SCREEN_RADIUS)


def add_contract_nodes(root: bpy.types.Object) -> None:
    common.create_empty("SOCKET_ProjectCourt_Center", (0.0, 0.0, 0.0), root, {
        "purpose": "court-center", "three_position": [0.0, 0.0, 0.0],
    })
    common.create_empty("SOCKET_ProjectCourt_Focus", (0.0, 1.95, 1.52), root, {
        "purpose": "camera-focus", "three_position": [0.0, 1.52, -1.95],
    })
    for index in range(SCREEN_COUNT):
        x, three_y, three_z = three_screen_position(index)
        yaw = math.atan2(-x, -three_z)
        common.create_empty(f"SOCKET_ProjectScreen_{index:02d}", (x, -three_z, three_y), root, {
            "purpose": "folding-screen", "screen_index": index,
            "three_position": [round(x, 6), three_y, round(three_z, 6)],
            "three_rotation_y": round(yaw, 6),
        })
    # Coarse collision metadata only; runtime may adopt or ignore these proxies.
    common.create_empty("COL_ProjectCourt_Dais_00", (0.0, 0.3, 0.20), root, {
        "shape": "cylinder", "radius": 5.9, "half_height": 0.24,
    })
    common.create_empty("COL_ProjectCourt_Pine_L_00", (-6.35, 2.72, 2.55), root, {
        "shape": "capsule", "radius": 0.66, "half_height": 2.55,
    })
    common.create_empty("COL_ProjectCourt_Pine_R_00", (6.40, 2.98, 2.30), root, {
        "shape": "capsule", "radius": 0.48, "half_height": 2.30,
    })
    for index, (y, width) in enumerate(((-4.74, 4.60), (-3.60, 5.10), (-2.36, 5.52), (-1.02, 6.02))):
        common.create_empty(f"COL_ProjectCourt_Step_{index:02d}", (0.0, y, 0.22 + index * 0.12), root, {
            "shape": "box", "half_extents": [width * 0.5, 0.65, 0.18],
        })
    common.create_empty("TRG_ProjectCourt_Enter", (0.0, -3.1, 1.0), root, {
        "event": "project-court-enter", "shape": "sphere", "radius": 4.4,
    })
    common.create_empty("FX_ProjectCourt_InkCanopy", (0.2, 3.25, 8.0), root, {
        "effect": "canopy-ink-shed", "wind_axis_three": [1.0, 0.0, -0.16],
    })
    common.create_empty("AUD_ProjectCourt_Wind", (-1.3, 2.8, 5.8), root, {
        "event": "pine-wind", "surface_audio": "ancient-pine-and-stone",
    })


def compute_three_bounds(objects: Iterable[bpy.types.Object]) -> tuple[list[float], list[float]]:
    points: list[Vector] = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            points.append(Vector((point.x, point.z, -point.y)))
    minimum = [min(point[axis] for point in points) for axis in range(3)]
    maximum = [max(point[axis] for point in points) for axis in range(3)]
    return [round(value, 4) for value in minimum], [round(value, 4) for value in maximum]


def build_scene() -> bpy.types.Object:
    root = common.create_empty("ROOT_ProjectCourtFrame_V3", extras={
        "asset_contract": CONTRACT,
        "version": 3,
        "streaming_zone": "project-court",
        "units": "meters",
        "lod_selection": "exclusive",
        "runtime_anchor_three": list(RUNTIME_ANCHOR),
        "screen_count": SCREEN_COUNT,
        "screen_arc_degrees": list(SCREEN_ARC_DEGREES),
        "screen_radius": SCREEN_RADIUS,
        "palette_roles": json.dumps(["MAT_SUMI_FOLIAGE", "MAT_SUMI_STONE", "MAT_SUMI_TIMBER"]),
        "provenance": "Project original; no external meshes, textures, or copied source",
        "license": "Project original",
    })
    lod0_meshes: list[bpy.types.Object] = []
    for asset_name, builder in (
        ("ASSET_CourtPineArch", build_pine_arch),
        ("ASSET_CourtDais", build_dais),
        ("ASSET_CourtRockRoots", build_rock_roots),
        ("ASSET_CourtLanterns", build_lanterns),
    ):
        asset_root = common.create_empty(asset_name, parent=root, extras={
            "asset_contract": CONTRACT, "lod_count": 2, "lod_selection": "exclusive",
        })
        lod0_meshes.append(builder(asset_root, 0))
        builder(asset_root, 1)
    add_contract_nodes(root)
    local_min, local_max = compute_three_bounds(lod0_meshes)
    world_min = [round(local_min[i] + RUNTIME_ANCHOR[i], 4) for i in range(3)]
    world_max = [round(local_max[i] + RUNTIME_ANCHOR[i], 4) for i in range(3)]
    root["bounds_local_three_min"] = local_min
    root["bounds_local_three_max"] = local_max
    root["bounds_world_three_min"] = world_min
    root["bounds_world_three_max"] = world_max
    return root


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--blend", type=Path, default=DEFAULT_BLEND)
    parser.add_argument("--no-blend", action="store_true")
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    common.clean_scene()
    common.configure_scene()
    common.build_materials()
    root = build_scene()
    bpy.context.scene["streaming_zone"] = "project-court"
    bpy.context.scene["runtime_anchor_three"] = list(RUNTIME_ANCHOR)
    if not args.no_blend:
        args.blend.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(args.blend))
    common.export_glb(args.output)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    lod0 = [obj for obj in meshes if obj.name.endswith("_LOD0")]
    lod1 = [obj for obj in meshes if obj.name.endswith("_LOD1")]
    print(json.dumps({
        "contract": CONTRACT,
        "output": str(args.output),
        "blend": None if args.no_blend else str(args.blend),
        "root": root.name,
        "runtime_anchor_three": list(RUNTIME_ANCHOR),
        "bounds_local_three": {
            "min": list(root["bounds_local_three_min"]),
            "max": list(root["bounds_local_three_max"]),
        },
        "lod0_triangles": sum(len(obj.data.polygons) for obj in lod0),
        "lod1_triangles": sum(len(obj.data.polygons) for obj in lod1),
        "mesh_nodes": len(meshes),
        "materials": sorted({slot.material.name for obj in meshes for slot in obj.material_slots if slot.material}),
    }, indent=2))


if __name__ == "__main__":
    main()

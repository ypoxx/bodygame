#!/usr/bin/env python3
"""Non-destructive audit and mobile-LOD export pipeline for anatomy GLBs.

Run with Blender, not the system Python:

    blender -b --factory-startup --python scripts/blender_asset_pipeline.py -- \
      --input assets/muscles.glb \
      --output assets/derived/muscles.mobile-lod1.v2.glb \
      --report assets/derived/reports/muscles.mobile-lod1.v2.json \
      --repair-triangle-soup --lod-ratio 0.38 --min-triangles 300 \
      --collapse-material-slots

The input file is never overwritten. Triangle-soup repair is accepted only when
the complete triangle/corner signature (positions, normals, UVs and materials)
is unchanged after welding. Otherwise the mesh is restored automatically.
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
import math
import os
import sys
import time
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


PIPELINE_VERSION = "1.1.0"
TRIANGLE_SOUP_TARGETS = (
    "External abdominal oblique muscle",
    "Multifidus thoracis muscle",
)


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--preview-before", type=Path)
    parser.add_argument("--preview-after", type=Path)
    parser.add_argument("--repair-triangle-soup", action="store_true")
    parser.add_argument(
        "--collapse-material-slots",
        action="store_true",
        help=(
            "Assign every polygon in each anatomical mesh to material slot 0 and "
            "remove the remaining slots. Objects are never joined."
        ),
    )
    parser.add_argument(
        "--lod-weld-triangle-soup",
        action="store_true",
        help=(
            "Weld the two disconnected triangle-soup meshes for LOD generation. "
            "This requires geometry/material equivalence, but permits rebuilt normals."
        ),
    )
    parser.add_argument("--lod-ratio", type=float, default=1.0)
    parser.add_argument("--min-triangles", type=int, default=300)
    parser.add_argument("--position-bits", type=int, default=14)
    parser.add_argument("--normal-bits", type=int, default=10)
    parser.add_argument("--texcoord-bits", type=int, default=12)
    parser.add_argument("--draco-level", type=int, default=10)
    args = parser.parse_args(argv)
    if not 0.05 <= args.lod_ratio <= 1.0:
        parser.error("--lod-ratio must be between 0.05 and 1.0")
    if args.output and args.output.resolve() == args.input.resolve():
        parser.error("Refusing to overwrite the input asset")
    if (
        args.repair_triangle_soup
        or args.collapse_material_slots
        or args.lod_ratio < 1.0
    ) and not args.output:
        parser.error("An --output path is required when modifying geometry")
    return args


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def clean_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def import_glb(path: Path) -> None:
    clean_scene()
    result = bpy.ops.import_scene.gltf(filepath=str(path.resolve()), import_shading="NORMALS")
    if "FINISHED" not in result:
        raise RuntimeError(f"glTF import failed: {result}")


def mesh_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def unique_meshes() -> list[bpy.types.Mesh]:
    return list({obj.data for obj in mesh_objects()})


def mesh_triangle_count(mesh: bpy.types.Mesh) -> int:
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def object_bounds() -> tuple[Vector, Vector]:
    minimum = Vector((math.inf, math.inf, math.inf))
    maximum = Vector((-math.inf, -math.inf, -math.inf))
    for obj in mesh_objects():
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            minimum.x = min(minimum.x, point.x)
            minimum.y = min(minimum.y, point.y)
            minimum.z = min(minimum.z, point.z)
            maximum.x = max(maximum.x, point.x)
            maximum.y = max(maximum.y, point.y)
            maximum.z = max(maximum.z, point.z)
    return minimum, maximum


def qvec(values, digits: int = 6) -> tuple[float, ...]:
    return tuple(round(float(value), digits) for value in values)


def corner_normals(mesh: bpy.types.Mesh) -> list[tuple[float, float, float]]:
    try:
        normals = [qvec(item.vector, 5) for item in mesh.corner_normals]
        if len(normals) == len(mesh.loops):
            return normals
    except (AttributeError, RuntimeError):
        pass
    return [qvec(loop.normal, 5) for loop in mesh.loops]


def corner_uvs(mesh: bpy.types.Mesh) -> list[tuple[float, float] | None]:
    layer = mesh.uv_layers.active
    if not layer:
        return [None] * len(mesh.loops)
    return [qvec(item.uv, 6) for item in layer.data]


def canonical_triangle_signature(
    mesh: bpy.types.Mesh, *, include_corner_attributes: bool = True
) -> collections.Counter:
    """Return a winding-preserving, vertex-index-independent render signature."""
    normals = corner_normals(mesh)
    uvs = corner_uvs(mesh)
    signatures: collections.Counter = collections.Counter()
    for polygon in mesh.polygons:
        corners = []
        for loop_index in polygon.loop_indices:
            loop = mesh.loops[loop_index]
            position = qvec(mesh.vertices[loop.vertex_index].co, 6)
            corners.append(
                (position, normals[loop_index], uvs[loop_index])
                if include_corner_attributes
                else position
            )
        if len(corners) != 3:
            # glTF input should already be triangulated. Keep n-gons comparable.
            signatures[(polygon.material_index, tuple(corners))] += 1
            continue
        rotations = (
            tuple(corners),
            tuple(corners[1:] + corners[:1]),
            tuple(corners[2:] + corners[:2]),
        )
        signatures[(polygon.material_index, min(rotations))] += 1
    return signatures


def triangle_soup_metrics(mesh: bpy.types.Mesh) -> dict:
    normals = corner_normals(mesh)
    uvs = corner_uvs(mesh)
    position_counts: collections.Counter = collections.Counter()
    position_normal_sets: dict[tuple, set] = collections.defaultdict(set)
    position_uv_sets: dict[tuple, set] = collections.defaultdict(set)
    render_vertices: set = set()

    for vertex in mesh.vertices:
        position_counts[qvec(vertex.co, 6)] += 1
    for loop_index, loop in enumerate(mesh.loops):
        position = qvec(mesh.vertices[loop.vertex_index].co, 6)
        normal = normals[loop_index]
        uv = uvs[loop_index]
        position_normal_sets[position].add(normal)
        position_uv_sets[position].add(uv)
        render_vertices.add((position, normal, uv))

    duplicate_positions = sum(count - 1 for count in position_counts.values() if count > 1)
    return {
        "vertices": len(mesh.vertices),
        "loops": len(mesh.loops),
        "triangles": mesh_triangle_count(mesh),
        "unique_positions_rounded_1e-6": len(position_counts),
        "duplicate_position_vertices": duplicate_positions,
        "estimated_unique_render_vertices": len(render_vertices),
        "positions_with_multiple_normals": sum(
            1 for values in position_normal_sets.values() if len(values) > 1
        ),
        "positions_with_multiple_uvs": sum(
            1 for values in position_uv_sets.values() if len(values) > 1
        ),
    }


def conservative_weld_target_map(mesh: bpy.types.Mesh) -> dict[int, int]:
    """Map duplicate-position vertices without collapsing any triangle edge.

    Some source meshes contain a handful of zero-length/degenerate edges. A
    global remove-doubles operation deletes those faces and therefore changes
    the structural signature. Partitioning each position group by face usage
    welds the useful duplicates while keeping every original triangle intact.
    """
    groups: dict[tuple[float, float, float], list[int]] = collections.defaultdict(list)
    vertex_faces: list[set[int]] = [set() for _ in mesh.vertices]
    for vertex in mesh.vertices:
        groups[tuple(float(value) for value in vertex.co)].append(vertex.index)
    for polygon in mesh.polygons:
        for vertex_index in polygon.vertices:
            vertex_faces[vertex_index].add(polygon.index)

    target_indices: dict[int, int] = {}
    for indices in groups.values():
        if len(indices) < 2:
            continue
        clusters: list[dict] = []
        for vertex_index in indices:
            faces = vertex_faces[vertex_index]
            compatible = next(
                (cluster for cluster in clusters if cluster["faces"].isdisjoint(faces)),
                None,
            )
            if compatible is None:
                clusters.append({"target": vertex_index, "faces": set(faces)})
                continue
            target_indices[vertex_index] = compatible["target"]
            compatible["faces"].update(faces)
    return target_indices


def scene_stats() -> dict:
    objects = mesh_objects()
    meshes = unique_meshes()
    minimum, maximum = object_bounds()
    mesh_stats = []
    for mesh in sorted(meshes, key=lambda item: item.name.casefold()):
        triangles = mesh_triangle_count(mesh)
        users = [obj.name for obj in objects if obj.data == mesh]
        mesh_stats.append(
            {
                "name": mesh.name,
                "vertices": len(mesh.vertices),
                "triangles": triangles,
                "materials": len(mesh.materials),
                "object_users": users,
            }
        )

    offender_stats = {}
    for mesh in meshes:
        if any(mesh.name.startswith(target) for target in TRIANGLE_SOUP_TARGETS):
            offender_stats[mesh.name] = triangle_soup_metrics(mesh)

    return {
        "mesh_objects": len(objects),
        "unique_meshes": len(meshes),
        "unique_triangles": sum(item["triangles"] for item in mesh_stats),
        "instantiated_triangles": sum(mesh_triangle_count(obj.data) for obj in objects),
        "instantiated_vertices": sum(len(obj.data.vertices) for obj in objects),
        "estimated_draw_calls": sum(max(1, len(obj.data.materials)) for obj in objects),
        "bounds_min": qvec(minimum, 6),
        "bounds_max": qvec(maximum, 6),
        "bounds_size": qvec(maximum - minimum, 6),
        "object_names": sorted(obj.name for obj in objects),
        "triangle_soup_targets": offender_stats,
        "meshes": mesh_stats,
    }


def geometry_snapshot() -> dict[str, dict]:
    """Capture exact edit-scene geometry without including material indices."""
    snapshot = {}
    for mesh in sorted(unique_meshes(), key=lambda item: item.name.casefold()):
        digest = hashlib.sha256()
        digest.update(f"vertices:{len(mesh.vertices)}\n".encode())
        for vertex in mesh.vertices:
            digest.update(
                ("%.9g,%.9g,%.9g;" % tuple(float(value) for value in vertex.co)).encode()
            )
        digest.update(f"\npolygons:{len(mesh.polygons)}\n".encode())
        for polygon in mesh.polygons:
            # Material assignment is deliberately omitted: it is the only data
            # this optimization is allowed to change.
            digest.update(
                (",".join(str(index) for index in polygon.vertices) + ";").encode()
            )
        snapshot[mesh.name] = {
            "vertices": len(mesh.vertices),
            "polygons": len(mesh.polygons),
            "triangles": mesh_triangle_count(mesh),
            "sha256": digest.hexdigest(),
        }
    return snapshot


def object_mesh_assignments() -> dict[str, str]:
    return {obj.name: obj.data.name for obj in mesh_objects()}


def collapse_material_slots() -> dict:
    """Collapse material primitives without changing anatomical object boundaries."""
    before = scene_stats()
    geometry_before = geometry_snapshot()
    assignments_before = object_mesh_assignments()
    operations = []

    for mesh in sorted(unique_meshes(), key=lambda item: item.name.casefold()):
        users = sorted(obj.name for obj in mesh_objects() if obj.data == mesh)
        materials_before = [
            material.name if material is not None else None for material in mesh.materials
        ]
        polygon_assignments_changed = sum(
            1 for polygon in mesh.polygons if polygon.material_index != 0
        )

        for polygon in mesh.polygons:
            polygon.material_index = 0
        while len(mesh.materials) > 1:
            mesh.materials.pop(index=len(mesh.materials) - 1)
        mesh.update()

        operations.append(
            {
                "mesh": mesh.name,
                "users": users,
                "materials_before": materials_before,
                "material_slots_before": len(materials_before),
                "material_slots_after": len(mesh.materials),
                "material_slots_removed": max(0, len(materials_before) - len(mesh.materials)),
                "polygon_assignments_changed": polygon_assignments_changed,
                "polygons": len(mesh.polygons),
            }
        )

    after = scene_stats()
    geometry_after = geometry_snapshot()
    assignments_after = object_mesh_assignments()
    validation = {
        "mesh_object_count_unchanged": before["mesh_objects"] == after["mesh_objects"],
        "unique_mesh_count_unchanged": before["unique_meshes"] == after["unique_meshes"],
        "object_names_unchanged": before["object_names"] == after["object_names"],
        "object_mesh_assignments_unchanged": assignments_before == assignments_after,
        "geometry_signatures_unchanged": geometry_before == geometry_after,
        "instantiated_vertices_unchanged": (
            before["instantiated_vertices"] == after["instantiated_vertices"]
        ),
        "instantiated_triangles_unchanged": (
            before["instantiated_triangles"] == after["instantiated_triangles"]
        ),
        "bounds_unchanged": (
            before["bounds_min"] == after["bounds_min"]
            and before["bounds_max"] == after["bounds_max"]
        ),
        "all_polygons_use_material_slot_zero": all(
            polygon.material_index == 0
            for mesh in unique_meshes()
            for polygon in mesh.polygons
        ),
        "at_most_one_material_slot_per_mesh": all(
            len(mesh.materials) <= 1 for mesh in unique_meshes()
        ),
        "estimated_draw_calls_equal_mesh_objects": (
            after["estimated_draw_calls"] == after["mesh_objects"]
        ),
    }
    failed = [name for name, passed in validation.items() if not passed]
    if failed:
        raise RuntimeError(
            "Material-slot collapse violated invariants: " + ", ".join(failed)
        )

    return {
        "before": {
            "mesh_objects": before["mesh_objects"],
            "unique_meshes": before["unique_meshes"],
            "instantiated_vertices": before["instantiated_vertices"],
            "instantiated_triangles": before["instantiated_triangles"],
            "estimated_draw_calls": before["estimated_draw_calls"],
            "bounds_min": before["bounds_min"],
            "bounds_max": before["bounds_max"],
        },
        "after": {
            "mesh_objects": after["mesh_objects"],
            "unique_meshes": after["unique_meshes"],
            "instantiated_vertices": after["instantiated_vertices"],
            "instantiated_triangles": after["instantiated_triangles"],
            "estimated_draw_calls": after["estimated_draw_calls"],
            "bounds_min": after["bounds_min"],
            "bounds_max": after["bounds_max"],
        },
        "operations": operations,
        "validation": validation,
    }


def safely_weld_triangle_soup(*, allow_normal_rebuild: bool = False) -> list[dict]:
    results = []
    for mesh in list(unique_meshes()):
        if not any(mesh.name.startswith(target) for target in TRIANGLE_SOUP_TARGETS):
            continue

        original_name = mesh.name
        users = [obj for obj in mesh_objects() if obj.data == mesh]
        before_metrics = triangle_soup_metrics(mesh)
        before_signature = canonical_triangle_signature(
            mesh, include_corner_attributes=not allow_normal_rebuild
        )
        before_geometry_signature = canonical_triangle_signature(
            mesh, include_corner_attributes=False
        )
        backup = mesh.copy()
        backup.name = f"{mesh.name}__pre_weld_backup"

        bm = bmesh.new()
        bm.from_mesh(mesh)
        bm.verts.ensure_lookup_table()
        index_map = conservative_weld_target_map(mesh)
        target_map = {
            bm.verts[source_index]: bm.verts[target_index]
            for source_index, target_index in index_map.items()
        }
        if target_map:
            bmesh.ops.weld_verts(bm, targetmap=target_map)
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()

        after_signature = canonical_triangle_signature(
            mesh, include_corner_attributes=not allow_normal_rebuild
        )
        after_geometry_signature = canonical_triangle_signature(
            mesh, include_corner_attributes=False
        )
        geometry_counter_unchanged = before_geometry_signature == after_geometry_signature
        geometry_surface_set_unchanged = (
            set(before_geometry_signature) == set(after_geometry_signature)
        )
        accepted = (
            geometry_surface_set_unchanged
            if allow_normal_rebuild
            else before_signature == after_signature
        )
        attempted_after_metrics = triangle_soup_metrics(mesh)
        if not accepted:
            for obj in users:
                obj.data = backup
            bpy.data.meshes.remove(mesh)
            backup.name = original_name
            active_mesh = backup
        else:
            bpy.data.meshes.remove(backup)
            active_mesh = mesh

        after_metrics = triangle_soup_metrics(active_mesh)
        results.append(
            {
                "mesh": active_mesh.name,
                "accepted": accepted,
                "mode": "lod_geometry" if allow_normal_rebuild else "render_exact",
                "geometry_signature_unchanged": geometry_counter_unchanged,
                "geometry_surface_set_unchanged": geometry_surface_set_unchanged,
                "coincident_triangles_collapsed": max(
                    0,
                    sum(before_geometry_signature.values())
                    - sum(after_geometry_signature.values()),
                ),
                "vertices_requested_for_weld": len(index_map),
                "reason": (
                    (
                        "geometry/material surface set unchanged; normals rebuilt for LOD"
                        if allow_normal_rebuild
                        else "render signature unchanged"
                    )
                    if accepted
                    else (
                        "rolled back because geometry/material signature changed"
                        if allow_normal_rebuild
                        else "rolled back because positions/normals/UVs/material signatures changed"
                    )
                ),
                "before": before_metrics,
                "attempted_after": attempted_after_metrics,
                "after": after_metrics,
            }
        )
    return results


def decimate_unique_meshes(ratio: float, min_triangles: int) -> list[dict]:
    if ratio >= 0.999999:
        return []
    results = []
    for mesh in sorted(list(unique_meshes()), key=lambda item: item.name.casefold()):
        before = mesh_triangle_count(mesh)
        if before < min_triangles:
            continue
        users = [obj for obj in mesh_objects() if obj.data == mesh]
        representative = users[0]
        original_name = mesh.name
        bpy.ops.object.select_all(action="DESELECT")
        representative.select_set(True)
        bpy.context.view_layer.objects.active = representative
        # Blender refuses to apply modifiers to multi-user mesh data. Work on a
        # private copy, then reassign the resulting LOD mesh to every instance.
        representative.data = mesh.copy()
        representative.data.name = f"{original_name}__lod_work"
        modifier = representative.modifiers.new(name="AQ_Mobile_LOD", type="DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        apply_result = bpy.ops.object.modifier_apply(modifier=modifier.name)
        if "FINISHED" not in apply_result:
            raise RuntimeError(f"Could not apply decimation to {original_name}: {apply_result}")
        new_mesh = representative.data
        for obj in users:
            obj.data = new_mesh
        if mesh != new_mesh and mesh.users == 0:
            bpy.data.meshes.remove(mesh)
        new_mesh.name = original_name
        after = mesh_triangle_count(new_mesh)
        results.append(
            {
                "mesh": new_mesh.name,
                "users": [obj.name for obj in users],
                "triangles_before": before,
                "triangles_after": after,
                "ratio_actual": round(after / before, 6) if before else 1.0,
            }
        )
    return results


def export_glb(path: Path, args: argparse.Namespace) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    result = bpy.ops.export_scene.gltf(
        filepath=str(path.resolve()),
        export_format="GLB",
        use_selection=False,
        export_yup=True,
        export_normals=True,
        export_texcoords=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=args.draco_level,
        export_draco_position_quantization=args.position_bits,
        export_draco_normal_quantization=args.normal_bits,
        export_draco_texcoord_quantization=args.texcoord_bits,
        export_draco_color_quantization=10,
        export_draco_generic_quantization=12,
    )
    if "FINISHED" not in result:
        raise RuntimeError(f"glTF export failed: {result}")


def look_at(obj: bpy.types.Object, point: Vector) -> None:
    obj.rotation_euler = (point - obj.location).to_track_quat("-Z", "Y").to_euler()


def render_preview(path: Path, source_name: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    minimum, maximum = object_bounds()
    center = (minimum + maximum) * 0.5
    size = maximum - minimum

    world = bpy.data.worlds.new("AQ Preview World") if not bpy.context.scene.world else bpy.context.scene.world
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.008, 0.004, 0.007, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.13

    preview_material = bpy.data.materials.new("AQ Preview Material")
    preview_material.use_nodes = True
    base_color = (
        (0.43, 0.035, 0.025, 1)
        if "muscle" in source_name.casefold()
        else (0.58, 0.43, 0.25, 1)
    )
    preview_material.diffuse_color = base_color
    preview_material.metallic = 0.0
    preview_material.roughness = 0.58
    principled = preview_material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = base_color
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Roughness"].default_value = 0.58
    bpy.context.view_layer.material_override = preview_material

    camera_data = bpy.data.cameras.new("AQ Preview Camera")
    camera = bpy.data.objects.new("AQ Preview Camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    bpy.context.scene.camera = camera
    camera_data.lens = 58
    camera.location = Vector((center.x, minimum.y - max(size.z * 1.68, size.y * 5.5), center.z))
    look_at(camera, center)

    for name, energy, size_value, position in (
        ("AQ Key", 620, 3.0, (minimum.x - size.x, minimum.y - size.y * 2.0, maximum.z + size.z * 0.25)),
        ("AQ Rim", 420, 2.5, (maximum.x + size.x, maximum.y + size.y * 1.5, center.z + size.z * 0.15)),
    ):
        light_data = bpy.data.lights.new(name, type="AREA")
        light_data.energy = energy
        light_data.shape = "DISK"
        light_data.size = size_value
        light = bpy.data.objects.new(name, light_data)
        bpy.context.scene.collection.objects.link(light)
        light.location = Vector(position)
        look_at(light, center)

    scene = bpy.context.scene
    # Blender 5 exposes Eevee as BLENDER_EEVEE; older 4.x builds used the
    # BLENDER_EEVEE_NEXT identifier.
    try:
        scene.render.engine = "BLENDER_EEVEE"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 720
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.35
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = str(path.resolve())
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.resolution_percentage = 100
    bpy.ops.render.render(write_still=True)


def main() -> None:
    args = parse_args()
    started = time.time()
    input_path = args.input.resolve()
    if not input_path.exists():
        raise FileNotFoundError(input_path)

    import_glb(input_path)
    before = scene_stats()
    if args.preview_before:
        render_preview(args.preview_before, input_path.name)
        # Rendering adds camera/light objects only; mesh statistics stay valid.

    repair_results = (
        safely_weld_triangle_soup(allow_normal_rebuild=False)
        if args.repair_triangle_soup
        else []
    )
    if args.lod_weld_triangle_soup:
        repair_results.extend(safely_weld_triangle_soup(allow_normal_rebuild=True))
    lod_results = decimate_unique_meshes(args.lod_ratio, args.min_triangles)
    material_slot_collapse = (
        collapse_material_slots() if args.collapse_material_slots else None
    )

    output_meta = None
    after_processing = scene_stats()
    if args.output:
        output_path = args.output.resolve()
        export_glb(output_path, args)
        output_meta = {
            "path": str(output_path),
            "bytes": output_path.stat().st_size,
            "sha256": sha256(output_path),
        }

        # Validate what a consumer actually receives, not only Blender's edit scene.
        import_glb(output_path)
        reimported = scene_stats()
        if args.preview_after:
            render_preview(args.preview_after, output_path.name)
    else:
        reimported = after_processing

    report = {
        "pipeline_version": PIPELINE_VERSION,
        "blender_version": bpy.app.version_string,
        "input": {
            "path": str(input_path),
            "bytes": input_path.stat().st_size,
            "sha256": sha256(input_path),
        },
        "output": output_meta,
        "settings": {
            "repair_triangle_soup": args.repair_triangle_soup,
            "lod_weld_triangle_soup": args.lod_weld_triangle_soup,
            "collapse_material_slots": args.collapse_material_slots,
            "lod_ratio": args.lod_ratio,
            "min_triangles": args.min_triangles,
            "draco_level": args.draco_level,
            "position_bits": args.position_bits,
            "normal_bits": args.normal_bits,
            "texcoord_bits": args.texcoord_bits,
        },
        "before": before,
        "after_processing": after_processing,
        "after_reimport": reimported,
        "triangle_soup_repairs": repair_results,
        "lod_operations": lod_results,
        "material_slot_collapse": material_slot_collapse,
        "validation": {
            "mesh_object_names_preserved": before["object_names"]
            == reimported["object_names"],
            "mesh_object_count_preserved": before["mesh_objects"]
            == reimported["mesh_objects"],
            "unique_mesh_count_preserved": before["unique_meshes"]
            == reimported["unique_meshes"],
            "reimported_triangle_delta_from_processing": (
                reimported["instantiated_triangles"]
                - after_processing["instantiated_triangles"]
            ),
            "reimported_draw_calls_equal_mesh_objects": (
                reimported["estimated_draw_calls"] == reimported["mesh_objects"]
                if args.collapse_material_slots
                else None
            ),
            "reimported_at_most_one_material_slot_per_mesh": (
                all(item["materials"] <= 1 for item in reimported["meshes"])
                if args.collapse_material_slots
                else None
            ),
            "bounds_size_delta": [
                round(reimported["bounds_size"][index] - before["bounds_size"][index], 6)
                for index in range(3)
            ],
            "instantiated_triangle_ratio": round(
                reimported["instantiated_triangles"] / before["instantiated_triangles"], 6
            ),
        },
        "duration_seconds": round(time.time() - started, 3),
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if args.collapse_material_slots:
        required_checks = (
            "mesh_object_names_preserved",
            "mesh_object_count_preserved",
            "unique_mesh_count_preserved",
            "reimported_draw_calls_equal_mesh_objects",
            "reimported_at_most_one_material_slot_per_mesh",
        )
        failed = [name for name in required_checks if not report["validation"][name]]
        if failed:
            raise RuntimeError(
                "Reimport validation failed after material-slot collapse: "
                + ", ".join(failed)
            )
    print("AQ_PIPELINE_REPORT", args.report.resolve())
    print("AQ_PIPELINE_SUMMARY", json.dumps(report["validation"], ensure_ascii=False))


if __name__ == "__main__":
    main()

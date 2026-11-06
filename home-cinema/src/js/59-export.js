// ===================================================================
// 59 · Download a piece as a 3D file (.glb, binary glTF): metres, Y up,
//      front facing +Z. Opens in Windows 3D Viewer, macOS/iOS Quick Look
//      via conversion, Android Scene Viewer, Blender, SketchUp (with the
//      glTF importer) and most web viewers.
// ===================================================================
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

/** InstancedMesh -> plain meshes, so viewers without EXT_mesh_gpu_instancing still show every copy. */
function flattenInstances(root) {
  const todo = [];
  root.traverse((o) => { if (o.isInstancedMesh) todo.push(o); });
  for (const inst of todo) {
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < inst.count; i++) {
      inst.getMatrixAt(i, m4);
      const m = new THREE.Mesh(inst.geometry, inst.material);
      m.applyMatrix4(m4); m.applyMatrix4(inst.matrix);
      inst.parent.add(m);
    }
    inst.parent.remove(inst);
  }
}
function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const fileSlug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** Export one placed piece, with its current style and configuration, as a .glb download. */
function exportItemGLB(it) {
  const def = CATALOG[it.type]; if (!def) return;
  const s = resolveSpec(it), built = FACTORIES[it.type]({ ...def.defaults, ...it.p }, it, s);
  const root = new THREE.Group();
  root.name = def.label; root.scale.setScalar(0.0254);                     // inches -> metres
  root.add(built.group); flattenInstances(root); root.updateMatrixWorld(true);
  const v = (VARIANTS[it.type] || {})[s.variant];
  const name = fileSlug([def.label.replace('·', ''), UPHOLSTERED[it.type] ? colorName(s.color) : '', UPHOLSTERED[it.type] ? COVERS[s.cover].label : ''].filter(Boolean).join(' ')) + '.glb';
  root.userData = { source: 'Basement Cinema Planner', style: v ? v.label : '', size: pieceSize(it, s).text, units: 'metres' };
  toast('Building the 3D file…');
  new GLTFExporter().parse(root, (buf) => {
    saveBlob(new Blob([buf], { type: 'model/gltf-binary' }), name);
    toast(`${name} downloaded`);
  }, (err) => { console.error(err); toast('Could not build the 3D file'); }, { binary: true, onlyVisible: true, maxTextureSize: 1024 });
}

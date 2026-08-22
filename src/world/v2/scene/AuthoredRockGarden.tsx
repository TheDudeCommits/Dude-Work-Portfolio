import { useGLTF } from '@react-three/drei'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SumiSurfaceMaterial } from '../../../art'

const ROCK_SET_URL = '/assets/environment/rocks/rock-moss-set-02.glb'

const ROCK_ANCHORS = [
  [-8.4, -0.04, 15.2, 0.18, 0.92],
  [8.9, -0.08, 14.2, -0.42, 0.78],
  [-10.8, -0.12, 7.8, 0.76, 1.12],
  [10.7, -0.14, 6.2, -0.85, 0.98],
  [-13.3, -0.14, 0.3, 1.21, 1.24],
  [13.4, -0.18, -1.2, -1.12, 1.06],
  [-15.2, -0.16, -8.6, 0.52, 1.32],
  [15.0, -0.17, -10.1, -0.64, 1.18],
  [-10.1, -0.1, -16.3, 1.52, 0.9],
  [10.8, -0.1, -16.7, -1.45, 0.96],
] as const

interface RockSource {
  geometry: THREE.BufferGeometry
  map: THREE.Texture | null
  normalMap: THREE.Texture | null
  roughnessMap: THREE.Texture | null
}

function groundGeometry(source: THREE.Mesh) {
  source.updateWorldMatrix(true, false)
  const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld)
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox
  if (bounds) {
    const center = bounds.getCenter(new THREE.Vector3())
    geometry.translate(-center.x, -bounds.min.y, -center.z)
  }
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function RockFamily({ family, familyIndex }: { family: RockSource; familyIndex: number }) {
  const count = 2
  const mesh = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    if (!mesh.current) return
    const transform = new THREE.Object3D()
    for (let instance = 0; instance < count; instance += 1) {
      const anchor = ROCK_ANCHORS[(familyIndex * count + instance) % ROCK_ANCHORS.length]
      const mirror = instance % 2 === 0 ? 1 : -1
      transform.position.set(anchor[0], anchor[1], anchor[2])
      transform.rotation.set(
        Math.sin(familyIndex * 2.4 + instance) * 0.045,
        anchor[3] + familyIndex * 0.27,
        Math.cos(familyIndex * 1.7 + instance) * 0.055,
      )
      transform.scale.set(
        anchor[4] * (0.88 + familyIndex * 0.035),
        anchor[4] * (0.72 + (familyIndex % 3) * 0.12),
        anchor[4] * (0.82 + (familyIndex % 2) * 0.16) * mirror,
      )
      transform.updateMatrix()
      mesh.current.setMatrixAt(instance, transform.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
    mesh.current.computeBoundingSphere()
  }, [familyIndex, mesh])

  return (
    <instancedMesh
      args={[undefined, undefined, count]}
      castShadow
      count={count}
      geometry={family.geometry}
      receiveShadow
      ref={mesh}
    >
      <SumiSurfaceMaterial
        inkResponse={0.74}
        map={family.map ?? undefined}
        normalMap={family.normalMap ?? undefined}
        normalScale={new THREE.Vector2(0.18, 0.18)}
        paperResponse={0.42}
        role={familyIndex % 3 === 1 ? 'foliage' : 'stone'}
        roughnessMap={family.roughnessMap ?? undefined}
      />
    </instancedMesh>
  )
}

export function AuthoredRockGarden() {
  const gltf = useGLTF(ROCK_SET_URL)
  const families = useMemo(() => {
    const sources: RockSource[] = []
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      const material = Array.isArray(child.material) ? child.material[0] : child.material
      const standard = material instanceof THREE.MeshStandardMaterial ? material : null
      sources.push({
        geometry: groundGeometry(child),
        map: standard?.map ?? null,
        normalMap: standard?.normalMap ?? null,
        roughnessMap: standard?.roughnessMap ?? null,
      })
    })
    return sources.slice(0, 7)
  }, [gltf.scene])

  return (
    <group name="authored-rock-garden">
      {families.map((family, index) => (
        <RockFamily family={family} familyIndex={index} key={family.geometry.uuid} />
      ))}
    </group>
  )
}

useGLTF.preload(ROCK_SET_URL)

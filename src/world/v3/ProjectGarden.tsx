import { useCursor } from '@react-three/drei'
import { type ThreeEvent, useFrame } from '@react-three/fiber'
import {
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as THREE from 'three'
import { createPortalMembraneGeometry } from '../v2/scene/geometry'
import { ProjectInkMembrane } from '../v2/scene/materials'
import { freeRoamInput } from '../v2/runtime/input'
import { freeRoamStore } from '../v2/runtime/store'
import {
  ChapterEventField,
  PROJECT_CHAPTERS,
  ProjectChapterZones,
} from './ProjectGardenChapters'
import type { V3SumiMaterialAdapter } from './types'

const GAZE_DISTANCE = 14
const PROXIMITY_RADIUS = 5.75
const INTERACTION_PREFIX = 'project-garden:'

export interface ProjectGardenProps {
  active?: boolean
  materialAdapter: V3SumiMaterialAdapter
  reducedMotion?: boolean
}

/**
 * The projects are nine inhabitable garden chapters rather than a terminal
 * gallery. The artwork is only the living heart of each chapter: terrain,
 * architecture and ecology establish the encounter well before it is close
 * enough to interact with.
 */
export function ProjectGarden({
  active = true,
  materialAdapter,
  reducedMotion = false,
}: ProjectGardenProps): ReactElement {
  const artMeshes = useRef<Array<THREE.Mesh | null>>([])
  const centerRaycaster = useMemo(() => {
    const raycaster = new THREE.Raycaster()
    raycaster.near = 0.2
    raycaster.far = GAZE_DISTANCE
    return raycaster
  }, [])
  const center = useMemo(() => new THREE.Vector2(0, 0), [])
  const hits = useRef<THREE.Intersection[]>([])
  const pointerIndex = useRef<number | null>(null)
  const interactionQueued = useRef(false)
  const focusedIndexRef = useRef<number | null>(null)
  const publishedInteraction = useRef<string | null>(null)
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const [activated, setActivated] = useState<ReadonlySet<number>>(() => new Set())
  useCursor(focusedIndex !== null)

  const activateProject = useCallback((index: number) => {
    if (!active) return
    const layout = PROJECT_CHAPTERS[index]
    if (!layout) return
    const interactionId = `${INTERACTION_PREFIX}${layout.project.slug}`
    setActivated((current) => {
      if (current.has(index)) return current
      const next = new Set(current)
      next.add(index)
      return next
    })
    freeRoamStore.getState().setInteraction({ lastActivatedId: interactionId })
    window.open(layout.project.href, '_blank', 'noopener,noreferrer')
  }, [active])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !active
        || event.repeat
        || (event.code !== 'Space' && event.code !== 'KeyE')
        || !freeRoamStore.getState().interaction.nearbyId?.startsWith(INTERACTION_PREFIX)
      ) return
      interactionQueued.current = true
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [active])

  useEffect(() => () => {
    const runtime = freeRoamStore.getState()
    if (runtime.interaction.nearbyId?.startsWith(INTERACTION_PREFIX)) {
      runtime.setInteraction({ available: false, nearbyId: null })
    }
  }, [])

  useFrame(({ camera }) => {
    if (!active) {
      if (publishedInteraction.current !== null) {
        publishedInteraction.current = null
        freeRoamStore.getState().setInteraction({ available: false, nearbyId: null })
      }
      return
    }

    const runtime = freeRoamStore.getState()
    const [playerX, , playerZ] = runtime.motion.position
    let nearestIndex: number | null = null
    let nearestDistanceSquared = PROXIMITY_RADIUS * PROXIMITY_RADIUS
    PROJECT_CHAPTERS.forEach((layout, index) => {
      const dx = layout.focusPosition[0] - playerX
      const dz = layout.focusPosition[2] - playerZ
      const distanceSquared = dx * dx + dz * dz
      const art = artMeshes.current[index]
      if (art) art.visible = distanceSquared < layout.nearDistance * layout.nearDistance
      if (distanceSquared < nearestDistanceSquared) {
        nearestDistanceSquared = distanceSquared
        nearestIndex = index
      }
    })

    centerRaycaster.setFromCamera(center, camera)
    hits.current.length = 0
    const raycastTargets = artMeshes.current.filter((mesh): mesh is THREE.Mesh => Boolean(mesh?.visible))
    centerRaycaster.intersectObjects(raycastTargets, false, hits.current)
    const gazeValue = hits.current[0]?.object.userData.projectGardenIndex
    const gazeIndex = Number.isInteger(gazeValue) ? Number(gazeValue) : null
    const withinGazeDistance = (index: number) => {
      const focus = PROJECT_CHAPTERS[index].focusPosition
      return (focus[0] - playerX) ** 2 + (focus[2] - playerZ) ** 2 <= GAZE_DISTANCE ** 2
    }
    const gazeAllowed = gazeIndex !== null && withinGazeDistance(gazeIndex)
    const pointerValue = pointerIndex.current
    const pointerAllowed = pointerValue !== null && withinGazeDistance(pointerValue)
    const candidate = pointerAllowed
      ? pointerValue
      : gazeAllowed
        ? gazeIndex
        : nearestIndex

    if (candidate !== focusedIndexRef.current) {
      focusedIndexRef.current = candidate
      setFocusedIndex(candidate)
    }

    const interactionId = candidate === null
      ? null
      : `${INTERACTION_PREFIX}${PROJECT_CHAPTERS[candidate].project.slug}`
    if (interactionId !== publishedInteraction.current) {
      publishedInteraction.current = interactionId
      runtime.setInteraction({ available: interactionId !== null, nearbyId: interactionId })
    }

    const shouldActivate = freeRoamInput.consumeInteract() || interactionQueued.current
    interactionQueued.current = false
    if (shouldActivate && candidate !== null) activateProject(candidate)
  })

  const handlePointerOver = (index: number, event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    pointerIndex.current = index
  }

  const handlePointerOut = (index: number) => {
    if (pointerIndex.current === index) pointerIndex.current = null
  }

  const membraneGeometry = useMemo(
    () => createPortalMembraneGeometry(2.12, 2.12, 14, 16),
    [],
  )
  useEffect(() => () => membraneGeometry.dispose(), [membraneGeometry])

  return (
    <group name="v3-nine-living-project-garden">
      <ProjectChapterZones materialAdapter={materialAdapter} />
      <ChapterEventField focusedIndex={focusedIndex} reducedMotion={reducedMotion} />
      {PROJECT_CHAPTERS.map((layout, index) => (
        <mesh
          geometry={membraneGeometry}
          key={layout.project.slug}
          name={`V3_ProjectEncounter_${layout.project.slug}`}
          onClick={(event) => {
            event.stopPropagation()
            activateProject(index)
          }}
          onPointerOut={() => handlePointerOut(index)}
          onPointerOver={(event) => handlePointerOver(index, event)}
          position={layout.artPosition}
          ref={(mesh) => {
            artMeshes.current[index] = mesh
            if (mesh) mesh.userData.projectGardenIndex = index
          }}
          rotation={layout.artRotation}
          scale={layout.artScale}
          userData={{ projectHref: layout.project.href, projectSlug: layout.project.slug }}
        >
          <ProjectInkMembrane
            active={activated.has(index)}
            focused={focusedIndex === index}
            image={layout.project.image}
            reducedMotion={reducedMotion}
          />
        </mesh>
      ))}
    </group>
  )
}

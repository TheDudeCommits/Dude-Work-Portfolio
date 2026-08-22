import { addAfterEffect, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { freeRoamStore } from './store'

export interface FreeRoamDiagnosticsProbeProps {
  enabled?: boolean
  sampleInterval?: number
}

export function FreeRoamDiagnosticsProbe({
  enabled = true,
  sampleInterval = 0.25,
}: FreeRoamDiagnosticsProbeProps) {
  const gl = useThree((state) => state.gl)
  const elapsed = useRef(0)
  const frames = useRef(0)
  const lastTimestamp = useRef<number | null>(null)

  useEffect(() => addAfterEffect((timestamp) => {
    if (!enabled) return
    if (lastTimestamp.current === null) {
      lastTimestamp.current = timestamp
      return
    }
    const delta = Math.min((timestamp - lastTimestamp.current) / 1000, 0.25)
    lastTimestamp.current = timestamp
    elapsed.current += delta
    frames.current += 1
    if (elapsed.current < sampleInterval) return
    const fps = frames.current / elapsed.current
    freeRoamStore.getState().setDiagnostics({
      drawCalls: gl.info.render.calls,
      fps,
      frameMs: 1000 / Math.max(fps, 0.001),
      triangles: gl.info.render.triangles,
    })
    elapsed.current = 0
    frames.current = 0
  }), [enabled, gl, sampleInterval])

  return null
}

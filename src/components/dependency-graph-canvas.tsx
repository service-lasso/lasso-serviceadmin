import { useEffect, useRef, useState } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/theme-provider'

type GraphLegendItem = {
  label: string
  color: string
  dashed?: boolean
}

export type GraphPaneSize = {
  width: number
  height: number
}

type DependencyGraphCanvasProps = {
  nodes: Node[]
  edges: Edge[]
  height?: number
  fill?: boolean
  paneTestId?: string
  onPaneSizeChange?: (size: GraphPaneSize) => void
  onNodeClick?: (nodeId: string) => void
  onNodeDragStop?: (_event: unknown, node: Node) => void
  onNodesChange?: OnNodesChange<Node>
  onEdgesChange?: OnEdgesChange<Edge>
  fitView?: boolean
  minZoom?: number
  maxZoom?: number
  draggable?: boolean
  selectable?: boolean
  showControls?: boolean
  showMiniMap?: boolean
  legendItems?: GraphLegendItem[]
  miniMapNodeColor?: (node: Node) => string
}

const FIT_VIEW_PADDING = 0.16
const MIN_PANE_SIZE = 8

/**
 * Re-fit after layout or pane resize so the graph uses the current box
 * instead of the first-paint size.
 */
function FitViewOnPaneChange({
  layoutKey,
  paneWidth,
  paneHeight,
}: {
  layoutKey: string
  paneWidth: number
  paneHeight: number
}) {
  const { fitView } = useReactFlow()

  useEffect(() => {
    if (paneWidth < MIN_PANE_SIZE || paneHeight < MIN_PANE_SIZE) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      void fitView({
        padding: FIT_VIEW_PADDING,
        duration: 0,
      })
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [fitView, layoutKey, paneWidth, paneHeight])

  return null
}

function paneLayoutKey(nodes: Node[]) {
  return nodes
    .map((node) => `${node.id}:${node.position.x}:${node.position.y}`)
    .join('|')
}

/**
 * React Flow surface. `fill` grows with the parent (Mapping graph); a
 * numeric `height` keeps legacy callers such as Dependencies unchanged.
 */
export function DependencyGraphCanvas({
  nodes,
  edges,
  height = 520,
  fill = false,
  paneTestId,
  onPaneSizeChange,
  onNodeClick,
  onNodeDragStop,
  onNodesChange,
  onEdgesChange,
  fitView = true,
  minZoom = 0.35,
  maxZoom = 1.6,
  draggable = true,
  selectable = true,
  showControls = true,
  showMiniMap = true,
  legendItems = [],
  miniMapNodeColor,
}: DependencyGraphCanvasProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const paneRef = useRef<HTMLDivElement>(null)
  const onPaneSizeChangeRef = useRef(onPaneSizeChange)
  const [paneSize, setPaneSize] = useState<GraphPaneSize>({
    width: 0,
    height: 0,
  })

  onPaneSizeChangeRef.current = onPaneSizeChange

  useEffect(() => {
    const pane = paneRef.current
    if (!pane) {
      return
    }

    const publishSize = (width: number, height: number) => {
      const nextSize = {
        width: Math.round(width),
        height: Math.round(height),
      }
      setPaneSize((current) => {
        if (
          current.width === nextSize.width &&
          current.height === nextSize.height
        ) {
          return current
        }
        return nextSize
      })
      const notify = onPaneSizeChangeRef.current
      if (notify) {
        notify(nextSize)
      }
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) {
        return
      }
      publishSize(entry.contentRect.width, entry.contentRect.height)
    })

    observer.observe(pane)
    publishSize(pane.clientWidth, pane.clientHeight)

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <div
      className={cn('flex min-h-0 flex-col gap-3', fill && 'flex-1')}
      data-testid={fill ? 'dependency-graph-fill' : undefined}
    >
      <div
        ref={paneRef}
        data-testid={paneTestId}
        className={cn(
          fill ? 'min-h-0 flex-1 overflow-hidden' : undefined,
          isDark
            ? 'rounded-lg border bg-slate-950'
            : 'rounded-lg border bg-slate-50'
        )}
        style={fill ? undefined : { height }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={
            onNodeClick ? (_event, node) => onNodeClick(node.id) : undefined
          }
          onNodeDragStop={onNodeDragStop}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView={fitView}
          fitViewOptions={{
            padding: FIT_VIEW_PADDING,
            minZoom,
            maxZoom,
          }}
          minZoom={minZoom}
          maxZoom={maxZoom}
          nodesDraggable={draggable}
          elementsSelectable={selectable}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
          style={{ width: '100%', height: '100%' }}
        >
          <FitViewOnPaneChange
            layoutKey={paneLayoutKey(nodes)}
            paneWidth={paneSize.width}
            paneHeight={paneSize.height}
          />
          <Background
            gap={20}
            size={1}
            color={isDark ? '#1f2937' : '#cbd5e1'}
          />
          {showControls ? (
            <Controls
              className={
                isDark
                  ? '!overflow-hidden !rounded-md !border !border-slate-700 !bg-slate-900 [&_button]:!border-slate-700 [&_button]:!bg-slate-900 [&_button]:!text-slate-200 [&_button:hover]:!bg-slate-800'
                  : '!overflow-hidden !rounded-md !border !border-slate-300 !bg-white [&_button]:!border-slate-300 [&_button]:!bg-white [&_button]:!text-slate-700 [&_button:hover]:!bg-slate-100'
              }
            />
          ) : null}
          {showMiniMap ? (
            <MiniMap
              pannable
              zoomable
              nodeColor={miniMapNodeColor}
              maskColor={
                isDark ? 'rgba(2, 6, 23, 0.5)' : 'rgba(226, 232, 240, 0.65)'
              }
              className={
                isDark
                  ? '!border !border-slate-700 !bg-slate-900'
                  : '!border !border-slate-300 !bg-white'
              }
            />
          ) : null}
        </ReactFlow>
      </div>

      {legendItems.length ? (
        <div
          className={
            isDark
              ? 'flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-200'
              : 'flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700'
          }
        >
          {legendItems.map((item) => (
            <div key={item.label} className='flex items-center gap-2'>
              <span
                className={`inline-block h-[2px] w-8 ${
                  item.dashed
                    ? 'border-t-2 border-dashed bg-transparent'
                    : 'rounded'
                }`}
                style={{
                  backgroundColor: item.dashed ? 'transparent' : item.color,
                  borderColor: item.dashed ? item.color : 'transparent',
                }}
              />
              {item.label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

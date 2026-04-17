import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useTheme } from '@/context/theme-provider'

type GraphLegendItem = {
  label: string
  color: string
  dashed?: boolean
}

type DependencyGraphCanvasProps = {
  nodes: Node[]
  edges: Edge[]
  height?: number
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

export function DependencyGraphCanvas({
  nodes,
  edges,
  height = 520,
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

  return (
    <div className='space-y-3'>
      <div
        className={
          isDark
            ? 'rounded-lg border bg-slate-950'
            : 'rounded-lg border bg-slate-50'
        }
        style={{ height }}
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
          minZoom={minZoom}
          maxZoom={maxZoom}
          nodesDraggable={draggable}
          elementsSelectable={selectable}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
        >
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
              ? 'flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-200'
              : 'flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700'
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

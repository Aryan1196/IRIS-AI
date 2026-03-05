import React, { useState, useCallback } from 'react'
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  applyNodeChanges,
  applyEdgeChanges,
  ReactFlowProvider
} from 'reactflow'
import { Tooltip } from 'react-tooltip'
import 'reactflow/dist/style.css'
import 'react-tooltip/dist/react-tooltip.css'
import ToolNode, { getIcon } from '../components/ToolNode'
import ParameterEditorDrawer from '../components/ParameterEditorDrawer'
import MacroManagementMenu from '../components/MacroManagementMenu'
import { RiSave3Line, RiLayoutColumnLine, RiLayoutColumnFill, RiAddLine } from 'react-icons/ri'

// 🚨 HIGHLY CURATED, PRO-GRADE AUTOMATION TOOLS
const CATEGORIZED_TOOLS = {
  TRIGGERS: [
    { name: 'TRIGGER_VOICE', description: 'Starts the workflow.', parameters: {} },
    {
      name: 'WAIT',
      description: 'Pauses execution.',
      parameters: {
        properties: { milliseconds: { type: 'NUMBER', description: 'Delay in ms (e.g. 2000)' } }
      }
    }
  ],
  SYSTEM: [
    {
      name: 'open_app',
      description: 'Launch desktop app.',
      parameters: { properties: { app_name: { type: 'STRING' } } }
    },
    {
      name: 'close_app',
      description: 'Force close an app.',
      parameters: { properties: { app_name: { type: 'STRING' } } }
    },
    {
      name: 'set_volume',
      description: 'Change system volume (0-100).',
      parameters: { properties: { level: { type: 'NUMBER' } } }
    }
  ],
  AUTOMATION: [
    {
      name: 'ghost_type',
      description: 'Type text via keyboard.',
      parameters: { properties: { text: { type: 'STRING' } } }
    },
    {
      name: 'press_shortcut',
      description: 'e.g. key: "c", modifiers: ["control"].',
      parameters: {
        properties: {
          key: { type: 'STRING' },
          modifiers: { type: 'ARRAY', items: { type: 'STRING' } }
        }
      }
    },
    {
      name: 'run_terminal',
      description: 'Execute CLI command.',
      parameters: { properties: { command: { type: 'STRING' }, path: { type: 'STRING' } } }
    }
  ],
  WEB_INTELLIGENCE: [
    {
      name: 'google_search',
      description: 'Open a URL or search.',
      parameters: { properties: { query: { type: 'STRING' } } }
    },
    {
      name: 'deep_research',
      description: 'AI Web scrape & Notion report.',
      parameters: { properties: { query: { type: 'STRING' } } }
    }
  ],
  MOBILE_LINK: [
    {
      name: 'open_mobile_app',
      description: 'Requires Android package name.',
      parameters: { properties: { package_name: { type: 'STRING' } } }
    },
    {
      name: 'toggle_mobile_hardware',
      description: 'Toggle Wifi/Bluetooth.',
      parameters: { properties: { setting: { type: 'STRING' }, state: { type: 'BOOLEAN' } } }
    },
    {
      name: 'send_whatsapp',
      description: 'Send instant message.',
      parameters: { properties: { name: { type: 'STRING' }, message: { type: 'STRING' } } }
    }
  ]
}

const ALL_TOOLS = Object.values(CATEGORIZED_TOOLS).flat()
const nodeTypes = { customTool: ToolNode }

function Editor() {
  const [nodes, setNodes] = useState<any[]>([])
  const [edges, setEdges] = useState<any[]>([])
  const [workflowName, setWorkflowName] = useState('New Jarvis Macro')
  const [description, setDescription] = useState('Custom Macro')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)

  // Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // 🚨 UI Interaction Function
  const openParameterEditor = useCallback((nodeId: string) => setSelectedNodeId(nodeId), [])

  // 🚨 FIX: Re-inject the function when loading from DB
  const loadMacroToCanvas = (macro: any) => {
    setWorkflowName(macro.name)
    setDescription(macro.description)

    // Rehydrate nodes with the UI function that we stripped during save
    const rehydratedNodes = (macro.nodes || []).map((node: any) => ({
      ...node,
      data: {
        ...node.data,
        openParameterEditor // Injecting the click handler back
      }
    }))

    setNodes(rehydratedNodes)
    setEdges(macro.edges || [])
    setIsSaved(true)
  }

  const resetCanvas = () => {
    setWorkflowName('New Jarvis Macro')
    setDescription('Custom Macro')
    setNodes([])
    setEdges([])
    setIsSaved(false)
  }

  const updateNodeInputs = useCallback(
    (nodeId: string, updatedInputs: any, updatedComment: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: { ...node.data, inputs: updatedInputs, comment: updatedComment }
            }
          }
          return node
        })
      )
    },
    []
  )

  const onNodesChange = useCallback(
    (changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  )
  const onEdgesChange = useCallback(
    (changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  )

  // 🚨 Wavy Bezier connections (type: 'default')
  const onConnect = useCallback(
    (params: any) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'default',
            animated: true,
            style: { stroke: '#10b981', strokeWidth: 2, filter: 'drop-shadow(0 0 4px #10b981)' }
          },
          eds
        )
      ),
    []
  )

  // Drop from sidebar to canvas
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const toolName = event.dataTransfer.getData('application/reactflow')
      if (!toolName) return

      const toolSchema = ALL_TOOLS.find((t) => t.name === toolName)
      const position = { x: event.clientX - (isSidebarOpen ? 300 : 50), y: event.clientY - 100 }

      const newNode = {
        id: `${toolName}_${Date.now()}`,
        type: 'customTool',
        position,
        data: { tool: toolSchema, inputs: {}, comment: '', openParameterEditor }
      }
      setNodes((nds) => nds.concat(newNode))
    },
    [openParameterEditor, isSidebarOpen]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  // 🚨 FIX: Strip the function before saving to prevent IPC Clone Error
  const saveWorkflow = async () => {
    const sanitizedNodes = nodes.map((node) => {
      const cleanData = { ...node.data }
      delete cleanData.openParameterEditor // Strip the function reference
      return { ...node, data: cleanData }
    })

    try {
      const res = await (window as any).electron.ipcRenderer.invoke('save-workflow', {
        name: workflowName,
        description: description,
        nodes: sanitizedNodes, // Send cleaned nodes
        edges
      })
      if (res.success) {
        alert('Neural Pattern Saved Successfully! 🧠')
        setIsSaved(true)
      } else {
        console.error('Backend Save Error:', res.error)
      }
    } catch (err) {
      console.error('IPC Error:', err)
    }
  }

  return (
    <div className="flex h-full w-full bg-[#09090b] relative overflow-hidden">
      {/* SLIDABLE SIDEBAR */}
      <div
        className={`fixed top-14 left-0 h-[calc(100vh-56px)] bg-[#111113] border-r border-[#27272a] p-4 flex flex-col gap-1 transition-all duration-300 ease-in-out z-40 scrollbar-small ${isSidebarOpen ? 'w-72 opacity-100' : 'w-0 opacity-0'}`}
      >
        {isSidebarOpen && (
          <>
            <h2 className="text-[10px] font-black tracking-[0.2em] text-emerald-500 mb-6 flex items-center gap-2 border-b border-[#27272a] pb-2 uppercase">
              MODULE LIBRARY
            </h2>

            {Object.entries(CATEGORIZED_TOOLS).map(([category, tools]) => (
              <div key={category} className="mb-6">
                <h3 className="text-[10px] font-bold tracking-[0.1em] text-zinc-500 uppercase mb-3">
                  {category}
                </h3>
                <div className="flex flex-col gap-2">
                  {tools.map((tool) => (
                    <div
                      key={tool.name}
                      className="flex items-center gap-3 p-2 bg-[#18181b] border border-[#27272a] rounded-lg cursor-grab hover:border-emerald-500/50 hover:bg-[#27272a]/50 transition-all group"
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData('application/reactflow', tool.name)
                      }
                    >
                      <div className="p-1.5 bg-black rounded shadow-inner border border-white/5">
                        {getIcon(tool.name, 14)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold tracking-widest text-zinc-300 uppercase group-hover:text-white transition-colors">
                          {tool.name.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* SIDEBAR TOGGLE BUTTON */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="absolute top-1/2 left-0 transform -translate-y-1/2 bg-[#111113] border border-[#27272a] border-l-0 p-2 rounded-r-lg text-zinc-600 hover:text-emerald-500 z-50 transition-colors"
      >
        {isSidebarOpen ? <RiLayoutColumnLine size={18} /> : <RiLayoutColumnFill size={18} />}
      </button>

      {/* CANVAS */}
      <div
        className={`flex-grow flex flex-col relative transition-all duration-300 ease-in-out ${isSidebarOpen ? 'ml-72' : 'ml-0'}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        {/* HEADER TOOLBAR */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-3 shadow-2xl">
          <button
            onClick={resetCanvas}
            className="p-3 rounded-lg bg-[#18181b] border border-[#27272a] text-zinc-600 hover:text-emerald-500 hover:border-emerald-500/50 transition-colors cursor-pointer"
            data-tooltip-id="global-tooltip"
            data-tooltip-content="Start New Macro"
          >
            <RiAddLine size={16} />
          </button>

          <MacroManagementMenu loadMacroToCanvas={loadMacroToCanvas} />

          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="bg-[#18181b] border border-[#27272a] px-4 py-2 rounded-lg text-sm text-white outline-none focus:border-emerald-500 font-bold tracking-wide w-64 shadow-inner"
          />
          <button
            onClick={saveWorkflow}
            className="bg-emerald-600 hover:bg-emerald-500 text-black px-6 py-2 rounded-lg text-[11px] font-black tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-2 cursor-pointer"
          >
            <RiSave3Line size={16} /> SAVE MACRO
          </button>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          className="bg-[#09090b]"
        >
          <Background color="#27272a" gap={20} size={1} />
          <Controls className="react-flow__controls" />
        </ReactFlow>

        <Tooltip
          id="global-tooltip"
          place="top"
          style={{
            maxWidth: '250px',
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            zIndex: 100
          }}
        />

        {selectedNodeId && (
          <ParameterEditorDrawer
            nodeData={nodes.find((n) => n.id === selectedNodeId)}
            updateNodeInputs={updateNodeInputs}
            closeEditor={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </div>
  )
}

export default function WorkFlowEditorView() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  )
}

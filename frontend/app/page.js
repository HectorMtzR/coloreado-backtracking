'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Play, Pause, Download, Trash2, RefreshCcw } from 'lucide-react';

const NODE_RADIUS = 25;
const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7"]; 

export default function MapColoringApp() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  
  // Inicializamos en 3, pero permitiremos que sea cadena vacía temporalmente
  const [numColors, setNumColors] = useState(3);
  
  // Estados de la solución
  const [steps, setSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [nodeColors, setNodeColors] = useState({});
  const [statusMsg, setStatusMsg] = useState("1. Haz clic para crear nodos. 2. Une nodos clicando uno y luego otro.");
  const [highlight, setHighlight] = useState(null);
  const [solutionResult, setSolutionResult] = useState(null); 

  const canvasRef = useRef(null);

  // --- FUNCIONES DE REINICIO ---

  const handleSoftReset = () => {
    setSteps([]);
    setCurrentStep(-1);
    setNodeColors({});
    setIsPlaying(false);
    setSolutionResult(null);
    setStatusMsg("Solución borrada. Puedes cambiar el número de colores o editar el mapa.");
  };

  const handleHardReset = () => {
    const confirmDelete = window.confirm("¿Estás seguro de borrar todo el mapa?");
    if (confirmDelete) {
        setNodes([]);
        setEdges([]);
        handleSoftReset(); 
        setStatusMsg("Lienzo limpio. Dibuja un nuevo mapa.");
    }
  };

  // ------------------------------------

  const handleCanvasClick = (e) => {
    if (steps.length > 0) return; 
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clickedNode = nodes.find(n => Math.hypot(n.x - x, n.y - y) < NODE_RADIUS);

    if (clickedNode) {
      if (selectedNode && selectedNode !== clickedNode.id) {
        setEdges([...edges, { source: selectedNode, target: clickedNode.id }]);
        setSelectedNode(null);
      } else {
        setSelectedNode(clickedNode.id);
      }
    } else {
      const newNode = { id: `N${nodes.length}`, x, y };
      setNodes([...nodes, newNode]);
      setSelectedNode(null);
    }
  };

  const solveMap = async () => {
    // VALIDACIONES DE SEGURIDAD
    if (nodes.length === 0) return alert("Dibuja al menos un nodo.");
    if (!numColors || numColors < 2 || numColors > 5) return alert("Por favor define entre 2 y 5 colores.");
    
    setSolutionResult(null);
    setSteps([]);
    
    try {
      setStatusMsg("Conectando con el motor de Backtracking...");
      const response = await axios.post('https://api-mapa-coloreado.onrender.com/', {
        nodes: nodes.map(n => n.id),
        edges: edges,
        num_colors: parseInt(numColors) // Aseguramos que se envíe como entero
      });
      
      setSolutionResult(response.data.success);

      if (response.data.steps.length > 0) {
        setSteps(response.data.steps);
        setCurrentStep(-1);
        setNodeColors({});
        setIsPlaying(true);
        setStatusMsg("Iniciando animación...");
      } else {
        setStatusMsg("No se generaron pasos (Error inesperado).");
      }
    } catch (error) {
      console.error(error);
      setStatusMsg("Error: Asegúrate de que el backend (Python) esté corriendo.");
    }
  };

  useEffect(() => {
    let interval;
    if (isPlaying) {
       if (steps.length > 0 && currentStep < steps.length - 1) {
          interval = setInterval(() => {
            setCurrentStep(prev => prev + 1);
          }, speed);
       } else if (currentStep >= steps.length - 1) {
          const timer = setTimeout(() => {
              setIsPlaying(false);
              if (solutionResult === true) {
                  setStatusMsg("¡ÉXITO! El mapa se ha coloreado correctamente.");
              } else {
                  setStatusMsg(`IMPOSIBLE: No se puede resolver con ${numColors} colores.`);
              }
          }, 0);
          return () => clearTimeout(timer);
       }
    }
    return () => clearInterval(interval);
  }, [isPlaying, steps, currentStep, speed, solutionResult, numColors]);

  useEffect(() => {
    const timer = setTimeout(() => {
        if (currentStep === -1) {
          setNodeColors({});
          setHighlight(null);
          return;
        }

        const step = steps[currentStep];
        if (!step) return;

        setStatusMsg(step.description);

        switch (step.action) {
          case 'check':
            setHighlight({ node: step.node, type: 'check' });
            break;
          case 'assign':
            setNodeColors(prev => ({ ...prev, [step.node]: step.color - 1 }));
            setHighlight(null);
            break;
          case 'conflict':
            setHighlight({ node: step.node, type: 'conflict', with: step.conflict_with });
            break;
          case 'backtrack':
            setNodeColors(prev => {
                const newColors = { ...prev };
                delete newColors[step.node];
                return newColors;
            });
            setHighlight({ node: step.node, type: 'backtrack' });
            break;
          default: break;
        }
    }, 0);

    return () => clearTimeout(timer);
  }, [currentStep, steps]);

  const downloadMap = () => {
    const svgElement = canvasRef.current.querySelector('svg');
    if (!svgElement) return;

    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svgElement);

    const img = new Image();
    const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const rect = svgElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = 'mapa-coloreado.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const getStatusColor = () => {
      if (isPlaying) return "bg-blue-50 text-blue-800 border-blue-200";
      if (steps.length > 0 && currentStep >= steps.length - 1) {
          return solutionResult 
            ? "bg-green-100 text-green-800 border-green-300 font-bold" 
            : "bg-red-100 text-red-800 border-red-300 font-bold";
      }
      return "bg-gray-100 text-gray-600 border-gray-200";
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 p-4 font-sans text-black">
      <div className="bg-white p-4 rounded-xl shadow-sm mb-4 flex flex-wrap gap-4 items-center justify-between border border-gray-200">
        
        <div className="flex items-center gap-4">
          
          {/* CAMBIO AQUÍ: Input robusto contra errores de NaN */}
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Colores</label>
            <input 
              type="number" min="2" max="5" 
              value={numColors} 
              onChange={(e) => {
                const val = e.target.value;
                // Si está vacío, lo dejamos vacío. Si tiene número, lo convertimos.
                setNumColors(val === '' ? '' : parseInt(val));
              }}
              className="border border-gray-300 rounded p-1 w-16 text-center font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
              disabled={steps.length > 0} 
            />
          </div>

          <div className="h-8 w-px bg-gray-200 mx-1"></div>

          <button 
            onClick={solveMap} 
            disabled={steps.length > 0} 
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm transition-all flex items-center gap-2"
          >
            <Play size={16} fill="currentColor" /> Resolver
          </button>

          {(steps.length > 0 || nodes.length > 0) && (
             <button 
               onClick={handleSoftReset}
               title="Mantiene el mapa, borra los colores"
               className="text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 border border-gray-200"
             >
               <RefreshCcw size={16} /> Reintentar
             </button>
          )}

          <button 
            onClick={handleHardReset}
            title="Borra todo y empieza de cero"
            className="text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-1 ml-2"
          >
            <Trash2 size={16} /> 
          </button>
        </div>

        <button onClick={downloadMap} className="flex items-center gap-2 text-sm bg-green-50 text-green-700 px-3 py-2 rounded-lg border border-green-200 hover:bg-green-100 font-medium transition-colors shadow-sm">
          <Download size={16} /> Descargar
        </button>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="flex-1 bg-white rounded-xl shadow-inner border border-gray-200 relative overflow-hidden" ref={canvasRef}>
          <p className="absolute top-2 left-2 text-xs text-gray-400 pointer-events-none z-10 select-none">
            Clic para crear nodos • Clic en uno y luego en otro para conectar
          </p>
          <svg className="w-full h-full cursor-crosshair" onClick={handleCanvasClick}>
            {edges.map((edge, i) => {
                const start = nodes.find(n => n.id === edge.source);
                const end = nodes.find(n => n.id === edge.target);
                if(!start || !end) return null;
                const isConflict = highlight?.type === 'conflict' && ((highlight.node === edge.source && highlight.with === edge.target) || (highlight.node === edge.target && highlight.with === edge.source));
                return <line key={i} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={isConflict ? "red" : "#cbd5e1"} strokeWidth={isConflict ? 4 : 2} />;
            })}
            {nodes.map((node) => {
                const colorIndex = nodeColors[node.id];
                const isSelected = selectedNode === node.id;
                const isHighlighted = highlight?.node === node.id;
                let fill = "white";
                if (colorIndex !== undefined) fill = COLORS[colorIndex];
                if (isHighlighted && highlight.type === 'check') fill = "#e2e8f0";
                if (isHighlighted && highlight.type === 'backtrack') fill = "#fee2e2";
                return (
                    <g key={node.id}>
                        <circle cx={node.x} cy={node.y} r={NODE_RADIUS} fill={fill} stroke={isSelected ? "blue" : (isHighlighted && highlight.type === 'conflict' ? "red" : "black")} strokeWidth={isSelected || isHighlighted ? 3 : 2} />
                        <text x={node.x} y={node.y} dy=".3em" textAnchor="middle" className="pointer-events-none text-xs font-bold opacity-50 select-none">{node.id}</text>
                    </g>
                );
            })}
          </svg>
        </div>

        <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col">
            <h3 className="font-bold text-gray-700 mb-4">Análisis</h3>
            <div className={`p-3 rounded-lg mb-4 h-24 overflow-y-auto text-sm border transition-colors duration-500 flex items-center justify-center text-center ${getStatusColor()}`}>
                {statusMsg}
            </div>
            {steps.length > 0 && (
                <div className="flex flex-col gap-4">
                    <div className="flex justify-center gap-2">
                        <button onClick={() => setIsPlaying(!isPlaying)} className="p-3 bg-gray-800 text-white rounded-full hover:bg-black transition shadow-md">
                            {isPlaying ? <Pause size={20}/> : <Play size={20} />}
                        </button>
                    </div>
                    <div>
                         <label className="text-xs font-bold text-gray-400 uppercase">Progreso</label>
                        <input type="range" min="0" max={steps.length - 1} value={currentStep} onChange={(e) => { setIsPlaying(false); setCurrentStep(parseInt(e.target.value)); }} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Velocidad: {speed}ms</label>
                        <input type="range" min="50" max="2000" step="50" value={speed} onChange={(e) => setSpeed(parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
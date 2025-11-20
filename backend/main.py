from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict, Optional
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Permitir que el Frontend hable con este Backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Edge(BaseModel):
    source: str
    target: str

class MapRequest(BaseModel):
    nodes: List[str]
    edges: List[Edge]
    num_colors: int

# Algoritmo de Backtracking con registro de pasos
def solve_backtracking(node_idx, nodes, adj_list, assignments, num_colors, steps, step_counter):
    if node_idx == len(nodes):
        return True

    current_node = nodes[node_idx]

    for color in range(1, num_colors + 1):
        # 1. ANIMACIÓN: Probar color (Check)
        steps.append({
            "step_id": step_counter[0], "node": current_node, "color": color,
            "action": "check", "description": f"Probando color {color} en {current_node}...", "conflict_with": None
        })
        step_counter[0] += 1
        
        # Validar vecinos
        conflict = False
        for neighbor in adj_list[current_node]:
            if neighbor in assignments and assignments[neighbor] == color:
                # 2. ANIMACIÓN: Conflicto detectado
                steps.append({
                    "step_id": step_counter[0], "node": current_node, "color": color,
                    "action": "conflict", "description": f"¡Conflicto con vecino {neighbor}!", "conflict_with": neighbor
                })
                step_counter[0] += 1
                conflict = True
                break
        
        if not conflict:
            assignments[current_node] = color
            # 3. ANIMACIÓN: Asignación exitosa (Assign)
            steps.append({
                "step_id": step_counter[0], "node": current_node, "color": color,
                "action": "assign", "description": f"Color {color} asignado a {current_node}. Avanzando.", "conflict_with": None
            })
            step_counter[0] += 1

            if solve_backtracking(node_idx + 1, nodes, adj_list, assignments, num_colors, steps, step_counter):
                return True
            
            # 4. ANIMACIÓN: Backtracking (Retroceso)
            assignments[current_node] = None
            steps.append({
                "step_id": step_counter[0], "node": current_node, "color": None,
                "action": "backtrack", "description": f"Camino cerrado. Retrocediendo en {current_node}.", "conflict_with": None
            })
            step_counter[0] += 1

    return False

@app.post("/solve")
def solve_map(data: MapRequest):
    adj_list = {node: [] for node in data.nodes}
    for edge in data.edges:
        if edge.source in adj_list and edge.target in adj_list:
            adj_list[edge.source].append(edge.target)
            adj_list[edge.target].append(edge.source)
            
    assignments = {}
    steps = []
    step_counter = [0]

    success = solve_backtracking(0, data.nodes, adj_list, assignments, data.num_colors, steps, step_counter)

    return {"success": success, "steps": steps}
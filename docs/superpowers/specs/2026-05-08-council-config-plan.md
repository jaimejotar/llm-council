# Council Configuration UI — Plan de Implementación

**Spec:** `2026-05-08-council-config-design.md`  
**Fecha:** 2026-05-08

---

## Orden de implementación

Las fases están ordenadas para que cada una sea testeable de forma aislada antes de continuar.

---

## Fase 1 — Backend: módulos nuevos (sin tocar código existente)

### 1a. `backend/models_catalog.py`

Crear el módulo con el catálogo hardcodeado y la función de estimación.

- Lista de ~25 modelos: Claude Haiku 4.5, Sonnet 4.5, Opus 4.7 · GPT-4.1, GPT-4.1 Mini · Gemini 2.0 Flash, Gemini 2.5 Pro/Flash · Grok-3 · Llama 4 Maverick · Mistral Large, Small · DeepSeek V3/R1
- Cada modelo: `{id, name, provider, input_price_per_1m, output_price_per_1m, context_window, tier}`
- `get_catalog() -> list[dict]`
- `estimate_query_cost(model_ids: list[str]) -> dict`
  - Asume ~1500 tokens input + 500 tokens output × N modelos + 1 chairman
  - Retorna `{input_per_1m_usd, output_per_1m_usd, per_query_usd}`
- (Opcional) `refresh_from_openrouter()` — GET `https://openrouter.ai/api/v1/models`, actualiza precios en memoria, falla silenciosa

**Verificación:** `python -c "from models_catalog import get_catalog, estimate_query_cost; print(estimate_query_cost(['anthropic/claude-haiku-4-5-20251001', 'google/gemini-2.0-flash']))"`

---

### 1b. `backend/councils.py`

Crear el módulo CRUD sobre `data/councils.json`.

- `DATA_FILE = Path(__file__).parent.parent / "data" / "councils.json"`
- `load_councils()` — lee JSON, retorna `[]` si no existe
- `save_councils(councils)` — escritura atómica via `os.replace(tmp, DATA_FILE)`
- `get_council(council_id)` — `None` si no existe
- `create_council(data)` — genera `id` con `secrets.token_hex(4)`, valida, llama `save_councils`
- `update_council(id, data)` — valida, reemplaza en lista
- `delete_council(id)` — elimina por id
- `seed_defaults()` — si `load_councils()` vacío, inserta los 2 presets (Exploración Barata + Consejo Premium) y guarda

Validaciones compartidas (función interna `_validate`):
- `models` no vacío
- `chairman` en `models`
- `name` no vacío

**Verificación:** test manual desde Python REPL, crear/leer/editar/borrar un consejo, verificar `data/councils.json`.

---

## Fase 2 — Backend: endpoints nuevos en `main.py`

Agregar al final de `main.py` (después de los endpoints existentes):

```python
@app.get("/api/councils")
@app.post("/api/councils")          # body: {name, models, chairman}
@app.put("/api/councils/{id}")      # body: {name, models, chairman}
@app.delete("/api/councils/{id}")
@app.get("/api/models/catalog")
```

- `GET /api/councils`: llama `seed_defaults()` si lista vacía, retorna lista completa
- `POST /api/councils`: llama `create_council`, retorna 201 + council creado
- `PUT /api/councils/{id}`: llama `update_council`, 404 si no existe
- `DELETE /api/councils/{id}`: llama `delete_council`, 404 si no existe
- `GET /api/models/catalog`: retorna `get_catalog()` + llama `estimate_query_cost` para los modelos default

**Verificación:** Swagger UI en `http://localhost:8001/docs` — probar CRUD manual.

---

## Fase 3 — Backend: conectar council al flujo de query

Modificar `main.py` en el handler de `POST /api/conversations/{id}/message[/stream]`:

1. Leer `conversation["council_id"]`
2. Llamar `get_council(council_id)` → obtener `{models, chairman}`
3. Fallback a `config.COUNCIL_MODELS` / `config.CHAIRMAN_MODEL` si `None`
4. Pasar `models` y `chairman` a `run_full_council()`

Modificar `backend/council.py`:

```python
# Cambio de firma — sin tocar lógica interna
async def run_full_council(
    prompt: str,
    models: list[str],
    chairman: str
) -> AsyncGenerator:
    ...
```

Modificar `POST /api/conversations` para aceptar `council_id` opcional en el body y guardarlo en el JSON de la conversación.

**Verificación:** arrancar `bash start.sh`, crear conversación con consejo "Exploración Barata", enviar query, confirmar en logs que usa los modelos correctos.

---

## Fase 4 — Frontend: `CouncilModal.jsx`

Crear `frontend/src/components/CouncilModal.jsx`.

**Props:** `{ isOpen, onClose, councils, catalog, onSave, onDelete }`

**Tab "Presets":**
- Grid de cards: nombre, lista de modelos (truncada), costo estimado, badge PRESET si `is_preset`
- Acciones: Editar (abre Tab Editor pre-cargado) / Eliminar (confirm inline)

**Tab "Editor":** (dos columnas)
- Columna izquierda:
  - Input nombre
  - Lista de modelos seleccionados: chip con `×`, badge `⭐ Chair` si es chairman
  - Dropdown "Establecer como chairman" (filtra a los modelos en lista)
  - Cuadro verde de estimación: actualiza on-change con datos de `catalog`
- Columna derecha:
  - Input de búsqueda (filtra `catalog` por nombre/provider)
  - Lista de resultados: nombre, precio, botón "+"
  - Modelos ya en lista aparecen con ✓ y sin botón "+"

**Tab "Catálogo":**
- Filtros: tier (chip selector) + provider (dropdown)
- Tabla: modelo, provider, input price, output price, context window

**Footer:** Cancelar + Guardar consejo (disabled si validación falla)

---

## Fase 5 — Frontend: `NewConversationDialog.jsx`

Crear `frontend/src/components/NewConversationDialog.jsx`.

**Props:** `{ isOpen, onClose, councils, onConfirm }`

- Select/dropdown con lista de councils, pre-selecciona índice 0
- Link "⚙️ Configurar" → abre `CouncilModal` (sin cerrar el dialog)
- Botón "Crear conversación" → llama `onConfirm(selectedCouncilId)`

---

## Fase 6 — Frontend: modificar `Sidebar.jsx` y `App.jsx`

**`Sidebar.jsx`:**
- Agregar en footer: `<button onClick={onOpenCouncilModal}>⚙️ Consejos</button>`
- Prop nueva: `onOpenCouncilModal`

**`App.jsx`:**
- Cargar councils al montar: `useEffect(() => fetch('/api/councils')...)`
- Cargar catalog al montar: `useEffect(() => fetch('/api/models/catalog')...)`
- Estado nuevo: `councils`, `catalog`, `councilModalOpen`, `newConvDialogOpen`
- Reemplazar llamada directa a crear conversación por abrir `NewConversationDialog`
- Handlers: `handleSaveCouncil`, `handleDeleteCouncil` (llaman a PUT/DELETE + refrescan `councils`)
- Renderizar `<CouncilModal>` y `<NewConversationDialog>` al fondo del árbol

---

## Fase 7 — Verificación end-to-end

1. `bash start.sh` desde Git Bash en `C:\Users\jaime\dev\llm-council`
2. Abrir `http://localhost:5173`
3. Click "⚙️ Consejos" → modal abre con Tab Presets mostrando los 2 presets
4. Crear consejo nuevo con 2 modelos baratos → costo estimado se actualiza live
5. Click "Nueva" → `NewConversationDialog` muestra dropdown con 3 consejos
6. Seleccionar consejo nuevo → enviar query → confirmar en logs del backend que usa modelos correctos
7. Verificar `data/conversations/{id}.json` contiene `council_id` correcto
8. Verificar `data/councils.json` contiene el consejo creado

---

## Archivos a crear/modificar (resumen)

| Archivo | Fase | Acción |
|---|---|---|
| `backend/models_catalog.py` | 1a | Crear |
| `backend/councils.py` | 1b | Crear |
| `backend/main.py` | 2 + 3 | Modificar |
| `backend/council.py` | 3 | Modificar (firma) |
| `frontend/src/components/CouncilModal.jsx` | 4 | Crear |
| `frontend/src/components/NewConversationDialog.jsx` | 5 | Crear |
| `frontend/src/components/Sidebar.jsx` | 6 | Modificar |
| `frontend/src/App.jsx` | 6 | Modificar |
| `data/councils.json` | Runtime | Creado por `seed_defaults()` |

---

## Notas de implementación

- React: el usuario es senior Python, menos experiencia en React. Preferir componentes funcionales simples con hooks (`useState`, `useEffect`). Evitar librerías de UI externas — el proyecto ya usa CSS inline/clases propias.
- No agregar tests unitarios (Karpathy lo califica como "fun hack, provided as is" — no tiene test suite).
- El modal usa `position: absolute` sobre el app shell (ver mockup Option C) — no `position: fixed` para no salir del contenedor del mockup.
- Precio de modelos: los precios de OpenRouter varían; documentar en `models_catalog.py` la fecha de última actualización manual.

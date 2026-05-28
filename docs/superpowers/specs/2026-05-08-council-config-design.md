# Council Configuration UI — Design Spec

**Date:** 2026-05-08  
**Status:** Approved  
**Repo:** `C:\Users\jaime\dev\llm-council` (karpathy/llm-council fork)

---

## Objetivo

Agregar una pantalla de configuración visual de "consejos" (councils) que permita:
1. Seleccionar entre presets predefinidos (Exploración Barata, Consejo Premium, etc.)
2. Crear/editar consejos con +/- modelos miembros y chairman
3. Ver estimación de costo por query y por 1M tokens en tiempo real

---

## Decisiones de diseño

| Pregunta | Decisión |
|---|---|
| Layout UI | Modal completo (Option C del mockup) |
| Catálogo de modelos | Mixto: hardcodeado base + refresh opcional desde OpenRouter |
| Scope del consejo | Per-conversación (cada conversación recuerda su consejo) |
| Protección de presets | Editables/borrables como cualquier consejo (una sola fuente de verdad) |
| Selección al crear conversación | Diálogo explícito: "¿Qué consejo usar?" al hacer click en "Nueva" |
| Arquitectura | Backend como fuente de verdad (lógica en Python, frontend solo UI) |

---

## Arquitectura backend

### Módulos nuevos

**`backend/councils.py`**

CRUD sobre `data/councils.json`. Funciones públicas:

```python
load_councils() -> list[dict]
save_councils(councils: list[dict])        # escritura atómica (temp → rename)
get_council(council_id: str) -> dict | None
create_council(data: dict) -> dict         # genera id, valida, persiste
update_council(id: str, data: dict) -> dict
delete_council(id: str) -> bool
seed_defaults()                            # si councils.json vacío, crea presets iniciales
```

Validaciones en `create_council` / `update_council`:
- `models` no vacío (mínimo 1 modelo)
- `chairman` debe ser uno de los valores de `models`

**`backend/models_catalog.py`**

Catálogo de ~25 modelos con pricing. Fuente primaria: lista hardcodeada. Fuente secundaria: OpenRouter `/api/v1/models` (refresh opcional al arrancar).

```python
get_catalog() -> list[dict]
# Cada modelo: {id, name, provider, input_price_per_1m, output_price_per_1m, context_window, tier}
# tier: "cheap" | "mid" | "premium"

estimate_query_cost(model_ids: list[str]) -> dict
# Retorna: {input_per_1m_usd, output_per_1m_usd, per_query_usd}
# per_query asume ~2k tokens típicos (1.5k input + 0.5k output) × N modelos + chairman
```

### Endpoints nuevos en `main.py`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/councils` | Lista todos los councils |
| `POST` | `/api/councils` | Crear council (valida models + chairman) |
| `PUT` | `/api/councils/{id}` | Actualizar council |
| `DELETE` | `/api/councils/{id}` | Eliminar council |
| `GET` | `/api/models/catalog` | Catálogo completo con pricing |

### Cambio en endpoint existente

`POST /api/conversations` acepta `council_id` opcional. Si omitido, usa el primer council de la lista (índice 0 de `councils.json`).

`POST /api/conversations/{id}/message[/stream]` lee `council_id` de la conversación y lo resuelve a `{models, chairman}` antes de llamar a `council.py`.

### Cambio mínimo en `council.py`

```python
# Antes:
async def run_full_council(prompt: str) -> AsyncGenerator:
    models = config.COUNCIL_MODELS
    chairman = config.CHAIRMAN_MODEL

# Después:
async def run_full_council(prompt: str, models: list[str], chairman: str) -> AsyncGenerator:
    ...  # lógica interna sin cambios
```

`config.py` sigue existiendo como fallback si `council_id` no se resuelve.

---

## Estructura de datos

### `data/councils.json` (nuevo archivo)

```json
{
  "version": 1,
  "councils": [
    {
      "id": "exploracion_barata",
      "name": "Exploración Barata",
      "is_preset": true,   // display only — muestra badge "PRESET" en UI, no restringe edición/borrado
      "models": [
        "anthropic/claude-haiku-4-5-20251001",
        "openai/gpt-4.1-mini",
        "google/gemini-2.0-flash",
        "meta-llama/llama-4-maverick"
      ],
      "chairman": "google/gemini-2.0-flash",
      "created_at": "2026-05-08T00:00:00Z"
    },
    {
      "id": "consejo_premium",
      "name": "Consejo Premium",
      "is_preset": true,   // display only — muestra badge "PRESET" en UI, no restringe edición/borrado
      "models": [
        "anthropic/claude-sonnet-4-5",
        "google/gemini-2.5-pro-preview",
        "openai/gpt-4.1",
        "x-ai/grok-3"
      ],
      "chairman": "google/gemini-2.5-pro-preview",
      "created_at": "2026-05-08T00:00:00Z"
    }
  ]
}
```

### `data/conversations/{id}.json` (campo nuevo: `council_id`)

```json
{
  "id": "abc123",
  "created_at": "2026-05-08T...",
  "title": "¿Diferencia CRSS y PPA?",
  "council_id": "exploracion_barata",
  "messages": [...]
}
```

---

## Arquitectura frontend

### Componentes nuevos

**`frontend/src/components/CouncilModal.jsx`**

Modal con 3 tabs. Se abre desde botón "⚙️ Consejos" en el sidebar footer.

- **Tab "Presets"**: grid de cards con nombre, modelos, costo estimado. Acciones: Seleccionar como default / Editar / Eliminar.
- **Tab "Editor"**: dos columnas side-by-side.
  - Columna izquierda: lista de modelos seleccionados (nombre, precio input/output, botón ×). Badge `⭐ Chair` en el chairman. Cuadro verde de estimación de costo al fondo.
  - Columna derecha: buscador de modelos (input filtrable) + lista de resultados con precio por fila. Click en una fila lo agrega al consejo.
- **Tab "Catálogo"**: tabla filtrable de todos los modelos disponibles por tier (cheap/mid/premium) y provider.

Footer del modal: "Cancelar" + "Guardar consejo".

**`frontend/src/components/NewConversationDialog.jsx`**

Dialog ligero que se muestra al hacer click en "Nueva conversación":

```
¿Con qué consejo quieres trabajar?
[ Exploración Barata  ▼ ]   [⚙️ Configurar]   [Crear conversación]
```

Dropdown lista todos los councils; pre-selecciona el primero de la lista. "Configurar" abre `CouncilModal`. Confirmar llama a `POST /api/conversations` con `council_id`.

### Componentes modificados

**`frontend/src/components/Sidebar.jsx`**
- Agrega botón "⚙️ Consejos" en el footer
- Click abre `CouncilModal` standalone (sin selección de conversación)

**`frontend/src/App.jsx`**
- Nuevo estado: `councils`, `councilModalOpen`, `newConvDialogOpen`
- `councils` se carga al montar (`GET /api/councils`) y se refresca tras cada CRUD
- Click en "Nueva conversación" abre `NewConversationDialog` en lugar de llamar directo a la API

---

## Flujo de datos

### Crear conversación

```
Click "Nueva"
  → NewConversationDialog: GET /api/councils → muestra opciones
  → Usuario selecciona consejo y confirma
  → POST /api/conversations { council_id: "exploracion_barata" }
  → backend: crea data/conversations/{id}.json con council_id
  → frontend: agrega conversación al sidebar, navega a ella
```

### Enviar query

```
Usuario envía mensaje
  → POST /api/conversations/{id}/message/stream
  → backend/main.py: lee {id}.json → extrae council_id
  → backend/councils.py: get_council(council_id) → {models, chairman}
  → backend/council.py: run_full_council(prompt, models, chairman)
       Stage 1: query_models_parallel(models)
       Stage 2: cross-ranking anónimo
       Stage 3: chairman sintetiza
  → SSE stream → frontend (sin cambios en UI de respuesta)
```

---

## Error handling

| Situación | Comportamiento |
|---|---|
| `council_id` en conversación no existe | Fallback a `config.COUNCIL_MODELS` + log warning |
| `councils.json` ausente o corrupto | `seed_defaults()` lo regenera con presets |
| OpenRouter refresh falla | Catálogo sirve desde hardcoded; sin error visible al usuario |
| `POST /api/councils` con `models` vacío | 400 Bad Request |
| Chairman no está en `models` | 400 Bad Request con mensaje explícito |
| `DELETE` de council en uso por conversaciones activas | Permitido (conversaciones históricas caen al fallback) |

---

## Presets iniciales (seed)

| ID | Name | Modelos | Chairman | Costo aprox/query |
|---|---|---|---|---|
| `exploracion_barata` | Exploración Barata | Haiku 4.5, GPT-4.1 Mini, Gemini 2.0 Flash, Llama 4 Maverick | Gemini 2.0 Flash | ~$0.01–0.03 |
| `consejo_premium` | Consejo Premium | Sonnet 4.5, Gemini 2.5 Pro, GPT-4.1, Grok-3 | Gemini 2.5 Pro | ~$0.10–0.30 |

---

## Archivos afectados

| Archivo | Acción |
|---|---|
| `backend/councils.py` | Crear (nuevo) |
| `backend/models_catalog.py` | Crear (nuevo) |
| `backend/main.py` | Modificar: agregar endpoints + leer council_id al procesar mensaje |
| `backend/council.py` | Modificar: `run_full_council()` acepta `models` y `chairman` como parámetros |
| `data/councils.json` | Crear al primer arranque (via `seed_defaults()`) |
| `frontend/src/components/CouncilModal.jsx` | Crear (nuevo) |
| `frontend/src/components/NewConversationDialog.jsx` | Crear (nuevo) |
| `frontend/src/components/Sidebar.jsx` | Modificar: agregar botón ⚙️ Consejos en footer |
| `frontend/src/App.jsx` | Modificar: estado councils, dialog al crear conversación |

---

## Out of scope

- Autenticación / multi-usuario
- Sincronización de councils entre máquinas
- Editar el consejo de una conversación ya iniciada
- Historial de versiones de un council

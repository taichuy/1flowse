# 1Flowse Product Design Discussion

Date: 2026-04-10
Status: Draft approved in discussion, pending final user review

## 1. Product Positioning

1Flowse is a lightweight, extensible AI workflow platform centered on publishing workflows as standard Agent-friendly APIs.

It is not positioned as:
- a chat-first AI product
- a generic low-code platform
- a full enterprise multi-tenant PaaS in P1

Its primary goal is to let a team build an AI Flow, publish it as a stable external interface, and make that interface usable by clients such as Codex, Claude Code, and other local or hosted agents.

Under this positioning:
- `Flow` is the core asset
- `Publish Endpoint` is the core deliverable
- `State Model` is the persistence layer for memory and cross-session context
- `Plugin Framework` is the extensibility foundation
- built-in chat and page capabilities are supporting surfaces, not the product center

## 2. Product Priorities

Priority order confirmed in discussion:

1. Standard Agent-compatible publishing is the main product focus.
2. State and memory management are the main competitive advantage.
3. Plugin extensibility is the architectural support layer.

This means the product should be described as an AI workflow platform with an agent-publish-first strategy, not as a generic AI builder with many unrelated modules.

## 3. Core Product Principles

- `Workflow first`: the primary object users create and operate is a Flow.
- `Publish first`: a Flow is not complete until it can be exposed as a usable external interface.
- `Runtime truth`: workflow behavior must be grounded in a durable runtime model, not only editor metadata.
- `State is structured`: persistent memory should be explicit, queryable, and manageable.
- `Observability is product surface`: logs, tool calls, node inputs and outputs, and token cost are first-class user-facing capabilities.
- `Permissions are backend-governed`: resource and route access must be controlled from a unified backend policy layer.

## 4. Target Scope For P1

P1 is a team-oriented AI workflow platform.

P1 proves one closed loop:

1. A team creates an application.
2. The application contains a Flow built with multiple nodes, including multiple LLM nodes if needed.
3. The Flow can be debugged with node-level execution visibility.
4. The Flow is published as a standard Agent-friendly API.
5. External clients can call it through a stable interface.
6. Runtime can handle tool calls, pauses, callbacks, resume, and checkpoint persistence.
7. Structured state can persist memory and context across calls.

P1 is successful if teams can build, publish, run, inspect, and control these applications reliably.

## 5. Core Domain Objects

### 5.1 Team Workspace

`Team Workspace` is the only first-class space object in P1.

All core resources belong to a team workspace:
- Flows
- publish endpoints
- state models
- state data
- external data sources
- plugin configurations
- logs and monitoring views
- admin routes and application settings

### 5.2 Tenant

`Tenant` exists only as a reserved future expansion field in P1.

It is not a product-level object in P1 and does not drive current space, permission, or management design.

### 5.3 Application

`Application` is the user-facing packaging unit managed from the Workbench.

An application contains:
- one or more Flows
- publish configuration
- runtime logs
- monitoring views
- state/data bindings
- app-level settings

Applications are how users organize deliverable AI capabilities.

### 5.4 Flow

`Flow` is the core editable asset.

A Flow is a versioned workflow definition containing:
- nodes
- edges
- variable definitions
- input and output contracts
- state read and write behavior
- publish-related settings

### 5.5 Run

`Flow Run` is one execution instance of a Flow.

It carries:
- invocation input
- runtime context
- state references
- publish protocol session information
- checkpoints
- final output

### 5.6 Node Run

`Node Run` is the execution instance of a node within a Flow Run.

This object is required because multiple LLM nodes, tool pauses, and callback recovery are core runtime behaviors, not implementation details.

### 5.7 State Model

`State Model` is the structured storage layer used for:
- cross-session memory
- business state persistence
- context injection
- basic operator-facing data management

It is not positioned as a general-purpose low-code data platform.

### 5.8 Publish Endpoint

`Publish Endpoint` is the external deliverable of a Flow.

Users do not only run Flows inside the platform. They publish them as stable interfaces consumable by external agents and clients.

### 5.9 Plugin

`Plugin` is the extension carrier for:
- model provider integrations
- node types
- data sources
- publish adapters

## 6. Execution Model And Node State

The execution model is not simple sequential node traversal. It must support pause, resume, callback, checkpointing, and persistent recovery.

### 6.1 Runtime Objects

- `Flow Run`: the full workflow execution session
- `Node Run`: the execution state of one node within a flow run
- `Checkpoint`: a persisted restore point at a runtime boundary
- `Callback Task`: a pending resume task waiting for tool, async, or human input

### 6.2 Flow Run States

- `queued`
- `running`
- `waiting_callback`
- `waiting_human`
- `paused`
- `succeeded`
- `failed`
- `cancelled`

### 6.3 Node Run States

- `pending`
- `ready`
- `running`
- `streaming`
- `waiting_tool`
- `waiting_callback`
- `waiting_human`
- `retrying`
- `succeeded`
- `failed`
- `skipped`

### 6.4 Required Runtime Semantics

- A single Flow may contain multiple LLM nodes.
- An LLM node may produce text, structured output, tool call requests, or control signals.
- Tool call behavior must suspend the current node rather than immediately advancing to the next node.
- Once suspended, runtime must persist a checkpoint before waiting for external input or callback completion.
- After callback data arrives, runtime must resume the suspended node first, then continue downstream execution.
- Downstream nodes may start only after the current node reaches a stable completed state.
- Inter-node data should use a unified internal object model, not loose text concatenation.

These semantics are core to the product because external Agent-facing protocols naturally require tool calling, follow-up queries, and multi-step completion behavior.

## 7. Product Modules And Boundaries

### 7.1 Workflow Studio

The Workflow Studio is responsible for:
- visual node orchestration
- versioned flow editing
- variable and contract definition
- publish setup
- debug entry points

### 7.2 Runtime Orchestrator

The Runtime Orchestrator is responsible for:
- node scheduling
- state propagation
- tool pause and resume
- checkpoint persistence
- callback recovery
- failure handling
- streaming output

### 7.3 Publish Gateway

The Publish Gateway is the product's most important differentiator.

P1 should use:
- one unified internal runtime protocol
- multiple external adapter layers

This lets the platform map one Flow runtime model into multiple external Agent-facing protocol styles without fragmenting internal logic.

### 7.4 State Service

The State Service is responsible for:
- state model definition
- relationship definition
- CRUD generation
- context injection strategy
- state access during runtime
- operator-facing state management

This service exists to support memory and state, not to become a full low-code product.

### 7.5 Plugin Framework

The Plugin Framework is responsible for:
- plugin capability declaration
- lifecycle management
- registration and discovery
- provider extension
- node extension
- data source extension
- publish adapter extension

### 7.6 Access Control

Access Control is backend-managed and unified across resources and routes.

### 7.7 Admin Console

The Admin Console provides minimal P1 support for:
- state data management
- query and table views
- configuration screens
- resource-level operational management

P1 does not include a full page-builder product.

## 8. Team, Resource, And Permission Model

Permissions must cover both data-bearing resources and route access.

### 8.1 First-Class Resources

P1 resource authorization must cover at least:
- `Flow`
- `Publish Endpoint`
- `State Model`
- `State Data`
- `External Data Source`
- `Plugin Config`
- `Admin Route / View`

### 8.2 Action Model

At minimum, permission actions should include:
- `view`
- `edit`
- `publish`
- `manage`
- `use`
- `configure`

### 8.3 Baseline Visibility Policies

P1 should support simple but explicit policies such as:
- creator only
- team visible
- team editable
- role-managed
- role-limited publish or invoke access

### 8.4 External Data Source Control

External data sources are sensitive first-class resources.

Permissions must distinguish:
- who can create or configure a data source
- who can view data source metadata
- who can use a data source inside a Flow or State Model
- who can manage its credentials

### 8.5 Route Access Policy

Routes must not bypass resource authorization.

A route should be accessible only when:
- the user has access to the route itself
- the user also has access to the resources bound to that route

This keeps backend route access and resource access in one unified policy system.

## 9. Interaction Design And Information Architecture

### 9.1 Top-Level Navigation

The platform top-level navigation should be fixed and simple:
- `Workbench`
- `Team`
- `Admin Settings`

Meaning:
- `Workbench`: application management
- `Team`: members, roles, permissions, and collaborative resource access
- `Admin Settings`: provider, plugin, data source, and platform-level configuration

Applications should not become top-level navigation categories. They are resources managed inside the Workbench.

### 9.2 Workbench

The Workbench is where users:
- create applications
- browse applications
- search applications
- access recent applications
- review publish status at a high level

### 9.3 Application Workspace

After entering an application, the UI should use a left-right structure:
- left sidebar for feature navigation
- right main area for the active page

### 9.4 Application Sidebar

The application sidebar should include:
- `Canvas Orchestration`
- `API Docs`
- `Conversation Logs`
- `Monitoring`
- `State & Data`
- `Application Settings`

### 9.5 Canvas Orchestration

Canvas Orchestration uses `xyflow` as an infinite canvas for:
- node composition
- branching
- variable wiring
- state access
- publish-related behavior

### 9.6 API Docs

API Docs are first-class because publishability is a core product promise.

This page should expose:
- endpoint shape
- authentication method
- request format
- response format
- callback behavior
- example usage

### 9.7 Conversation Logs

Conversation Logs are a primary product surface and should be treated as more than chat history.

Each log view should include:
- conversation content
- tool call records
- node-by-node inputs and outputs
- pause and resume events
- callback flow
- failures
- final result

This page should support product trust, debugging, auditability, and runtime understanding. It should take inspiration from the strongest parts of Dify's observable conversation experience while serving multi-node workflow execution more directly.

### 9.8 Monitoring

Monitoring is a first-class application page, not only an ops backend view.

P1 user-facing metrics should include:
- token usage for a conversation
- total requests today
- application call count
- success and failure rate
- average response latency
- tool call count
- provider usage distribution
- frequently used nodes
- failure-heavy nodes
- recent abnormal conversation count

These metrics answer questions users actively care about: cost, usage, stability, and hotspots.

### 9.9 State & Data

This page is for:
- state model management
- relation management
- data browsing
- CRUD operations
- data source mapping
- context inspection

It supports application memory and state, not general low-code application development.

### 9.10 AI Assistant Surface

AI assistance may exist as a side panel or contextual helper, but it remains secondary to the Flow editor and application surfaces.

Its role is to assist with:
- node configuration
- flow editing help
- frontend code snippets
- model explanation
- state design suggestions

It should always operate within the current application context rather than as a detached general-purpose chat window.

## 10. P1 Included Capabilities

P1 should include:
- team workspace model
- role and permission control
- workflow canvas editing
- multiple LLM nodes in one flow
- tool call pause and resume
- callback recovery
- checkpoint persistence
- standard Agent-oriented publish endpoints
- basic state model management
- CRUD generation for state models
- basic admin and query views
- internal provider plugins
- internal node plugins
- application logs and monitoring

## 11. P1 Explicit Non-Goals

P1 should explicitly avoid:
- chat-first product positioning
- complex visual page-builder capability
- complete enterprise tenancy and org governance
- personal workspace support
- full plugin marketplace capability
- general-purpose low-code platform positioning
- replacing external business databases as a central product claim

## 12. Success Criteria

P1 is successful if:

- a team can create and manage applications in a team workspace
- users can build multi-node flows with multiple LLM nodes and supporting nodes
- flows can be published through a unified internal protocol plus external adapter layer
- external clients can reliably invoke published flows
- runtime handles tool call pause, callback, resume, and checkpoint recovery correctly
- logs clearly expose conversation content, tool calls, and node-level execution details
- monitoring shows users the cost and health metrics they care about
- structured state supports cross-session memory and context continuity
- permissions reliably control access to flows, data, routes, and external integrations

## 13. One-Line Product Acceptance Standard

1Flowse P1 succeeds when a team can build an AI Flow, publish it as a stable external Agent-facing capability, run it with durable state and callback-aware execution, and inspect or control the whole lifecycle with clear logs, metrics, and permissions.

# Runtime Event Stream 与调试流首 token 加速设计

日期：2026-05-02

状态：待用户审阅

取代文档：无

关联文档：
- [Agent Flow Debug Console 设计稿](./2026-04-25-agent-flow-debug-console-design.md)
- [Agent Runtime、Capability Runtime 与可观测中转架构设计稿](./2026-04-27-agent-runtime-capability-observability-design.md)
- [Storage Ephemeral 与 Moka Local Provider 设计](./2026-04-29-storage-ephemeral-moka-provider-design.md)
- [HostExtension 内核级插件边界设计](./2026-04-28-host-extension-boundary-design.md)

## 1. 文档目标

本文用于固定 1flowbase 调试流首 token 加速的运行时设计，核心目标是：

1. 缩短 `Agent Flow Debug Console` 发起整流调试后到首个 assistant token 的可见时间。
2. 把实时输出、节点状态、trace 事件和持久化写入从同步链路中解耦。
3. 引入宿主拥有的 `RuntimeEventStream` 能力边界，默认本机实现不依赖 Redis、NATS、Kafka 等外部中间件。
4. 为后续外部缓存类 HostExtension provider 留出同一合同，例如 Redis Streams provider。
5. 保持调试态实时优先，同时不破坏 run、node、span、usage、billing 和 audit 的最终可追溯性。

本文不是实现计划；实现前需要拆成分阶段 plan。

## 2. 背景与问题

### 2.1 现有 1flowbase 调试流链路

当前 `/applications/:id/orchestration/debug-runs/stream` 在返回 SSE 前先等待 `start_flow_debug_run` 完成。这个阶段会同步执行：

1. 读取 actor、application、editor state。
2. 构建 compile context。
3. 编译 orchestration document。
4. 冻结 failover route。
5. upsert compiled plan。
6. 创建 flow run。
7. 写 run event。
8. 写 gateway billing audit、cost ledger、credit ledger 和 audit hash。
9. 再读取 run detail。

SSE 建立后，后端再启动 `continue_flow_debug_run_with_live_provider_events`。节点状态主要通过 DB detail polling 补给 SSE，provider live delta 通过 live provider channel 推给 SSE。

这导致首 token 前存在两类阻塞：

1. HTTP stream 打开前的同步初始化和持久化写。
2. provider 调用前的实例解析、installation reconcile、package load、runtime config 构造和 stdio 子进程启动。

### 2.2 Dify 对照结论

Dify 预览路径的关键特点是：

1. API 层较快返回 `text/event-stream`。
2. stream 订阅建立后先发送 ping，避免浏览器请求悬挂。
3. 实际 workflow/chat 执行通过后台任务和 pubsub/stream 解耦。
4. 模型 chunk 进入队列后被转换成 stream response，直接推给前端。

对 1flowbase 的启发不是照搬 Dify 的 Celery/Redis，而是吸收它的链路形态：

```text
先打开实时通道
再后台执行
执行事件先进实时事件流
SSE 和持久化分别消费
```

### 2.3 设计约束

1. 单机默认不能强依赖外部缓存。
2. Core 业务不能直接依赖 Redis、NATS、Kafka 或具体连接字符串。
3. 外部缓存类能力必须通过 HostExtension provider 实现宿主合同。
4. 调试预览可以接受短暂最终一致；billing、credit、audit 的最终记录不能只依赖易失 buffer。
5. 不能把普通 KV cache 当作 token delta 的有序事件日志。

## 3. 结论摘要

1. 不新增 `GenericCache` 作为本设计主抽象。
2. 新增宿主能力合同 `RuntimeEventStream`，表示按 run 维度组织的短期有序运行事件流。
3. 默认实现为 `LocalRuntimeEventStream`，使用进程内 broadcast + ring buffer，不依赖外部中间件。
4. 后续 Redis Streams、NATS JetStream、Kafka 等只能作为 HostExtension provider 实现同一合同。
5. SSE、AsyncDebugRunPersister、Metrics/Tracing 都作为 `RuntimeEventStream` 消费者。
6. 调试流 route 改为 fast-start：认证通过后尽快返回 SSE，并发送 `flow_accepted` 或 `ping`。
7. `start_flow_debug_run` 拆成轻量 run shell 创建和后台 heavy start 两段。
8. live delta 先 append 到 `RuntimeEventStream`，SSE 立即推送；DB 持久化由异步消费者批量落库。
9. node status 不再依赖 100ms DB polling 作为实时来源，改由 runtime 直接 append `node_started/node_finished/node_failed`。
10. provider 热路径需要独立瘦身，包括 package reload、artifact hash、secret/config load 和 stdio process spawn。

## 4. 范围与非目标

### 4.1 本阶段范围

1. 调试流首 token 分段打点。
2. 调试流 SSE fast-start。
3. `RuntimeEventStream` host contract。
4. `LocalRuntimeEventStream` 默认实现。
5. SSE subscriber 从 event stream 消费。
6. Async persister 从 event stream 异步持久化 run/node/span/debug events。
7. runtime 节点事件直接 append event stream。
8. 前端按 event type 分离 message delta、trace、variable cache 更新。
9. provider 热路径的可观测打点和第一批缓存策略。

### 4.2 后续阶段范围

1. Redis Streams HostExtension provider。
2. 多 API server 实例下的跨进程 replay 和 subscriber。
3. 断线重连从指定 sequence 恢复。
4. provider 长驻 worker pool 或 in-process official provider runtime。
5. 发布态 run 的强一致运行事件策略。

### 4.3 非目标

1. 不在本阶段引入 Core 直连 Redis。
2. 不把 `RuntimeEventStream` 做成通用业务事件总线。
3. 不替换 PostgreSQL durable truth。
4. 不把 billing、credit、audit 的最终一致性降级为“可丢”。
5. 不在第一阶段重写整个 orchestration runtime。
6. 不把前端协议切换成 Dify 协议。

## 5. 核心概念

### 5.1 RuntimeEventStream

`RuntimeEventStream` 是宿主拥有的短期运行事件流能力。它负责在一次 run 生命周期内保存有序事件，并向实时消费者和异步持久化消费者分发。

它不是普通 cache：

1. cache 关注 key/value 的当前值。
2. event stream 关注同一 run 内按 sequence 排列的增量事件。
3. token delta、node lifecycle、trace item、usage snapshot 都是事件，不是单个最终值。

### 5.2 RuntimeEventEnvelope

所有进入 stream 的事件统一包裹为 envelope。

```text
RuntimeEventEnvelope
  run_id
  sequence
  event_id
  event_type
  occurred_at
  source
  durability
  persist_required
  trace_visible
  payload
```

字段规则：

1. `run_id` 标识一次 debug run 或 published run。
2. `sequence` 在单个 run 内单调递增，由 stream 实现分配。
3. `event_id` 可由 `run_id + sequence` 派生，也可以是独立 uuid。
4. `event_type` 使用稳定枚举。
5. `occurred_at` 是事件产生时间，不是持久化时间。
6. `source` 区分 `runtime`、`provider`、`persister`、`system`。
7. `durability` 区分 `ephemeral`、`durable_required`、`audit_required`。
8. `persist_required` 表示 persister 必须尝试落库。
9. `trace_visible` 表示前端 trace 是否展示。
10. `payload` 必须是结构化 JSON；大对象只放引用。

### 5.3 事件类型

第一阶段固定以下事件类型：

```text
flow_accepted
flow_started
flow_failed
flow_finished
flow_cancelled
node_started
node_delta
node_finished
node_failed
text_delta
usage_snapshot
provider_attempt_started
provider_attempt_failed
provider_attempt_finished
persist_warning
heartbeat
```

约束：

1. `text_delta` 只表示 assistant 可见文本增量。
2. `usage_snapshot` 可以多次出现，最终 usage 由最后一个完整 snapshot 或 flow finished 汇总决定。
3. `node_delta` 只用于节点内部阶段更新，不替代 `node_started/node_finished`。
4. `persist_warning` 不直接失败用户调试流，但需要进入诊断和日志。
5. `heartbeat` 用于保持 SSE 连接，不进入默认持久化。

## 6. 目标架构

### 6.1 总体链路

```text
Debug Stream HTTP Route
  -> auth / csrf / permission
  -> create or reserve debug run shell
  -> open SSE immediately
  -> spawn background debug execution

Background Debug Execution
  -> compile / freeze route / prepare runtime
  -> append runtime events
  -> invoke provider
  -> append provider live deltas
  -> finish run

RuntimeEventStream
  -> SseSubscriber
  -> AsyncDebugRunPersister
  -> MetricsSubscriber
```

### 6.2 fast-start route

调试流 route 的目标行为：

1. 完成 session、csrf、application 权限校验。
2. 创建轻量 debug run shell，拿到 `run_id`。
3. 初始化 event stream run scope。
4. spawn 后台 execution task。
5. 立即返回 SSE。
6. SSE 建立后先发送 `flow_accepted` 和 `heartbeat`。

fast-start 预算：

1. fast-start 路径只允许做认证、权限、轻量 run shell、event stream 初始化和 spawn。
2. `request_received_at -> sse_opened_at` 必须单独打点。
3. 如果轻量 run shell 写入本身成为主要瓶颈，下一阶段允许先分配 run id 并打开 event stream，再由后台 task 补齐 durable shell；但第一阶段优先保留轻量 durable shell，降低状态补偿复杂度。

轻量 run shell 只做必要状态：

```text
flow_run
  id
  application_id
  workspace_id
  actor_id
  status = queued | starting
  mode = debug
  created_at
```

不在 fast-start 阶段做：

1. 完整 compile context 构建。
2. plan upsert。
3. billing audit 全量写入。
4. run detail 读取。
5. provider package reconcile。

### 6.3 后台 execution task

后台 task 负责重型工作：

1. append `flow_started`。
2. 构建 compile context。
3. 编译并冻结 route。
4. upsert compiled plan。
5. 执行节点。
6. 每个节点生命周期直接 append event。
7. provider live event 进入同一个 stream。
8. 完成后 append `flow_finished` 或 `flow_failed`。
9. 由 persister 最终更新 durable run 状态。

失败规则：

1. compile 失败：append `flow_failed`，SSE 可见，persister 写 run failed。
2. provider prepare 失败：append `node_failed` 和 `flow_failed`。
3. persister 失败：append `persist_warning`，不阻断 SSE，但后台记录 error。
4. event stream append 失败：该 run 进入 fail-fast，因为 SSE 和 persister 都依赖它。

## 7. RuntimeEventStream 合同

### 7.1 trait 形态

第一版合同应表达事件流能力，而不是缓存能力。

```rust
#[async_trait]
pub trait RuntimeEventStream: Send + Sync {
    async fn open_run(&self, run_id: FlowRunId, policy: RuntimeEventStreamPolicy) -> anyhow::Result<()>;

    async fn append(
        &self,
        run_id: FlowRunId,
        event: RuntimeEventPayload,
    ) -> anyhow::Result<RuntimeEventEnvelope>;

    async fn subscribe(
        &self,
        run_id: FlowRunId,
        from_sequence: Option<i64>,
    ) -> anyhow::Result<RuntimeEventSubscription>;

    async fn replay(
        &self,
        run_id: FlowRunId,
        from_sequence: Option<i64>,
        limit: usize,
    ) -> anyhow::Result<Vec<RuntimeEventEnvelope>>;

    async fn close_run(&self, run_id: FlowRunId, reason: RuntimeEventCloseReason) -> anyhow::Result<()>;

    async fn trim(&self, run_id: FlowRunId, policy: RuntimeEventTrimPolicy) -> anyhow::Result<()>;
}
```

`RuntimeEventSubscription` 表示异步事件流。实现层可以用 tokio broadcast、mpsc、Redis Streams consumer 或其他机制。

### 7.2 stream policy

```text
RuntimeEventStreamPolicy
  ttl
  max_events
  max_bytes
  overflow_behavior
```

第一阶段默认策略：

```text
ttl = 30 minutes
max_events = 20_000 per run
max_bytes = 16 MiB per run
overflow_behavior = drop_old_ephemeral_keep_required
```

overflow 规则：

1. `heartbeat` 可被丢弃。
2. 旧的 `text_delta` 只有在 persister 已确认 checkpoint，或最终 assistant output snapshot 已覆盖后，才允许被 trim 或合并。
3. `flow_started`、`node_started`、`node_finished`、`flow_finished` 不应被丢弃。
4. `audit_required` 事件不得只存在于可丢 ring 中，必须交给 persister 或 durable fallback。

### 7.3 sequence 规则

1. sequence 从 1 开始。
2. 同 run 内 append 必须串行分配 sequence。
3. SSE、persister、metrics 都以 sequence 做幂等游标。
4. persister 落库时记录 `last_persisted_sequence`。
5. 断线重连时从 `last_event_id` 或 query 参数恢复。

第一阶段可以只支持同进程从 ring replay；第二阶段外部 provider 支持跨进程 replay。

## 8. LocalRuntimeEventStream

### 8.1 目标

本地默认实现满足：

1. 无外部依赖。
2. 单 API server 内低延迟。
3. 支持当前 SSE subscriber 和 async persister 双消费者。
4. 支持短时间 replay。
5. 进程退出后可丢，不承载平台真值。

### 8.2 实现形态

建议实现：

```text
LocalRuntimeEventStream
  runs: DashMap<FlowRunId, LocalRunEventStream>

LocalRunEventStream
  next_sequence: AtomicI64
  ring: Mutex<VecDeque<RuntimeEventEnvelope>>
  broadcaster: tokio::sync::broadcast::Sender<RuntimeEventEnvelope>
  policy
  closed_state
```

append 顺序：

1. 分配 sequence。
2. 构造 envelope。
3. 写入 ring。
4. broadcast 给订阅者。
5. 返回 envelope。

订阅顺序：

1. 先从 ring replay `from_sequence` 之后的事件。
2. 再接 broadcast live stream。
3. 如果 `from_sequence` 已被 trim，返回明确错误 `RuntimeEventReplayExpired`，前端应提示重新运行或走 durable detail。

### 8.3 生命周期

1. `open_run` 创建 run scope。
2. `close_run` 标记关闭，但保留 ring 到 ttl。
3. 后台 cleanup task 定期 trim 过期 run。
4. 如果 execution task 异常退出，supervisor append `flow_failed` 或 close reason。

## 9. 外部 RuntimeEventStream Provider

### 9.1 HostExtension 边界

Redis Streams 等实现不进入 Core。它们作为 HostExtension provider 注册：

```text
HostInfrastructureRegistry
  runtime_event_stream = local
  runtime_event_stream = redis-streams
```

业务和 runtime 代码只依赖 `RuntimeEventStream`。

禁止：

1. route/service 直接读取 Redis URL。
2. orchestration runtime 直接引用 Redis crate。
3. provider 插件直接写 Core 真值表。
4. RuntimeExtension 自己持有基础设施连接并绕过宿主合同。

### 9.2 Redis Streams provider 预期映射

后续 Redis provider 可映射为：

```text
stream key = runtime:events:{run_id}
entry id = redis stream id
sequence = envelope sequence
payload = envelope json
consumer group = sse | persister | metrics
trim = XTRIM MAXLEN / TTL policy
```

Redis provider 必须保证：

1. 同 run sequence 单调。
2. append 后可被 replay。
3. subscriber 支持从 sequence 恢复。
4. provider 失败时返回宿主错误，不吞事件。

Redis provider 不改变业务语义，只改变 delivery 能力。

## 10. 持久化策略

### 10.1 AsyncDebugRunPersister

persister 是 event stream 的消费者，不是 runtime 主路径的一部分。

职责：

1. 消费 `persist_required = true` 的事件。
2. 按 run_id 和 sequence 幂等写入。
3. 批量合并 text delta，避免逐 token 写 DB。
4. 更新 flow_run、node_run、runtime_span、run_event、usage、diagnostic。
5. 记录 `last_persisted_sequence`。
6. 持久化失败时 append `persist_warning` 并重试。

### 10.2 text delta 合并

为了避免 DB 写放大：

1. SSE 逐 delta 或小批量发送。
2. persister 以 30-100ms 或 max bytes 合并 text delta。
3. durable message 保存合并后的 assistant content segment。
4. 最终 `flow_finished` 时写完整 assistant output snapshot。

### 10.3 audit 与 billing

audit/billing 不能完全依赖易失 ring。推荐规则：

1. debug run 的 billing/audit reservation 可以从首 token 前移出，改为后台执行。
2. 关键 billing/audit final record 必须有 durable write confirmation。
3. 如果 persister 多次失败，run 标记 `persist_degraded`，并在管理日志中可见。
4. 发布态 run 可以选择更严格策略：关键 audit event durable write 完成后再继续某些状态流转。

## 11. SSE 协议

### 11.1 event id

SSE 每条消息使用 sequence 作为 event id：

```text
id: <sequence>
event: runtime_event
data: <RuntimeEventEnvelope JSON>
```

前端可用 `Last-Event-ID` 或 query `from_sequence` 恢复。

第一阶段如果只支持同进程恢复，恢复失败返回 `replay_expired` 事件，提示用户查看 durable run detail 或重新运行。

### 11.2 初始事件

SSE 打开后必须尽快发送：

```text
flow_accepted
heartbeat
```

`flow_accepted` 表示后端已接受运行，不表示 compile 或 provider 已成功。

### 11.3 错误事件

错误通过事件表达，不依赖 HTTP 长连接异常：

```text
flow_failed
node_failed
provider_attempt_failed
persist_warning
replay_expired
```

HTTP 连接异常只表示 transport 失败。

## 12. 前端消费模型

### 12.1 状态拆分

前端 Debug Console 应按事件类型拆分更新：

1. `text_delta` 只更新 assistant message buffer。
2. `node_started/node_finished/node_failed` 更新 trace tree 和节点状态。
3. `usage_snapshot` 更新 usage 面板。
4. `flow_failed/flow_finished` 更新 run 状态和操作按钮。
5. variable cache 只在节点完成或 flow 完成时更新。

### 12.2 delta batching

前端对 `text_delta` 应做渲染节流：

1. token delta 进入内存 buffer。
2. 每个 animation frame 或 50ms flush 一次 React state。
3. 长文本使用 buffer ref 拼接，避免每个 token 都触发完整 trace/variable rebuild。

### 12.3 Trace 与画布联动

trace item 不再等 DB polling：

1. `node_started` 时画布节点进入 running。
2. `node_finished` 时画布节点进入 succeeded。
3. `node_failed` 时画布节点进入 failed。
4. run 结束后刷新 durable last run，确保历史详情与实时显示收敛。

## 13. Provider 热路径优化

RuntimeEventStream 解决的是“实时通道”和“持久化解耦”；首 token 仍会受 provider 热路径影响，因此需要同步规划 provider 优化。

### 13.1 第一阶段打点

增加 provider 分段指标：

```text
provider_resolve_started
provider_resolve_finished
installation_reconcile_started
installation_reconcile_finished
package_load_started
package_load_finished
runtime_config_started
runtime_config_finished
process_spawn_started
process_spawn_finished
upstream_request_sent
first_provider_delta
```

### 13.2 第一阶段缓存

允许缓存：

1. provider package metadata。
2. manifest fingerprint。
3. installation snapshot。
4. enabled model validation result。
5. provider runtime config 中非 secret 派生结构。

缓存失效来源：

1. provider installation 变更。
2. provider instance config 变更。
3. secret version 变更。
4. model assignment 变更。
5. system runtime profile 变更。

### 13.3 后续长驻 runtime

stdio 子进程每次 invoke 都启动会拖慢首 token。后续建议：

1. 官方 provider 支持长驻 worker pool。
2. worker 启动后复用 HTTP client、TLS、DNS、模型目录缓存。
3. worker 通过 NDJSON 或 framed protocol 支持多次 invoke。
4. worker 崩溃由宿主重启，不影响 Core 合同。

## 14. 观测指标与验收证据

### 14.1 首 token 指标

每次 debug stream 至少记录：

```text
request_received_at
sse_opened_at
flow_accepted_sent_at
compile_started_at
compile_finished_at
provider_prepare_started_at
upstream_request_sent_at
first_provider_delta_at
first_sse_delta_sent_at
flow_finished_at
```

派生指标：

```text
http_to_sse_open_ms
sse_open_to_flow_started_ms
compile_ms
provider_prepare_ms
upstream_first_delta_ms
provider_delta_to_sse_ms
request_to_first_sse_delta_ms
```

### 14.2 目标验收

第一阶段验收不承诺具体毫秒值，先承诺可观测和链路变化：

1. SSE response 不再等待完整 `start_flow_debug_run`。
2. 用户能在后台 compile/provider 准备期间收到 `flow_accepted` 或 heartbeat。
3. 第一条 provider text delta append 后，应在同一事件循环周期内被 SSE subscriber 消费。
4. node started/finished 不依赖 DB polling 才能显示。
5. persister 失败不会阻断 SSE token 输出。
6. run 完成后 durable detail 与实时显示最终收敛。
7. metrics 能明确区分 compile、provider prepare、upstream first delta、SSE send 的耗时。

## 15. 测试策略

### 15.1 单元测试

1. `LocalRuntimeEventStream` append 后 sequence 单调递增。
2. subscribe from sequence 能先 replay ring，再接 live event。
3. trim 后 replay 过期返回明确错误。
4. overflow 时保留 required lifecycle event。
5. close run 后不再接受普通 append，允许 idempotent close。

### 15.2 集成测试

1. debug stream route 在 heavy compile mock 阻塞时仍能先返回 `flow_accepted`。
2. provider mock 发出 text delta 后，SSE 收到 `text_delta` 早于 DB persister 完成。
3. persister mock 失败时，SSE 仍继续输出，且产生 `persist_warning`。
4. node lifecycle event 不依赖 DB polling。
5. run finished 后 durable read model 可查到最终节点状态和 assistant output。

### 15.3 前端测试

1. `text_delta` 只更新 assistant message。
2. trace event 更新节点状态。
3. variable cache 不在每个 text delta 重建。
4. SSE `replay_expired` 显示可理解错误状态。
5. 长输出不会造成明显输入框、trace 面板卡顿。

### 15.4 QA 验收

进入验收阶段时使用 `qa-evaluation`，输出至少包含：

1. 首 token 分段数据。
2. fast-start 行为截图或日志。
3. SSE 与 DB persister 顺序证据。
4. provider prepare 热点数据。
5. 前端长输出渲染表现。

warning 与 coverage 产物统一落到 `tmp/test-governance/`。

## 16. 风险与停止条件

### 16.1 风险

1. 进程内 ring 在进程崩溃时会丢失未落库事件。
2. 异步 persister 需要幂等，否则重试会重复写 run event。
3. fast-start 后 compile 失败会让用户先看到 accepted 再看到 failed，需要前端状态表达清楚。
4. 多实例环境使用 local stream 会导致重连无法跨实例恢复。
5. provider 子进程启动仍可能成为首 token 主瓶颈。

### 16.2 停止条件

如果出现以下情况，应暂停继续扩大改动：

1. 无法证明 SSE 已经从 DB polling 链路解耦。
2. persister 失败会导致 run 永久卡在 running 且无诊断事件。
3. billing/audit final record 存在静默丢失。
4. local stream 被误用为 durable truth。
5. Core 代码开始直接依赖 Redis 或其他外部缓存实现。

## 17. 分阶段落地建议

### Phase 0：测量

1. 加首 token 分段指标。
2. 加 provider prepare 分段指标。
3. 在当前链路输出一次基线。

### Phase 1：本机 event stream 与 fast-start

1. 定义 `RuntimeEventStream` 合同。
2. 实现 `LocalRuntimeEventStream`。
3. 调试流 route 改为 fast-start。
4. SSE 从 event stream 消费。
5. runtime 节点生命周期直接 append event。
6. persister 从 event stream 异步落库。

### Phase 2：前端与持久化收敛

1. 前端 text delta batching。
2. trace 与 variable 更新拆分。
3. persister 幂等和批量 text delta 合并。
4. run finished 后 durable read model 收敛校验。

### Phase 3：provider 热路径

1. provider package 和 manifest 缓存。
2. installation reconcile 从每次 invoke 热路径移出。
3. provider config/secret 派生缓存。
4. 评估长驻 provider worker pool。

### Phase 4：外部 provider

1. 定义 RuntimeEventStream HostExtension provider manifest。
2. 实现 Redis Streams provider。
3. 支持跨进程 replay 和 consumer group。
4. 增加多实例部署文档和 QA 场景。

## 18. 最终边界结论

本设计的核心边界是：

```text
RuntimeEventStream 是运行时有序事件流能力，不是通用缓存。
LocalRuntimeEventStream 是默认单机实现，不是 durable truth。
Redis Streams 等外部实现只能通过 HostExtension provider 接入。
SSE 负责实时可见，AsyncDebugRunPersister 负责最终记录，PostgreSQL 仍是 durable truth。
```

这个设计能同时满足：

1. 本地开发不增加外部依赖。
2. 调试预览首 token 更快。
3. 运行事件顺序清晰。
4. DB 不再作为实时流中转层。
5. 未来多实例和断线重连有稳定扩展口。

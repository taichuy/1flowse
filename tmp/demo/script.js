const views = ["overview", "orchestration", "api", "logs", "monitoring"];

const runs = [
  {
    id: "run_2041",
    title: "Revenue intake pipeline",
    subtitle: "Published contract v0.8.14",
    status: "healthy",
    statusLabel: "Healthy",
    runtime: "02m 14s",
    contract: "OpenAI compatible",
    currentNode: "Reply composer",
    startedAt: "2026-04-12 10:18",
    reason:
      "Published contract 正常返回，风险评分和 callback 决策都已写入 outputs。",
    recovery:
      "无需恢复。若要复盘，可在日志页继续查看 event trail。",
  },
  {
    id: "run_2042",
    title: "Manual approval review",
    subtitle: "Callback paused for finance sign-off",
    status: "waiting",
    statusLabel: "Waiting callback",
    runtime: "callback",
    contract: "Claude compatible",
    currentNode: "Checkpoint write",
    startedAt: "2026-04-12 09:52",
    reason:
      "应用已停在等待态，checkpoint 和恢复入口都保持可见，没有发生隐式 side effect。",
    recovery:
      "外部批准完成后，从同一 checkpoint 恢复；恢复动作不会回写已发布版本。",
  },
  {
    id: "run_2043",
    title: "CRM enrichment retry",
    subtitle: "Latest failure sample retained",
    status: "failed",
    statusLabel: "Failed",
    runtime: "08s",
    contract: "Native invoke",
    currentNode: "CRM lookup",
    startedAt: "2026-04-12 08:31",
    reason:
      "CRM adapter 在 enrichment 步骤超时，失败样本已保留给日志与监控页共同复盘。",
    recovery:
      "先修复 adapter，再从 draft 重新发布；失败日志本身不会偷偷改变 live contract。",
  },
];

const nodes = [
  {
    id: "trigger",
    kind: "Trigger",
    title: "Email intake",
    summary: "接收销售来信，提取发件人、询问主题和账号标识。",
    status: "healthy",
    statusLabel: "Healthy",
    input: "Flat request object",
    output: "Intent + account selectors",
    role: "接收请求并完成首轮归一化。",
    change: "已补齐 callback snapshot 字段。",
    description: "保持入口轻量，确保下游节点拿到稳定输入。",
    position: { left: 28, top: 92 },
    ports: ["right"],
  },
  {
    id: "llm",
    kind: "LLM",
    title: "Risk classifier",
    summary: "推断风险等级、是否需要工具调用，以及是否进入人工审批。",
    status: "running",
    statusLabel: "Running",
    input: "Selectors + prompt template",
    output: "riskScore + category + needsTool",
    role: "在统一 prompt 约束下给出风险判断。",
    change: "新增了对 callback 必要性的显式输出。",
    description: "当前 draft 正在收敛回复模板和分类阈值。",
    position: { left: 320, top: 92 },
    ports: ["left", "right"],
  },
  {
    id: "tool",
    kind: "Tool",
    title: "CRM lookup",
    summary: "读取账户健康快照，为回复策略补充最新业务上下文。",
    status: "healthy",
    statusLabel: "Healthy",
    input: "Account selector",
    output: "Account health snapshot",
    role: "把宿主层工具输出映射到稳定的 flow 变量。",
    change: "失败样本已转入日志与监控联动观察。",
    description: "工具节点的状态只表达运行真相，不承担选择态语义。",
    position: { left: 664, top: 92 },
    ports: ["left"],
  },
  {
    id: "state",
    kind: "State",
    title: "Checkpoint write",
    summary: "在等待人工审批前写入 checkpoint，保留恢复所需的上下文。",
    status: "waiting",
    statusLabel: "Waiting callback",
    input: "Current node snapshot",
    output: "Checkpoint metadata",
    role: "把等待态恢复路径保持为显式系统行为。",
    change: "恢复来源已写入日志抽屉与监控摘要。",
    description: "等待态不是失败，也不借用 selected 的视觉语法。",
    position: { left: 640, top: 232 },
    ports: ["left"],
  },
];

const connectors = [
  "M178 132 C 232 132, 260 132, 320 132",
  "M504 132 C 566 132, 590 132, 664 132",
  "M432 188 C 500 220, 540 250, 640 272",
];

const viewButtons = document.querySelectorAll("[data-view-trigger]");
const viewPanels = document.querySelectorAll("[data-view-panel]");
const appShell = document.querySelector(".app-shell");
const runList = document.getElementById("runList");
const connectorLayer = document.getElementById("connectorLayer");
const canvasNodes = document.getElementById("canvasNodes");
const mobileNodeList = document.getElementById("mobileNodeList");

const inspectorTitle = document.getElementById("inspectorTitle");
const inspectorSummary = document.getElementById("inspectorSummary");
const inspectorKind = document.getElementById("inspectorKind");
const inspectorStatus = document.getElementById("inspectorStatus");
const inspectorInput = document.getElementById("inspectorInput");
const inspectorOutput = document.getElementById("inspectorOutput");
const inspectorRole = document.getElementById("inspectorRole");
const inspectorChange = document.getElementById("inspectorChange");

const drawer = document.getElementById("runDetailDrawer");
const drawerBackdrop = document.querySelector(".drawer-backdrop");
const drawerCloseButton = document.getElementById("drawerClose");
const drawerTitle = document.getElementById("drawerTitle");
const drawerStatus = document.getElementById("drawerStatus");
const drawerReference = document.getElementById("drawerReference");
const drawerRuntime = document.getElementById("drawerRuntime");
const drawerContract = document.getElementById("drawerContract");
const drawerNode = document.getElementById("drawerNode");
const drawerStartedAt = document.getElementById("drawerStartedAt");
const drawerReason = document.getElementById("drawerReason");
const drawerRecovery = document.getElementById("drawerRecovery");

const focusableSelector =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let activeView = "overview";
let activeNodeId = nodes[0].id;
let lastDrawerTrigger = null;

function statusClass(status) {
  return `is-${status}`;
}

function createStatusBadge(status, label) {
  const badge = document.createElement("span");
  badge.className = `status-badge ${statusClass(status)}`;
  badge.textContent = label;
  return badge;
}

function renderRuns() {
  runs.forEach((run) => {
    const button = document.createElement("button");
    button.className = "run-item";
    button.type = "button";
    button.dataset.runTrigger = run.id;

    const main = document.createElement("span");
    main.className = "run-main";

    const text = document.createElement("span");
    text.className = "run-text";
    text.innerHTML = `
      <strong>${run.title}</strong>
      <small>#${run.id} · ${run.subtitle}</small>
    `;

    main.appendChild(createStatusBadge(run.status, run.statusLabel));
    main.appendChild(text);

    const side = document.createElement("span");
    side.className = "run-side";
    side.appendChild(createStatusBadge(run.status, run.statusLabel));

    const runtime = document.createElement("span");
    runtime.className = "run-time";
    runtime.textContent = run.runtime;
    side.appendChild(runtime);

    button.appendChild(main);
    button.appendChild(side);
    button.addEventListener("click", () => openDrawer(run.id, button));
    runList.appendChild(button);
  });
}

function renderConnectors() {
  connectors.forEach((pathData) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("pathLength", "100");
    connectorLayer.appendChild(path);
  });
}

function buildNodeButton(node, className) {
  const button = document.createElement("button");
  button.className = className;
  button.type = "button";
  button.dataset.node = node.id;

  if (className === "node-card") {
    button.style.left = `${node.position.left}px`;
    button.style.top = `${node.position.top}px`;
  }

  const metaRow = document.createElement("span");
  metaRow.className = "node-meta-row";

  const kind = document.createElement("span");
  kind.className = "kind-badge";
  kind.textContent = node.kind;

  const status = createStatusBadge(node.status, node.statusLabel);
  metaRow.appendChild(kind);
  metaRow.appendChild(status);

  const title = document.createElement("strong");
  title.textContent = node.title;

  const copy = document.createElement("small");
  copy.textContent = node.description;

  button.appendChild(metaRow);
  button.appendChild(title);
  button.appendChild(copy);

  if (className === "node-card") {
    node.ports.forEach((port) => {
      const portDot = document.createElement("span");
      portDot.className = `node-port node-port-${port}`;
      button.appendChild(portDot);
    });
  }

  button.addEventListener("click", () => setActiveNode(node.id));
  return button;
}

function renderNodes() {
  nodes.forEach((node) => {
    canvasNodes.appendChild(buildNodeButton(node, "node-card"));
    mobileNodeList.appendChild(buildNodeButton(node, "mobile-node-item"));
  });
}

function setActiveNode(nodeId) {
  const detail = nodes.find((node) => node.id === nodeId);

  if (!detail) {
    return;
  }

  activeNodeId = nodeId;

  document.querySelectorAll("[data-node]").forEach((element) => {
    element.classList.toggle("is-selected", element.dataset.node === nodeId);
  });

  inspectorTitle.textContent = detail.title;
  inspectorSummary.textContent = detail.summary;
  inspectorKind.textContent = detail.kind;
  inspectorStatus.className = `status-badge ${statusClass(detail.status)}`;
  inspectorStatus.textContent = detail.statusLabel;
  inspectorInput.textContent = detail.input;
  inspectorOutput.textContent = detail.output;
  inspectorRole.textContent = detail.role;
  inspectorChange.textContent = detail.change;
}

function setView(nextView) {
  if (!views.includes(nextView)) {
    return;
  }

  activeView = nextView;
  closeDrawer(false);

  viewPanels.forEach((panel) => {
    panel.hidden = panel.dataset.viewPanel !== nextView;
  });

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.viewTrigger === nextView),
    );
  });
}

function openDrawer(runId, trigger) {
  const detail = runs.find((run) => run.id === runId);

  if (!detail) {
    return;
  }

  lastDrawerTrigger = trigger;
  drawerTitle.textContent = detail.title;
  drawerReference.textContent = `#${detail.id}`;
  drawerRuntime.textContent = detail.runtime;
  drawerContract.textContent = detail.contract;
  drawerNode.textContent = detail.currentNode;
  drawerStartedAt.textContent = detail.startedAt;
  drawerReason.textContent = detail.reason;
  drawerRecovery.textContent = detail.recovery;
  drawerStatus.className = `status-badge ${statusClass(detail.status)}`;
  drawerStatus.textContent = detail.statusLabel;

  drawer.hidden = false;
  drawerBackdrop.hidden = false;
  drawer.setAttribute("aria-hidden", "false");
  appShell.setAttribute("inert", "");
  document.body.classList.add("is-drawer-open");

  requestAnimationFrame(() => {
    drawerCloseButton.focus();
  });
}

function closeDrawer(restoreFocus = true) {
  if (drawer.hidden) {
    return;
  }

  drawer.hidden = true;
  drawerBackdrop.hidden = true;
  drawer.setAttribute("aria-hidden", "true");
  appShell.removeAttribute("inert");
  document.body.classList.remove("is-drawer-open");

  if (restoreFocus && lastDrawerTrigger) {
    lastDrawerTrigger.focus();
  }
}

function trapDrawerFocus(event) {
  if (drawer.hidden || event.key !== "Tab") {
    return;
  }

  const focusable = drawer.querySelectorAll(focusableSelector);

  if (!focusable.length) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

viewButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.viewTrigger));
});

document.querySelectorAll("[data-drawer-close]").forEach((button) => {
  button.addEventListener("click", () => closeDrawer());
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !drawer.hidden) {
    event.preventDefault();
    closeDrawer();
    return;
  }

  trapDrawerFocus(event);
});

renderRuns();
renderConnectors();
renderNodes();
setActiveNode(activeNodeId);
setView(activeView);

#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "[1flowbase-exec-with-real-node] 缺少 Node 脚本入口" >&2
  exit 1
fi

pnpm_binary="$(command -v pnpm || true)"
if [[ -n "${pnpm_binary}" ]]; then
  resolved_pnpm="$(readlink -f "${pnpm_binary}" 2>/dev/null || realpath "${pnpm_binary}" 2>/dev/null || printf '%s' "${pnpm_binary}")"
  candidate_node="$(dirname "${resolved_pnpm}")/node"
else
  candidate_node=""
fi

if [[ -x "${candidate_node}" ]]; then
  node_binary="${candidate_node}"
else
  node_binary="$(command -v node)"
fi

export PATH="$(dirname "${node_binary}")${PATH:+:${PATH}}"
export NODE="${node_binary}"
export npm_node_execpath="${node_binary}"
if [[ -n "${pnpm_binary}" ]]; then
  export npm_execpath="${resolved_pnpm}"
fi

exec "${node_binary}" "$@"

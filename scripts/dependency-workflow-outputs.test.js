const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { buildDriftStepOutputs } = require('./check-dependabot-drift.js');
const { buildIssueSyncStepOutputs } = require('./sync-github-security-drift-issue');
const { buildSubmissionStepOutputs } = require('./submit-dependency-snapshots');

const repoRoot = path.resolve(__dirname, '..');

function readWorkflow(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
}

function listWorkflowJobOutputKeys(workflowSource) {
  return [...workflowSource.matchAll(/^\s+([a-z0-9_]+): \$\{\{ steps\.[a-z0-9_]+\.outputs\.[^}]+ }}$/gm)]
    .map((match) => match[1])
    .sort();
}

test('GitHub Security Drift exposes every script step output at the job level', () => {
  const workflowSource = readWorkflow('.github/workflows/github-security-drift.yml');
  const outputKeys = listWorkflowJobOutputKeys(workflowSource);
  const expectedKeys = [
    'status',
    ...Object.keys(buildDriftStepOutputs({})),
    ...Object.keys(buildIssueSyncStepOutputs()),
  ].sort();

  assert.deepEqual(outputKeys, expectedKeys);
});

test('Dependency Graph Submission exposes every script step output at the job level', () => {
  const workflowSource = readWorkflow('.github/workflows/dependency-graph-submission.yml');
  const outputKeys = listWorkflowJobOutputKeys(workflowSource);
  const expectedKeys = ['status', ...Object.keys(buildSubmissionStepOutputs({}))].sort();

  assert.deepEqual(outputKeys, expectedKeys);
});

test('GitHub Security Drift keeps issue sync running after drift failures', () => {
  const workflowSource = readWorkflow('.github/workflows/github-security-drift.yml');

  assert.match(workflowSource, /issues:\s+write/);
  assert.match(workflowSource, /- name: Sync security drift tracking issue/);
  assert.match(workflowSource, /id: sync_issue/);
  assert.match(workflowSource, /if: always\(\) && hashFiles\('dependabot-drift\.json'\) != ''/);
  assert.match(workflowSource, /node scripts\/sync-github-security-drift-issue\.js\s+--report dependabot-drift\.json/);
  assert.match(workflowSource, /tracking_issue_url: \$\{\{ steps\.sync_issue\.outputs\.tracking_issue_url }}?/);
});

test('GitHub Security Drift only auto-relays rerun push submissions', () => {
  const workflowSource = readWorkflow('.github/workflows/github-security-drift.yml');

  assert.match(
    workflowSource,
    /if: \$\{\{ github\.event_name != 'workflow_run' \|\| \(github\.event\.workflow_run\.conclusion == 'success' && \(github\.event\.workflow_run\.event != 'push' \|\| github\.event\.workflow_run\.run_attempt > 1\)\) }}/,
  );
});

test('GitHub Security Drift keeps workflow_run relays pinned to the upstream branch and sha', () => {
  const workflowSource = readWorkflow('.github/workflows/github-security-drift.yml');

  assert.match(workflowSource, /ref: \$\{\{ github\.event\.workflow_run\.head_sha \|\| github\.sha }}/);
  assert.match(
    workflowSource,
    /--current-ref-name "\$\{\{ github\.event\.workflow_run\.head_branch \|\| github\.ref_name }}"/,
  );
});

test('GitHub Security Drift keeps workflow_run checkout and issue sync pinned to the submission branch facts', () => {
  const workflowSource = readWorkflow('.github/workflows/github-security-drift.yml');

  assert.match(
    workflowSource,
    /workflow_run:\s+workflows:\s+- Dependency Graph Submission\s+types:\s+- completed/s,
  );
  assert.match(workflowSource, /ref: \$\{\{ github\.event\.workflow_run\.head_sha \|\| github\.sha }}/);
  assert.match(
    workflowSource,
    /--current-ref-name "\$\{\{ github\.event\.workflow_run\.head_branch \|\| github\.ref_name }}"/,
  );
});

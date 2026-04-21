export function formatPluginAvailabilityStatus(status: string) {
  switch (status) {
    case 'available':
      return { color: 'green', label: '可用' };
    case 'pending_restart':
      return { color: 'gold', label: '待重启' };
    case 'load_failed':
      return { color: 'red', label: '加载失败' };
    case 'artifact_missing':
      return { color: 'red', label: '产物缺失' };
    case 'install_incomplete':
      return { color: 'orange', label: '安装不完整' };
    default:
      return { color: 'default', label: '已禁用' };
  }
}

export function formatDuration(seconds = 0) {
  if (!seconds) return '0 分钟'

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) return `${days} 天 ${hours} 小时`
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`
  return `${minutes} 分钟`
}

export function formatDateTime(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function statusTone(status) {
  const tones = {
    running: 'success',
    stopped: 'neutral',
    error: 'danger',
    installing: 'warning',
  }

  return tones[status] || 'neutral'
}

export function formatStatus(status) {
  const labels = {
    running: '运行中',
    stopped: '已停止',
    error: '异常',
    installing: '安装中',
  }

  return labels[status] || status || '-'
}

export function formatAction(action) {
  const labels = {
    install: '安装',
    start: '启动',
    stop: '停止',
    restart: '重启',
    uninstall: '卸载',
    upgrade: '升级',
    rollback: '回滚',
    'service.create': '创建服务',
    'config.update': '更新配置',
    'config.backup': '备份配置',
    'config.restore': '恢复配置',
    'version.upgrade': '版本升级',
    'version.rollback': '版本回滚',
    'logs.clear': '清理日志',
    status: '状态检查',
  }

  return labels[action] || action || '-'
}

export function formatServiceType(type) {
  const labels = {
    binary: '二进制',
    docker: 'Docker',
    systemd: 'Systemd',
    supervisor: 'Supervisor',
  }

  return labels[type] || type || '-'
}

export function formatLogMessage(message) {
  if (!message) return '-'
  const value = String(message)

  if (value.startsWith('operation ') && value.endsWith(' completed')) {
    const action = value.replace('operation ', '').replace(' completed', '')
    return `${formatAction(action)}操作已完成`
  }
  if (value === 'initial service inventory loaded') return '初始服务清单已加载'
  if (value === 'service config updated') return '服务配置已更新'
  if (value === 'service config backed up') return '服务配置已备份'
  if (value.startsWith('service config restored from ')) {
    return `服务配置已从 ${value.replace('service config restored from ', '')} 恢复`
  }
  if (value.startsWith('created from template ')) {
    return `已通过 ${value.replace('created from template ', '')} 模板创建`
  }
  if (value.startsWith('upgraded from ')) return value.replace('upgraded from ', '已从 ').replace(' to ', ' 升级到 ')
  if (value.startsWith('rolled back from ')) return value.replace('rolled back from ', '已从 ').replace(' to ', ' 回滚到 ')
  if (value.startsWith('cleared ') && value.endsWith(' log entries')) {
    return `已清理 ${value.replace('cleared ', '').replace(' log entries', '')} 条日志`
  }

  return value
}

export function createLogSocket(serviceId, onMessage) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const socket = new WebSocket(`${protocol}://${window.location.host}/ws/services/${serviceId}/logs`)

  socket.onmessage = (event) => {
    onMessage(JSON.parse(event.data))
  }

  return socket
}


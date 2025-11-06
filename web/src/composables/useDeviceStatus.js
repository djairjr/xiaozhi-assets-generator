import { ref, computed, onMounted, onUnmounted } from 'vue'

// global_shared_device_status
const deviceStatus = ref({
  isOnline: false,
  error: '',
  lastCheck: null
})

const deviceInfo = ref({
  chip: null,
  board: null,
  firmware: null,
  flash: null,
  assetsPartition: null,
  network: null,
  screen: null
})

const token = ref('')
const isChecking = ref(false)
const retryTimer = ref(null)

// get_url_parameters
const getUrlParameter = (name) => {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get(name)
}

// call_mcp_tool
const callMcpTool = async (toolName, params = {}) => {
  if (!token.value) {
    throw new Error('Authentication token not found')
  }

  const response = await fetch('/api/messaging/device/tools/call', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token.value}`
    },
    body: JSON.stringify({
      name: toolName,
      arguments: params
    })
  })

  if (response.ok) {
    const result = await response.json()
    return result
  } else {
    const errorText = await response.text()
    console.error(`MCP tool ${toolName} failed:`, response.status, errorText)
    
    // parse_error_message
    let errorMessage = `Failed to call ${toolName}`
    try {
      const errorData = JSON.parse(errorText)
      if (errorData.message) {
        errorMessage = errorData.message
      }
    } catch (e) {
      // if_parsing_fails，using_http_status_codes
      errorMessage = `${errorMessage}: HTTP ${response.status}`
    }
    
    throw new Error(errorMessage)
  }
}

// get_device_details
const fetchDeviceInfo = async () => {
  try {
    // get_all_device_information_concurrently
    const [systemInfoResponse, deviceStateResponse, screenInfoResponse] = await Promise.allSettled([
      callMcpTool('self.get_system_info'),
      callMcpTool('self.get_device_status'),
      callMcpTool('self.screen.get_info')
    ])

    // handle_system_information
    if (systemInfoResponse.status === 'fulfilled' && systemInfoResponse.value) {
      const data = systemInfoResponse.value.data || systemInfoResponse.value

      deviceInfo.value.chip = { model: data.chip_model_name || 'Unknown' }
      deviceInfo.value.board = { model: data.board?.name || 'Unknown' }
      deviceInfo.value.firmware = { version: data.application?.version || 'Unknown' }

      // get_flash_size
      if (data.flash_size) {
        const sizeInMB = Math.round(data.flash_size / 1024 / 1024)
        deviceInfo.value.flash = { size: `${sizeInMB}MB` }
      } else {
        deviceInfo.value.flash = { size: 'Unknown' }
      }

      // get_assets_partition_size
      if (data.partition_table) {
        const assetsPartition = data.partition_table.find(p => p.label === 'assets')
        if (assetsPartition) {
          deviceInfo.value.assetsPartition = { 
            size: assetsPartition.size,
            sizeFormatted: `${Math.round(assetsPartition.size / 1024 / 1024)}MB`
          }
        } else {
          deviceInfo.value.assetsPartition = null
        }
      } else {
        deviceInfo.value.assetsPartition = null
      }
    } else {
      console.warn('系统信息获取失败:', systemInfoResponse.reason || systemInfoResponse.value)
      deviceInfo.value.chip = { model: 'Unknown' }
      deviceInfo.value.board = { model: 'Unknown' }
      deviceInfo.value.firmware = { version: 'Unknown' }
      deviceInfo.value.flash = { size: 'Unknown' }
      deviceInfo.value.assetsPartition = null
    }

    // handle_device_status_information
    if (deviceStateResponse.status === 'fulfilled' && deviceStateResponse.value) {
      const data = deviceStateResponse.value.data || deviceStateResponse.value

      deviceInfo.value.network = {
        type: data.network?.type || 'unknown',
        signal: data.network?.signal || 'Unknown'
      }
    } else {
      console.warn('设备状态获取失败:', deviceStateResponse.reason || deviceStateResponse.value)
      deviceInfo.value.network = { type: 'unknown', signal: 'Unknown' }
    }

    // process_screen_information
    if (screenInfoResponse.status === 'fulfilled' && screenInfoResponse.value) {
      const data = screenInfoResponse.value.data || screenInfoResponse.value

      deviceInfo.value.screen = {
        resolution: `${data.width || 0}x${data.height || 0}`
      }
    } else {
      console.warn('屏幕信息获取失败:', screenInfoResponse.reason || screenInfoResponse.value)
      deviceInfo.value.screen = { resolution: 'Unknown' }
    }
  } catch (error) {
    console.error('获取设备信息时发生错误:', error)
  }
}

// check_if_the_device_is_online
const checkDeviceStatus = async () => {
  if (isChecking.value || !token.value) return

  isChecking.value = true
  try {
    const response = await fetch('/api/messaging/device/tools/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      }
    })

    if (response.ok) {
      deviceStatus.value.isOnline = true
      deviceStatus.value.error = ''
      deviceStatus.value.lastCheck = new Date()

      // get_device_details
      await fetchDeviceInfo()
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  } catch (error) {
    deviceStatus.value.isOnline = false
    deviceStatus.value.error = ''
    deviceStatus.value.lastCheck = new Date()

    // Try again after 30 seconds
    if (retryTimer.value) {
      clearTimeout(retryTimer.value)
    }
    retryTimer.value = setTimeout(checkDeviceStatus, 30000)
  } finally {
    isChecking.value = false
  }
}

// format_signal_strength_display_text（moved_to_components_for_internationalization）
const getSignalDisplayText = (signal, t) => {
  if (!signal) return t('device.signal.unknown')

  switch (signal.toLowerCase()) {
    case 'strong':
      return t('device.signal.strong')
    case 'medium':
      return t('device.signal.medium')
    case 'weak':
      return t('device.signal.weak')
    case 'none':
      return t('device.signal.none')
    default:
      return signal
  }
}

// initialize_device_status_monitoring
const initializeDeviceStatus = () => {
  token.value = getUrlParameter('token')
  if (token.value) {
    checkDeviceStatus()
  }
}

// clean_up_resources
const cleanupDeviceStatus = () => {
  if (retryTimer.value) {
    clearTimeout(retryTimer.value)
    retryTimer.value = null
  }
}

// manually_refresh_device_status
const refreshDeviceStatus = async () => {
  await checkDeviceStatus()
}

/**
 * device_status Composable
 * used_to_share_device_status_and_device_information_throughout_the_app
 */
export function useDeviceStatus() {
  // computed_properties
  const hasToken = computed(() => !!token.value)
  const isDeviceOnline = computed(() => deviceStatus.value.isOnline)

  return {
    // state
    deviceStatus,
    deviceInfo,
    isChecking,
    hasToken,
    isDeviceOnline,
    
    // method
    initializeDeviceStatus,
    cleanupDeviceStatus,
    refreshDeviceStatus,
    checkDeviceStatus,
    callMcpTool,
    getSignalDisplayText
  }
}


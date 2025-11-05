# Composables usage instructions

## useDeviceStatus

Composable for sharing device state and device information throughout your app.

### Features

- 🔄 **Global Sharing**: All components have access to the same device state
- 📡 **Automatic detection**: Automatically detect the online status of the device and retry regularly
- 📊 **Detailed information**: Provide information about chips, development boards, firmware, partitions, networks, screens, etc.
- 🛠️ **MCP Tool**: Provides a convenient method to call MCP tool

### Basic usage

```javascript
import { useDeviceStatus } from '@/composables/useDeviceStatus'

export default {
  setup() {
    const {
      deviceStatus, // device online status
      deviceInfo, // device details
      isDeviceOnline, // Is it online (calculated property)
      hasToken, // Whether there is a token (computed attribute)
      refreshDeviceStatus, // Manually refresh status
      callMcpTool // Call MCP tool
    } = useDeviceStatus()
    
    return {
      deviceStatus,
      deviceInfo,
      isDeviceOnline,
      hasToken
    }
  }
}
```

### Example of use in HomePage.vue

```vue
<template>
  <div>
    <!-- Display device information -->
    <div v-if="isDeviceOnline">
      <h2>Device connected</h2>
      <p>Chip model: {{ deviceInfo.chip?.model }}</p>
      <p>Development board: {{ deviceInfo.board?.model }}</p>
      <p>Flash size: {{ deviceInfo.flash?.size }}</p>
      <p>Assets partition: {{ deviceInfo.assetsPartition?.sizeFormatted }}</p>
      <p>Screen resolution: {{ deviceInfo.screen?.resolution }}</p>
    </div>
    
    <div v-else>
      <p>Device offline</p>
    </div>
    
    <!-- Manual refresh button -->
    <button @click="refreshDeviceStatus">Refresh device status</button>
  </div>
</template>

<script setup>
import { useDeviceStatus } from '@/composables/useDeviceStatus'

const {
  deviceStatus,
  deviceInfo,
  isDeviceOnline,
  refreshDeviceStatus
} = useDeviceStatus()
</script>
```

### Use in any component

```vue
<script setup>
import { useDeviceStatus } from '@/composables/useDeviceStatus'

const { deviceInfo, isDeviceOnline } = useDeviceStatus()

//Adjust UI based on device information
const displaySize = computed(() => {
  if (!deviceInfo.value.screen) return { width: 320, height: 240 }
  const [width, height] = deviceInfo.value.screen.resolution.split('x')
  return { width: parseInt(width), height: parseInt(height) }
})
</script>
```

### Call MCP tool

```javascript
import { useDeviceStatus } from '@/composables/useDeviceStatus'

const { callMcpTool } = useDeviceStatus()

// Call the tool without parameters
const systemInfo = await callMcpTool('self.get_system_info')

// Call the tool with parameters
const result = await callMcpTool('self.assets.set_download_url', {
  url: 'https://example.com/download'
})
```

### Available states and methods

#### Status (Refs)

- `deviceStatus`: device status object
  - `isOnline`: whether online
  - `error`: error message
  - `lastCheck`: last check time

- `deviceInfo`: device information object
  - `chip`: { model: string }
  - `board`: { model: string }
  - `firmware`: { version: string }
  - `flash`: { size: string } // Total size of Flash
  - `assetsPartition`: { size: number, sizeFormatted: string } // assets partition size (number of bytes and formatted text)
  - `network`: { type: string, signal: string }
  - `screen`: { resolution: string }

- `isChecking`: Whether the device status is being checked

#### Computed properties (Computed)

- `hasToken`: whether there is an authentication token
- `isDeviceOnline`: whether the device is online

#### Methods

- `initializeDeviceStatus()`: Initialize device status monitoring
- `cleanupDeviceStatus()`: Clean up resources
- `refreshDeviceStatus()`: Manually refresh device status
- `checkDeviceStatus()`: Check device status
- `callMcpTool(toolName, params)`: Call MCP tool
- `getSignalDisplayText(signal)`: Format signal strength display text

### Notes

1. The device status will be automatically detected and will be retried every 30 seconds when offline.
2. All components share the same device state, and modifications will affect all components that use this state.
3. Just call `useDeviceStatus()` in the component to access the global status without manual initialization.
4. The `DeviceStatus.vue` component will automatically handle initialization and cleanup work


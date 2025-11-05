# Configure persistent storage function description

## Function Overview

This project adds a new configuration and file persistent storage function based on IndexedDB, allowing users to maintain the previous configuration status and uploaded files after refreshing the page.

## Main features

### 1. Automatic configuration saving
- **Real-time save**: Automatically save to IndexedDB when the user modifies the configuration
- **Smart Detection**: Automatically detect whether there are saved configurations when the page loads
- **STATUS RESTORATION**: Restore user's progress position and hashtag status

### 2. Automatic file storage
- **Font File**: Custom font files are automatically saved, containing converted font data
- **Emoji Pictures**: Customized emoticon pictures are automatically saved to storage
- **Background Image**: Light/Dark mode background image automatically saved

### 3. Restart function
- **One-click cleanup**: Provide a restart button and clear all stored data after confirmation.
- **Safety Confirmation**: Contains detailed confirmation dialog box to prevent misoperation
- **Full Reset**: Clean configuration, files and temporary data

## Technical implementation

### Core components

#### ConfigStorage.js
- IndexedDB database management
- Configuration storage and recovery
- File binary storage
- Temporary data management

#### StorageHelper.js
- Provide convenient storage API for each component
- Unified file saving and deletion interface
- Classify and manage different types of resource files

#### AssetsBuilder.js integration
- Deep integration with storage systems
- Automatically save converted font data
- Intelligent recovery of resource files

### Storage structure

```javascript
// Database: XiaozhiConfigDB
{
  configs: { // Configuration table
    key: 'current_config',
    config: { ... }, // Complete configuration object
    currentStep: 1, // current step
    activeThemeTab: 'font', // active label
    timestamp: 1234567890 // Save time
  },
  
  files: { // file table
    id: 'custom_font',
    type: 'font', // file type
    name: 'MyFont.ttf', // file name
    size: 1024, // file size
    mimeType: 'font/ttf', // MIME type
    data: ArrayBuffer, // File binary data
    metadata: { ... }, // metadata
    timestamp: 1234567890 // Save time
  },
  
  temp_data: { // Temporary data table
    key: 'converted_font_xxx',
    type: 'converted_font', // data type
    data: ArrayBuffer, // converted data
    metadata: { ... }, // metadata
    timestamp: 1234567890 // Save time
  }
}
```

## User experience

### First time use
1. Users configure chips, themes, etc. normally
2. Each modification is automatically saved to local storage.
3. Uploaded files are saved simultaneously

### After refreshing the page
1. Display "Saved configuration detected" prompt
2. Automatically restore to the last configuration state
3. Recover uploaded files and converted data
4. Provide "Restart" option

### restart
1. Click the "Restart" button
2. Display detailed confirmation dialog box
3. List the data types to be cleared
4. After confirmation, completely reset to the initial state.

## API Reference

### ConfigStorage main method

```javascript
//Save configuration
await configStorage.saveConfig(config, currentStep, activeThemeTab)

//Load configuration
const data = await configStorage.loadConfig()

// save file
await configStorage.saveFile(id, file, type, metadata)

//Load file
const file = await configStorage.loadFile(id)

//Clear all data
await configStorage.clearAll()
```

### StorageHelper convenience methods

```javascript
//Save font file
await StorageHelper.saveFontFile(file, config)

//Save emoticon file
await StorageHelper.saveEmojiFile(emojiName, file, config)

//Save background file
await StorageHelper.saveBackgroundFile(mode, file, config)

// delete file
await StorageHelper.deleteFontFile()
await StorageHelper.deleteEmojiFile(emojiName)
await StorageHelper.deleteBackgroundFile(mode)
```

## Notes

### Browser Compatibility
- Requires a modern browser that supports IndexedDB
- It is recommended to use Chrome 58+, Firefox 55+, Safari 10.1+

### Storage limit
- IndexedDB storage space is limited by the browser
- Large files may affect storage performance
- It is recommended to clean unnecessary data regularly

### Privacy considerations
- Data is only stored in the user's local browser
- Will not be uploaded to the server
- Clearing browser data will lose stored configurations

## troubleshooting

### Storage failed
- Check if the browser supports IndexedDB
- Confirm that the browser has sufficient storage space
- Check if private browsing mode is enabled

### Configuration lost
- Clearing browser data will result in loss of configuration
- Browser upgrades may affect storage compatibility
- It is recommended to manually back up important configurations

### Performance issues
- Large file storage may impact performance
- Clean your data regularly using the "Start Over" function
- Avoid frequent large file upload operations

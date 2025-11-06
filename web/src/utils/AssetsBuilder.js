/**
 * AssetsBuilder kind
 * used_to_deal_with_xiaozhi AI custom_theme assets.bin package_generation
 * 
 * main_functions：
 * - configuration_verification_and_processing
 * - generate index.json content
 * - manage_resource_files
 * - with_backend API interactive_generation assets.bin
 * - integrated_browserside_font_conversion_function
 */

import browserFontConverter from './font_conv/BrowserFontConverter.js'
import WakenetModelPacker from './WakenetModelPacker.js'
import SpiffsGenerator from './SpiffsGenerator.js'
import WasmGifScaler from './WasmGifScaler.js'
import configStorage from './ConfigStorage.js'

class AssetsBuilder {
  constructor() {
    this.config = null
    this.resources = new Map() // store_resource_files
    this.tempFiles = [] // temporary_file_list
    this.fontConverterBrowser = browserFontConverter // browser_font_converter
    this.convertedFonts = new Map() // caching_converted_fonts
    this.wakenetPacker = new WakenetModelPacker() // wake_word_model_packager
    this.spiffsGenerator = new SpiffsGenerator() // SPIFFS generator
    this.gifScaler = new WasmGifScaler({ 
      quality: 30, 
      debug: true,
      scalingMode: 'auto',  // automatically_select_the_best_zoom_mode
      optimize: true,       // enable GIF optimization
      optimizationLevel: 2  // optimization_level (1-3)
    }) // WASM GIF scaler
    this.configStorage = configStorage // configure_storage_manager
    this.autoSaveEnabled = true // whether_to_enable_automatic_saving
  }

  /**
   * set_configuration_object
   * @param {Object} config - complete_configuration_object
   */
  setConfig(config, options = {}) {
    const strict = options?.strict ?? true
    if (strict && !this.validateConfig(config)) {
      throw new Error('Configuration object validation failed')
    }
    this.config = { ...config }
    return this
  }

  /**
   * verify_configuration_object
   * @param {Object} config - configuration_object_to_be_verified
   * @returns {boolean} verification_results
   */
  validateConfig(config) {
    if (!config) return false
    
    // verify_chip_configuration
    if (!config.chip?.model) {
      console.error('Missing chip model configuration')
      return false
    }

    // verify_display_configuration
    const display = config.chip.display
    if (!display?.width || !display?.height) {
      console.error('Missing display resolution configuration')
      return false
    }

    // verify_font_configuration
    const font = config.theme?.font
    if (font?.type === 'preset' && !font.preset) {
      console.error('Preset font configuration is incomplete')
      return false
    }
    if (font?.type === 'custom' && !font.custom?.file) {
      console.error('Custom font file not provided')
      return false
    }

    return true
  }

  /**
   * add_resource_files
   * @param {string} key - resource_key_name
   * @param {File|Blob} file - file_object
   * @param {string} filename - file_name
   * @param {string} resourceType - resource_type (font, emoji, background)
   */
  addResource(key, file, filename, resourceType = 'other') {
    this.resources.set(key, {
      file,
      filename,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified || Date.now(),
      resourceType
    })

    // automatically_save_files_to_storage
    if (this.autoSaveEnabled && file instanceof File) {
      this.saveFileToStorage(key, file, resourceType).catch(error => {
        console.warn(`Auto-saving file ${filename} failed:`, error)
      })
    }

    return this
  }

  /**
   * save_file_to_storage
   * @param {string} key - resource_key_name
   * @param {File} file - file_object
   * @param {string} resourceType - resource_type
   * @returns {Promise<void>}
   */
  async saveFileToStorage(key, file, resourceType) {
    try {
      await this.configStorage.saveFile(key, file, resourceType)
      console.log(`File ${file.name} auto-saved to storage`)
    } catch (error) {
      console.error(`Failed to save file to storage: ${file.name}`, error)
      throw error
    }
  }

  /**
   * recover_resource_files_from_storage
   * @param {string} key - resource_key_name
   * @returns {Promise<boolean>} is_the_recovery_successful
   */
  async restoreResourceFromStorage(key) {
    try {
      const file = await this.configStorage.loadFile(key)
      if (file) {
        this.resources.set(key, {
          file,
          filename: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          resourceType: file.storedType,
          fromStorage: true
        })
        console.log(`Resource ${key} restored from storage successfully: ${file.name}`)
        return true
      }
      return false
    } catch (error) {
      console.error(`Failed to restore resource from storage: ${key}`, error)
      return false
    }
  }

  /**
   * restore_all_related_resource_files
   * @param {Object} config - configuration_object
   * @returns {Promise<void>}
   */
  async restoreAllResourcesFromStorage(config) {
    if (!config) return

    const restoredFiles = []

    // restore_custom_font_files
    if (config.theme?.font?.type === 'custom' && config.theme.font.custom?.file === null) {
      const fontKey = 'custom_font'
      if (await this.restoreResourceFromStorage(fontKey)) {
        const resource = this.resources.get(fontKey)
        if (resource) {
          config.theme.font.custom.file = resource.file
          restoredFiles.push(`Custom font: ${resource.filename}`)
        }
      }
    }

    // restore_custom_emoticon_pictures（support_new hash remove_duplicate_structures）
    if (config.theme?.emoji?.type === 'custom' && config.theme.emoji.custom) {
      const emojiCustom = config.theme.emoji.custom
      const emotionMap = emojiCustom.emotionMap || {}
      const fileMap = emojiCustom.fileMap || {}
      const images = emojiCustom.images || {}
      
      // if_a_new_structure_exists（emotionMap and fileMap），restore_using_new_structure
      if (Object.keys(emotionMap).length > 0 || Object.keys(fileMap).length > 0) {
        // collect_all_that_need_to_be_restored hash
        const hashesToRestore = new Set()
        
        // from fileMap collect_all_in hash
        for (const hash of Object.keys(fileMap)) {
          if (fileMap[hash] === null) {
            hashesToRestore.add(hash)
          }
        }
        
        // recover_every_unique_file（according_to hash）
        for (const hash of hashesToRestore) {
          let fileKey = `hash_${hash}`
          let restored = await this.restoreResourceFromStorage(fileKey)
          
          // if_recovery_fails_with_new_format，try_old_format（compatibility_processing）
          if (!restored) {
            const oldKey = `emoji_hash_${hash}`
            restored = await this.restoreResourceFromStorage(oldKey)
            if (restored) {
              fileKey = oldKey
            }
          }
          
          if (restored) {
            const resource = this.resources.get(fileKey)
            if (resource) {
              // renew fileMap
              fileMap[hash] = resource.file
              
              // find_all_using_this hash expression
              const emotionsUsingHash = Object.entries(emotionMap)
                .filter(([_, h]) => h === hash)
                .map(([emotion, _]) => emotion)
              
              // update_all_emoticons_using_this_file images
              emotionsUsingHash.forEach(emotion => {
                images[emotion] = resource.file
              })
              
              restoredFiles.push(`Emoji file ${hash.substring(0, 8)}... (used for: ${emotionsUsingHash.join(', ')})`)
            }
          }
        }
        
        // modify_the_original_object_directly（keep_it_responsive）
        // update_one_by_one fileMap
        Object.keys(fileMap).forEach(hash => {
          config.theme.emoji.custom.fileMap[hash] = fileMap[hash]
        })
        
        // update_one_by_one images
        Object.keys(images).forEach(emotion => {
          config.theme.emoji.custom.images[emotion] = images[emotion]
        })
      } else {
        // compatible_with_older_structures：recover_emoticon_files_one_by_one
        for (const [emojiName, file] of Object.entries(images)) {
          if (file === null) {
            const emojiKey = `emoji_${emojiName}`
            if (await this.restoreResourceFromStorage(emojiKey)) {
              const resource = this.resources.get(emojiKey)
              if (resource) {
                images[emojiName] = resource.file
                restoredFiles.push(`Emoji ${emojiName}: ${resource.filename}`)
              }
            }
          }
        }
        config.theme.emoji.custom.images = images
      }
    }

    // restore_background_image
    if (config.theme?.skin?.light?.backgroundType === 'image' && config.theme.skin.light.backgroundImage === null) {
      const bgKey = 'background_light'
      if (await this.restoreResourceFromStorage(bgKey)) {
        const resource = this.resources.get(bgKey)
        if (resource) {
          config.theme.skin.light.backgroundImage = resource.file
          restoredFiles.push(`Light background: ${resource.filename}`)
        }
      }
    }
    
    if (config.theme?.skin?.dark?.backgroundType === 'image' && config.theme.skin.dark.backgroundImage === null) {
      const bgKey = 'background_dark'
      if (await this.restoreResourceFromStorage(bgKey)) {
        const resource = this.resources.get(bgKey)
        if (resource) {
          config.theme.skin.dark.backgroundImage = resource.file
          restoredFiles.push(`Dark background: ${resource.filename}`)
        }
      }
    }

    // restore_converted_font_data
    try {
      const fontInfo = this.getFontInfo()
      if (fontInfo && fontInfo.type === 'custom') {
        const tempKey = `converted_font_${fontInfo.filename}`
        const tempData = await this.configStorage.loadTempData(tempKey)
        if (tempData) {
          this.convertedFonts.set(fontInfo.filename, tempData.data)
          console.log(`Converted font data restored: ${fontInfo.filename}`)
        }
      }
    } catch (error) {
      console.warn('Error restoring converted font data:', error)
    }

    if (restoredFiles.length > 0) {
      console.log('Files restored from storage:', restoredFiles)
    }
  }

  /**
   * get_wake_word_model_information
   * @returns {Object|null} wake_word_model_information
   */
  getWakewordModelInfo() {
    if (!this.config || !this.config.chip || !this.config.theme) {
      return null
    }
    
    const chipModel = this.config.chip.model
    const wakeword = this.config.theme.wakeword
    
    if (!wakeword) return null

    // determine_the_wake_word_model_type_based_on_the_chip_model
    const isC3OrC6 = chipModel === 'esp32c3' || chipModel === 'esp32c6'
    const modelType = isC3OrC6 ? 'WakeNet9s' : 'WakeNet9'
    
    return {
      name: wakeword,
      type: modelType,
      filename: 'srmodels.bin'
    }
  }

  /**
   * get_font_information
   * @returns {Object|null} font_information
   */
  getFontInfo() {
    if (!this.config || !this.config.theme || !this.config.theme.font) {
      return null
    }
    
    const font = this.config.theme.font
    
    if (font.type === 'preset') {
      return {
        type: 'preset',
        filename: `${font.preset}.bin`,
        source: font.preset
      }
    }
    
    if (font.type === 'custom' && font.custom.file) {
      const custom = font.custom
      const filename = `font_custom_${custom.size}_${custom.bpp}.bin`
      
      return {
        type: 'custom',
        filename,
        source: font.custom.file,
        config: {
          size: custom.size,
          bpp: custom.bpp,
          charset: custom.charset
        }
      }
    }
    
    return null
  }

  /**
   * get_expression_collection_information
   * @returns {Array} expression_collection_information_array
   */
  getEmojiCollectionInfo() {
    if (!this.config || !this.config.theme || !this.config.theme.emoji) {
      return []
    }
    
    const emoji = this.config.theme.emoji
    const collection = []
    
    if (emoji.type === 'preset') {
      // default_emoticon_pack
      const presetEmojis = [
        'neutral', 'happy', 'laughing', 'funny', 'sad', 'angry', 'crying',
        'loving', 'embarrassed', 'surprised', 'shocked', 'thinking', 'winking',
        'cool', 'relaxed', 'delicious', 'kissy', 'confident', 'sleepy', 'silly', 'confused'
      ]
      
      const size = emoji.preset === 'twemoji32' ? '32' : '64'
      presetEmojis.forEach(name => {
        collection.push({
          name,
          file: `${name}.png`,
          source: `preset:${emoji.preset}`,
          size: { width: parseInt(size), height: parseInt(size) }
        })
      })
    } else if (emoji.type === 'custom') {
      // custom_emoticons（support_file_deduplication）
      const images = emoji.custom.images || {}
      const emotionMap = emoji.custom.emotionMap || {}
      const fileMap = emoji.custom.fileMap || {}
      const size = emoji.custom.size || { width: 64, height: 64 }
      
      // must_use_new hash mapping_structure
      if (Object.keys(emotionMap).length === 0 || Object.keys(fileMap).length === 0) {
        console.error('❌ Error: Detected old version of emoji data structure')
        console.error('Please clear browser cache or reset configuration, then re-upload emoji images')
        throw new Error('Incompatible emoji data structure: Missing fileMap or emotionMap. Please reconfigure emojis.')
      }
      
      // create hash mapping_to_file_names（used_to_remove_duplicates）
      const hashToFilename = new Map()
      
      Object.entries(emotionMap).forEach(([emotionName, fileHash]) => {
        const file = fileMap[fileHash]
        if (file) {
          // for_each_unique_file hash generate_a_shared_file_name
          if (!hashToFilename.has(fileHash)) {
            const fileExtension = file.name ? file.name.split('.').pop().toLowerCase() : 'png'
            // use hash the_first_8_digits_are_used_as_the_file_name，ensure_uniqueness
            const sharedFilename = `emoji_${fileHash.substring(0, 8)}.${fileExtension}`
            hashToFilename.set(fileHash, sharedFilename)
          }
          
          const sharedFilename = hashToFilename.get(fileHash)
          
          collection.push({
            name: emotionName,
            file: sharedFilename,  // multiple_expressions_may_point_to_the_same_file
            source: file,
            fileHash,  // reserve hash information_used_for_deduplication
            size: { ...size }
          })
        }
      })
      
      console.log(`Emoji deduplication: ${Object.keys(emotionMap).length} emojis using ${hashToFilename.size} different image files`)
      
      // make_sure_there_are_at_least neutral expression
      if (!collection.find(item => item.name === 'neutral')) {
        console.warn('Warning: neutral emoji not provided, default image will be used')
      }
    }
    
    return collection
  }

  /**
   * get_skin_configuration_information
   * @returns {Object} skin_configuration_information
   */
  getSkinInfo() {
    if (!this.config || !this.config.theme || !this.config.theme.skin) {
      return {}
    }
    
    const skin = this.config.theme.skin
    const result = {}
    
    // handling_light_mode
    if (skin.light) {
      result.light = {
        text_color: skin.light.textColor || '#000000',
        background_color: skin.light.backgroundColor || '#ffffff'
      }
      
      if (skin.light.backgroundType === 'image' && skin.light.backgroundImage) {
        result.light.background_image = 'background_light.raw'
      }
    }
    
    // dealing_with_dark_mode  
    if (skin.dark) {
      result.dark = {
        text_color: skin.dark.textColor || '#ffffff',
        background_color: skin.dark.backgroundColor || '#121212'
      }
      
      if (skin.dark.backgroundType === 'image' && skin.dark.backgroundImage) {
        result.dark.background_image = 'background_dark.raw'
      }
    }
    
    return result
  }

  /**
   * generate index.json content
   * @returns {Object} index.json object
   */
  generateIndexJson() {
    if (!this.config) {
      throw new Error('Configuration object not set')
    }

    const indexData = {
      version: 1,
      chip_model: this.config.chip.model,
      display_config: {
        width: this.config.chip.display.width,
        height: this.config.chip.display.height,
        monochrome: false,
        color: this.config.chip.display.color || 'RGB565'
      }
    }

    // add_wake_word_model
    const wakewordInfo = this.getWakewordModelInfo()
    if (wakewordInfo) {
      indexData.srmodels = wakewordInfo.filename
    }

    // add_font_information
    const fontInfo = this.getFontInfo()
    if (fontInfo) {
      indexData.text_font = fontInfo.filename
    }

    // add_skin_configuration
    const skinInfo = this.getSkinInfo()
    if (Object.keys(skinInfo).length > 0) {
      indexData.skin = skinInfo
    }

    // add_emoticon_collection
    const emojiCollection = this.getEmojiCollectionInfo()
    if (emojiCollection.length > 0) {
      indexData.emoji_collection = emojiCollection.map(emoji => ({
        name: emoji.name,
        file: emoji.file
      }))
    }

    return indexData
  }

  /**
   * prepare_to_package_resources
   * @returns {Object} packaging_resource_list
   */
  preparePackageResources() {
    const resources = {
      files: [],
      indexJson: this.generateIndexJson(),
      config: { ...this.config }
    }

    // add_wake_word_model
    const wakewordInfo = this.getWakewordModelInfo()
    if (wakewordInfo && wakewordInfo.name) {
      resources.files.push({
        type: 'wakeword',
        name: wakewordInfo.name,
        filename: wakewordInfo.filename,
        modelType: wakewordInfo.type
      })
    }

    // add_font_file
    const fontInfo = this.getFontInfo()
    if (fontInfo) {
      resources.files.push({
        type: 'font',
        filename: fontInfo.filename,
        source: fontInfo.source,
        config: fontInfo.config || null
      })
    }

    // add_emoticon_file（deduplication）
    const emojiCollection = this.getEmojiCollectionInfo()
    const addedFileHashes = new Set()  // track_added_files hash
    
    emojiCollection.forEach(emoji => {
      // if_there_is fileHash（customize_expressions_and_use_new_structures），check_if_it_has_been_added
      if (emoji.fileHash) {
        if (addedFileHashes.has(emoji.fileHash)) {
          // file_added，jump_over（but_remain_in index.json of emoji_collection middle）
          console.log(`Skipping duplicate file: ${emoji.name} -> ${emoji.file} (hash: ${emoji.fileHash.substring(0, 8)})`)
          return
        }
        addedFileHashes.add(emoji.fileHash)
      }
      
      // add_unique_files
      resources.files.push({
        type: 'emoji',
        name: emoji.name,
        filename: emoji.file,
        source: emoji.source,
        size: emoji.size,
        fileHash: emoji.fileHash  // transfer hash information
      })
    })

    // add_background_image
    const skin = this.config?.theme?.skin
    if (skin?.light?.backgroundType === 'image' && skin.light.backgroundImage) {
      resources.files.push({
        type: 'background',
        filename: 'background_light.raw',
        source: skin.light.backgroundImage,
        mode: 'light'
      })
    }
    if (skin?.dark?.backgroundType === 'image' && skin.dark.backgroundImage) {
      resources.files.push({
        type: 'background', 
        filename: 'background_dark.raw',
        source: skin.dark.backgroundImage,
        mode: 'dark'
      })
    }

    return resources
  }

  /**
   * preprocess_custom_fonts
   * @param {Function} progressCallback - progress_callback_function  
   * @returns {Promise<void>}
   */
  async preprocessCustomFonts(progressCallback = null) {
    const fontInfo = this.getFontInfo()
    
    if (fontInfo && fontInfo.type === 'custom' && !this.convertedFonts.has(fontInfo.filename)) {
      if (progressCallback) progressCallback(20, 'Converting custom font...')
      
      try {
        const convertOptions = {
          fontFile: fontInfo.source,
          fontName: fontInfo.filename.replace(/\.bin$/, ''),
          fontSize: fontInfo.config.size,
          bpp: fontInfo.config.bpp,
          charset: fontInfo.config.charset,
          symbols: fontInfo.config.symbols || '',
          range: fontInfo.config.range || '',
          compression: false,
          progressCallback: (progress, message) => {
            if (progressCallback) progressCallback(20 + progress * 0.2, `Font conversion: ${message}`)
          }
        }
        
        let convertedFont
        
        // use_a_browserside_font_converter
        await this.fontConverterBrowser.initialize()
        convertedFont = await this.fontConverterBrowser.convertToCBIN(convertOptions)
        this.convertedFonts.set(fontInfo.filename, convertedFont)

        // save_converted_fonts_to_temporary_storage
        if (this.autoSaveEnabled) {
          const tempKey = `converted_font_${fontInfo.filename}`
          try {
            await this.configStorage.saveTempData(tempKey, convertedFont, 'converted_font', {
              filename: fontInfo.filename,
              size: fontInfo.config.size,
              bpp: fontInfo.config.bpp,
              charset: fontInfo.config.charset
            })
            console.log(`Converted font saved to storage: ${fontInfo.filename}`)
          } catch (error) {
            console.warn(`Failed to save converted font: ${fontInfo.filename}`, error)
          }
        }
      } catch (error) {
        console.error('Font conversion failed:', error)
        throw new Error(`Font conversion failed: ${error.message}`)
      }
    }
  }

  /**
   * generate assets.bin
   * @param {Function} progressCallback - progress_callback_function
   * @returns {Promise<Blob>} generated assets.bin document
   */
  async generateAssetsBin(progressCallback = null) {
    if (!this.config) {
      throw new Error('Configuration object not set')
    }

    try {
      if (progressCallback) progressCallback(0, 'Starting generation...')
      
      // preprocess_custom_fonts
      await this.preprocessCustomFonts(progressCallback)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      if (progressCallback) progressCallback(40, 'Preparing resource files...')
      
      const resources = this.preparePackageResources()
      
      // clean_generator_status
      this.wakenetPacker.clear()
      this.spiffsGenerator.clear()
      
      // process_various_resource_files
      await this.processResourceFiles(resources, progressCallback)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      if (progressCallback) progressCallback(90, 'Generating final file...')

      // Print file list
      this.spiffsGenerator.printFileList()
      
      // generate_final assets.bin
      const assetsBinData = await this.spiffsGenerator.generate((progress, message) => {
        if (progressCallback) {
          progressCallback(90 + progress * 0.1, message)
        }
      })
      
      if (progressCallback) progressCallback(100, 'Generation completed')
      
      return new Blob([assetsBinData], { type: 'application/octet-stream' })
      
    } catch (error) {
      console.error('Failed to generate assets.bin:', error)
      throw error
    }
  }

  /**
   * download assets.bin document
   * @param {Blob} blob - assets.bin file_data
   * @param {string} filename - download_file_name
   */
  downloadAssetsBin(blob, filename = 'assets.bin') {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  /**
   * get_font_information（contains_conversion_functions）
   * @param {File} fontFile - font_file（optional，gets_information_about_the_file_if_provided）
   * @returns {Promise<Object>} font_information
   */
  async getFontInfoWithDetails(fontFile = null) {
    try {
      const file = fontFile || this.config?.theme?.font?.custom?.file
      if (!file) return null
      
      let info
      
      // use_a_browserside_font_converter
      await this.fontConverterBrowser.initialize()
      info = await this.fontConverterBrowser.getFontInfo(file)
      
      return {
        ...info,
        file: file,
        isCustom: true
      }
    } catch (error) {
      console.error('Failed to get font details:', error)
      return null
    }
  }

  /**
   * estimate_font_size
   * @param {Object} fontConfig - font_configuration
   * @returns {Promise<Object>} size_estimate
   */
  async estimateFontSize(fontConfig = null) {
    try {
      const config = fontConfig || this.config?.theme?.font?.custom
      if (!config) return null
      
      const estimateOptions = {
        fontSize: config.size,
        bpp: config.bpp,
        charset: config.charset,
        symbols: config.symbols || '',
        range: config.range || ''
      }
      
      let sizeInfo
      
      // use_a_browserside_font_converter
      sizeInfo = this.fontConverterBrowser.estimateSize(estimateOptions)
      
      return sizeInfo
    } catch (error) {
      console.error('Failed to estimate font size:', error)
      return null
    }
  }

  /**
   * verify_custom_font_configuration
   * @param {Object} fontConfig - font_configuration
   * @returns {Object} verification_results
   */
  validateCustomFont(fontConfig) {
    const errors = []
    const warnings = []
    
    if (!fontConfig.file) {
      errors.push('Missing font file')
    } else {
      // verify_using_a_browserside_converter
      const isValid = this.fontConverterBrowser.validateFont(fontConfig.file)
        
      if (!isValid) {
        errors.push('Font file format not supported')
      }
    }
    
    if (fontConfig.size < 8 || fontConfig.size > 80) {
      errors.push('Font size must be between 8-80')
    }
    
    if (![1, 2, 4, 8].includes(fontConfig.bpp)) {
      errors.push('BPP must be 1, 2, 4 or 8')
    }
    
    if (!fontConfig.charset && !fontConfig.symbols && !fontConfig.range) {
      warnings.push('No charset, symbols or range specified, default charset will be used')
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }


  /**
   * get_font_converter_status
   * @returns {Object} converter_status_information
   */
  getConverterStatus() {
    return {
      initialized: this.fontConverterBrowser.initialized,
      supportedFormats: this.fontConverterBrowser.supportedFormats
    }
  }

  /**
   * process_resource_files
   * @param {Object} resources - resource_allocation
   * @param {Function} progressCallback - progress_callback
   */
  async processResourceFiles(resources, progressCallback = null) {
    let processedCount = 0
    const totalFiles = resources.files.length
    
    // add_to index.json document
    const indexJsonData = new TextEncoder().encode(JSON.stringify(resources.indexJson, null, 2))
    // print json string
    console.log('index.json', resources.indexJson);
    this.spiffsGenerator.addFile('index.json', indexJsonData.buffer)
    
    for (const resource of resources.files) {
      const progressPercent = 40 + (processedCount / totalFiles) * 40
      if (progressCallback) {
        progressCallback(progressPercent, `Processing file: ${resource.filename}`)
      }
      
      try {
        await this.processResourceFile(resource)
        processedCount++
      } catch (error) {
        console.error(`Failed to process resource file: ${resource.filename}`, error)
        throw new Error(`Failed to process resource file: ${resource.filename} - ${error.message}`)
      }
    }
  }

  /**
   * process_a_single_resource_file
   * @param {Object} resource - resource_allocation
   */
  async processResourceFile(resource) {
    switch (resource.type) {
      case 'wakeword':
        await this.processWakewordModel(resource)
        break
      case 'font':
        await this.processFontFile(resource)
        break
      case 'emoji':
        await this.processEmojiFile(resource)
        break
      case 'background':
        await this.processBackgroundFile(resource)
        break
      default:
        console.warn(`Unknown resource type: ${resource.type}`)
    }
  }

  /**
   * handle_wake_word_model
   * @param {Object} resource - resource_allocation
   */
  async processWakewordModel(resource) {
    const success = await this.wakenetPacker.loadModelFromShare(resource.name)
    if (!success) {
      throw new Error(`Failed to load wakeword model: ${resource.name}`)
    }
    
    const srmodelsData = this.wakenetPacker.packModels()
    this.spiffsGenerator.addFile(resource.filename, srmodelsData)
  }

  /**
   * processing_font_files
   * @param {Object} resource - resource_allocation
   */
  async processFontFile(resource) {
    if (resource.config) {
      // custom_font，use_transformed_data
      const convertedFont = this.convertedFonts.get(resource.filename)
      if (convertedFont) {
        this.spiffsGenerator.addFile(resource.filename, convertedFont)
      } else {
        throw new Error(`Converted font not found: ${resource.filename}`)
      }
    } else {
      // default_font, loaded from_share/fonts directory
      const fontData = await this.loadPresetFont(resource.source)
      this.spiffsGenerator.addFile(resource.filename, fontData)
    }
  }

  /**
   * process_emoticon_files
   * @param {Object} resource - resource_allocation
   */
  async processEmojiFile(resource) {
    // notice：file_deduplication_is_now preparePackageResources() stage_completed
    // each_file_processed_here_is_unique
    
    let imageData
    let needsScaling = false
    let imageFormat = 'png' // default_format
    let isGif = false
    
    if (typeof resource.source === 'string' && resource.source.startsWith('preset:')) {
      // default_emoticon_pack
      const presetName = resource.source.replace('preset:', '')
      imageData = await this.loadPresetEmoji(presetName, resource.name)
    } else {
      // custom_expressions
      const file = resource.source
      
      // check_whether_it_is GIF format
      isGif = this.isGifFile(file)
      
      // get_file_format
      const fileExtension = file.name.split('.').pop().toLowerCase()
      imageFormat = fileExtension
      
      // check_actual_image_size
      try {
        const actualDimensions = await this.getImageDimensions(file)
        const targetSize = resource.size || { width: 64, height: 64 }
        
        // if_the_actual_size_is_outside_the_target_size_range，need_to_zoom
        if (actualDimensions.width > targetSize.width || 
            actualDimensions.height > targetSize.height) {
          needsScaling = true
          console.log(`Emoji ${resource.name} needs scaling: ${actualDimensions.width}x${actualDimensions.height} -> ${targetSize.width}x${targetSize.height}`)
        }
      } catch (error) {
        console.warn(`Failed to get emoji image dimensions: ${resource.name}`, error)
      }
      
      // if_scaling_is_not_required，read_files_directly
      if (!needsScaling) {
        imageData = await this.fileToArrayBuffer(file)
      }
    }
    
    // if_you_need_to_zoom，choose_scaling_method_based_on_file_type
    if (needsScaling) {
      try {
        const targetSize = resource.size || { width: 64, height: 64 }
        
        if (isGif) {
          // use WasmGifScaler deal_with GIF document
          console.log(`Using WasmGifScaler to process GIF emoji: ${resource.name}`)
          const scaledGifBlob = await this.gifScaler.scaleGif(resource.source, {
            maxWidth: targetSize.width,
            maxHeight: targetSize.height,
            keepAspectRatio: true,
            lossy: 30  // use lossy compression_reduces_file_size
          })
          imageData = await this.fileToArrayBuffer(scaledGifBlob)
        } else {
          // use_conventional_methods_to_process_images_in_other_formats
          imageData = await this.scaleImageToFit(resource.source, targetSize, imageFormat)
        }
      } catch (error) {
        console.error(`Failed to scale emoji image: ${resource.name}`, error)
        // use_original_image_when_scaling_fails
        imageData = await this.fileToArrayBuffer(resource.source)
      }
    }
    
    // add_files_to SPIFFS
    this.spiffsGenerator.addFile(resource.filename, imageData, {
      width: resource.size?.width || 0,
      height: resource.size?.height || 0
    })
    
    // record_processing_log
    if (resource.fileHash) {
      console.log(`Emoji file added: ${resource.filename} (hash: ${resource.fileHash.substring(0, 8)})`)
    }
  }

  /**
   * process_background_files  
   * @param {Object} resource - resource_allocation
   */
  async processBackgroundFile(resource) {
    const imageData = await this.fileToArrayBuffer(resource.source)
    
    // convert_pictures_to_raw_data_in_rgb565_format
    const rawData = await this.convertImageToRgb565(imageData)
    this.spiffsGenerator.addFile(resource.filename, rawData)
  }

  /**
   * load_default_font
   * @param {string} fontName - font_name
   * @returns {Promise<ArrayBuffer>} font_data
   */
  async loadPresetFont(fontName) {
    try {
      const response = await fetch(`./static/fonts/${fontName}.bin`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return await response.arrayBuffer()
    } catch (error) {
      throw new Error(`Failed to load preset font: ${fontName} - ${error.message}`)
    }
  }

  /**
   * load_preset_emoticons
   * @param {string} presetName - default_name (twemoji32/twemoji64)
   * @param {string} emojiName - expression_name
   * @returns {Promise<ArrayBuffer>} expression_data
   */
  async loadPresetEmoji(presetName, emojiName) {
    try {
      const response = await fetch(`./static/${presetName}/${emojiName}.png`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return await response.arrayBuffer()
    } catch (error) {
      throw new Error(`Failed to load preset emoji: ${presetName}/${emojiName} - ${error.message}`)
    }
  }

  /**
   * convert_file_to_arraybuffer
   * @param {File|Blob} file - file_object
   * @returns {Promise<ArrayBuffer>} file_data
   */
  fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsArrayBuffer(file)
    })
  }

  /*
*
* scale_image_to_fit_specified_dimensions (proportional_scaling, contain effect)
   * @param {ArrayBuffer|File} imageData - image_data
   * @param {Object} targetSize - target_size {width, height}
   * @param {string} format - picture_format（for_transparent_background_processing）
   * @returns {Promise<ArrayBuffer>} scaled_image_data
*/
  async scaleImageToFit(imageData, targetSize, format = 'png') {
    return new Promise((resolve, reject) => {
      const blob = imageData instanceof File ? imageData : new Blob([imageData])
      const url = URL.createObjectURL(blob)
      const img = new Image()
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          // set_target_canvas_size
          canvas.width = targetSize.width
          canvas.height = targetSize.height
          
          // calculate_proportional_scaling_dimensions (contain effect)
          const imgAspectRatio = img.width / img.height
          const targetAspectRatio = targetSize.width / targetSize.height
          
          let drawWidth, drawHeight, offsetX, offsetY
          
          if (imgAspectRatio > targetAspectRatio) {
            // picture_is_wider，scale_by_width
            drawWidth = targetSize.width
            drawHeight = targetSize.width / imgAspectRatio
            offsetX = 0
            offsetY = (targetSize.height - drawHeight) / 2
          } else {
            // picture_is_taller，scale_by_height
            drawHeight = targetSize.height
            drawWidth = targetSize.height * imgAspectRatio
            offsetX = (targetSize.width - drawWidth) / 2
            offsetY = 0
          }
          
          // maintain_transparent_background_for_png_format
          if (format === 'png') {
            // clear_canvas，be_transparent
            ctx.clearRect(0, 0, canvas.width, canvas.height)
          } else {
            // other_formats_use_a_white_background
            ctx.fillStyle = '#FFFFFF'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
          }
          
          // draw_a_scaled_picture
          ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
          
          // convert_to_arraybuffer
          canvas.toBlob((blob) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = () => reject(new Error('Failed to convert image data'))
            reader.readAsArrayBuffer(blob)
          }, `image/${format}`)
          
          URL.revokeObjectURL(url)
        } catch (error) {
          URL.revokeObjectURL(url)
          reject(error)
        }
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Unable to load image'))
      }
      
      img.src = url
    })
  }

  /**
   * check_whether_the_file_is GIF format
   * @param {File} file - file_object
   * @returns {boolean} is_it GIF format
   */
  isGifFile(file) {
    // examine MIME type
    if (file.type === 'image/gif') {
      return true
    }
    
    // check_file_extension
    const extension = file.name.split('.').pop().toLowerCase()
    return extension === 'gif'
  }

  /**
   * get_image_size_information
   * @param {ArrayBuffer|File} imageData - image_data
   * @returns {Promise<Object>} image_size_information {width, height}
   */
  async getImageDimensions(imageData) {
    return new Promise((resolve, reject) => {
      const blob = imageData instanceof File ? imageData : new Blob([imageData])
      const url = URL.createObjectURL(blob)
      const img = new Image()
      
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({
          width: img.width,
          height: img.height
        })
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Unable to get image dimensions'))
      }
      
      img.src = url
    })
  }

  /*
*
   * convert_pictures_to_raw_data_in_rgb565_format
   * @param {ArrayBuffer} imageData - image_data
* @returns {Promise<ArrayBuffer>} RGB565 raw data
*/
  async convertImageToRgb565(imageData) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([imageData])
      const url = URL.createObjectURL(blob)
      const img = new Image()
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          
          canvas.width = this.config?.chip?.display?.width || 320
          canvas.height = this.config?.chip?.display?.height || 240
          
          // use cover pattern_drawing_pictures，keep_proportions_and_display_centered
          const imgAspectRatio = img.width / img.height
          const canvasAspectRatio = canvas.width / canvas.height
          
          let drawWidth, drawHeight, offsetX, offsetY
          
          if (imgAspectRatio > canvasAspectRatio) {
            // picture_is_wider, scale_by_height (cover effect)
            drawHeight = canvas.height
            drawWidth = canvas.height * imgAspectRatio
            offsetX = (canvas.width - drawWidth) / 2
            offsetY = 0
          } else {
            // picture_is_taller，scale_by_width (cover effect)
            drawWidth = canvas.width
            drawHeight = canvas.width / imgAspectRatio
            offsetX = 0
            offsetY = (canvas.height - drawHeight) / 2
          }
          
          // draw_image_to_canvas，use_cover_mode_to_maintain_proportions_and_center
          ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
          
          // get_pixel_data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const pixels = imageData.data
          
          // convert_to_rgb565_format
          const rgb565Data = new ArrayBuffer(canvas.width * canvas.height * 2)
          const rgb565View = new Uint16Array(rgb565Data)
          
          for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i] >> 3      // 5 bits red
            const g = pixels[i + 1] >> 2  // 6 bit green
            const b = pixels[i + 2] >> 3  // 5 bits blue
            
            rgb565View[i / 4] = (r << 11) | (g << 5) | b
          }
          
          // LVGL constant_definition
          const LV_IMAGE_HEADER_MAGIC = 0x19  // LVGL image header magic number
          const LV_COLOR_FORMAT_RGB565 = 0x12 // RGB565 color format
          
          // calculate_stride（bytes_per_line）
          const stride = canvas.width * 2  // RGB565 2 bytes per pixel
          
          // create_a_header_conforming_to_the_lv_image_dsc_t_structure
          const headerSize = 28  // lv_image_dsc_t structure size: header(12) + data_size(4) + data(4) + reserved(4) + reserved_2(4) = 28 bytes
          const totalSize = headerSize + rgb565Data.byteLength
          const finalData = new ArrayBuffer(totalSize)
          const finalView = new Uint8Array(finalData)
          const headerView = new DataView(finalData)
          
          let offset = 0
          
          // lv_image_header_t structure (16 bytes)
          // magic: 8 bits, cf: 8 bits, flags: 16 bits (var_4_bytes_in_total)
          const headerWord1 = (0 << 24) | (0 << 16) | (LV_COLOR_FORMAT_RGB565 << 8) | LV_IMAGE_HEADER_MAGIC
          headerView.setUint32(offset, headerWord1, true)
          offset += 4
          
          // w: 16 bits, h: 16 bits (var_4_bytes_in_total)
          const sizeWord = (canvas.height << 16) | canvas.width

          headerView.setUint32(offset, sizeWord, true)  
          offset += 4
          
          // stride: 16 bits, reserved_2: 16 bits (var_4_bytes_in_total)
          const strideWord = (0 << 16) | stride
          headerView.setUint32(offset, strideWord, true)
          offset += 4
          
          // lv_image_dsc_t remaining fields
          // data_size: 32 bits (4 bytes)
          headerView.setUint32(offset, rgb565Data.byteLength, true)
          offset += 4
          
          // data pointer occupancy (4 bytes, in_actual_use_it_will_point_to_the_data_part)
          headerView.setUint32(offset, headerSize, true)  // relative_offset
          offset += 4
          
          // reserved (4 bytes)
          headerView.setUint32(offset, 0, true)
          offset += 4
          
          // reserved_2 (4 bytes)
          headerView.setUint32(offset, 0, true)
          offset += 4
          
          // copy_rgb565_data_to_the_back_of_the_header
          finalView.set(new Uint8Array(rgb565Data), headerSize)
          
          URL.revokeObjectURL(url)
          resolve(finalData)
        } catch (error) {
          URL.revokeObjectURL(url)
          reject(error)
        }
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Unable to load image'))
      }
      
      img.src = url
    })
  }

  /**
   * clean_up_temporary_resources
   */
  cleanup() {
    this.resources.clear()
    this.tempFiles = []
    this.convertedFonts.clear()
    this.wakenetPacker.clear()
    this.spiffsGenerator.clear()
    this.gifScaler.dispose() // clean_up WasmGifScaler resource
  }

  /**
   * clean_all_stored_data（restart_function）
   * @returns {Promise<void>}
   */
  async clearAllStoredData() {
    try {
      await this.configStorage.clearAll()
      this.cleanup()
      console.log('All stored data cleared')
    } catch (error) {
      console.error('Failed to clear stored data:', error)
      throw error
    }
  }

  /**
   * get_storage_status_information
   * @returns {Promise<Object>} store_status_information
   */
  async getStorageStatus() {
    try {
      const storageInfo = await this.configStorage.getStorageInfo()
      const hasConfig = await this.configStorage.hasStoredConfig()
      
      return {
        hasStoredData: hasConfig,
        storageInfo,
        autoSaveEnabled: this.autoSaveEnabled
      }
    } catch (error) {
      console.error('Failed to get storage status:', error)
      return {
        hasStoredData: false,
        storageInfo: null,
        autoSaveEnabled: this.autoSaveEnabled
      }
    }
  }

  /**
   * enable/disable_autosave
   * @param {boolean} enabled - whether_to_enable
   */
  setAutoSave(enabled) {
    this.autoSaveEnabled = enabled
    console.log(`Auto-save ${enabled ? 'enabled' : 'disabled'}`)
  }

  /**
   * get_a_list_of_resources_for_display
   * @returns {Array} resource_list
   */
  getResourceSummary() {
    const summary = []
    const resources = this.preparePackageResources()
    
    // statistics_of_various_resources
    const counts = {
      wakeword: 0,
      font: 0, 
      emoji: 0,
      background: 0
    }
    
    resources.files.forEach(file => {
      counts[file.type] = (counts[file.type] || 0) + 1
      
      let description = ''
      switch (file.type) {
        case 'wakeword':
          description = `Wakeword model: ${file.name} (${file.modelType})`
          break
        case 'font':
          if (file.config) {
            description = `Custom font: size ${file.config.size}px, BPP ${file.config.bpp}`
          } else {
            description = `Preset font: ${file.source}`
          }
          break
        case 'emoji':
          description = `Emoji: ${file.name} (${file.size.width}x${file.size.height})`
          break
        case 'background':
          description = `${file.mode === 'light' ? 'Light' : 'Dark'} mode background`
          break
      }
      
      summary.push({
        type: file.type,
        filename: file.filename,
        description
      })
    })
    
    return {
      files: summary,
      counts,
      totalFiles: summary.length,
      indexJson: resources.indexJson
    }
  }
}

export default AssetsBuilder

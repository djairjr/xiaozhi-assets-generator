/**
 * ConfigStorage kind
 * for_managing_configuration_and_files IndexedDB storage
 * 
 * main_functions：
 * - store_and_restore_user_configuration
 * - store_and_restore_useruploaded_files
 * - provides_the_function_of_clearing_configuration
 */

class ConfigStorage {
  constructor() {
    this.dbName = 'XiaozhiConfigDB'
    this.version = 1
    this.db = null
    this.initialized = false
  }

  /**
   * initialization IndexedDB
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized && this.db) {
      return
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => {
        console.error('IndexedDB 初始化失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        this.initialized = true
        console.log('IndexedDB 初始化成功')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result

        // create_configuration_storage_table
        if (!db.objectStoreNames.contains('configs')) {
          const configStore = db.createObjectStore('configs', { keyPath: 'key' })
          configStore.createIndex('timestamp', 'timestamp', { unique: false })
        }

        // create_file_storage_table
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'id' })
          fileStore.createIndex('type', 'type', { unique: false })
          fileStore.createIndex('timestamp', 'timestamp', { unique: false })
        }

        // create_temporary_storage_table（for_converted_fonts_etc）
        if (!db.objectStoreNames.contains('temp_data')) {
          const tempStore = db.createObjectStore('temp_data', { keyPath: 'key' })
          tempStore.createIndex('type', 'type', { unique: false })
          tempStore.createIndex('timestamp', 'timestamp', { unique: false })
        }

        console.log('IndexedDB 表结构创建完成')
      }
    })
  }

  /**
   * save_configuration_to IndexedDB
   * @param {Object} config - complete_configuration_object
   * @returns {Promise<void>}
   */
  async saveConfig(config) {
    if (!this.initialized) {
      await this.initialize()
    }

    const sanitizedConfig = this.sanitizeConfigForStorage(config)

    const configData = {
      key: 'current_config',
      config: sanitizedConfig, // deep_copy_and_strip_out_nonserializable_fields
      timestamp: Date.now()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['configs'], 'readwrite')
      const store = transaction.objectStore('configs')
      const request = store.put(configData)

      request.onerror = () => {
        console.error('保存配置失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        console.log('配置已保存到 IndexedDB')
        resolve()
      }
    })
  }

  /**
   * generate_configuration_objects_that_can_be_safely_stored
   * - File/Blob wait_for_nonserializable_fields_to_be_uniformly_set_to null
   * - reserve images key，so_that_subsequent_key_names_can_be_restored_from_storage
   */
  sanitizeConfigForStorage(config) {
    const cloned = JSON.parse(JSON.stringify(config || {}))

    try {
      // font_file
      if (cloned?.theme?.font?.type === 'custom') {
        if (!cloned.theme.font.custom) cloned.theme.font.custom = {}
        cloned.theme.font.custom.file = null
      }

      // expression_pictures（support_new hash remove_duplicate_structures）
      if (cloned?.theme?.emoji?.type === 'custom') {
        if (!cloned.theme.emoji.custom) cloned.theme.emoji.custom = {}
        
        // retain_the_old_structure images（set_to null）
        const images = cloned.theme.emoji?.custom?.images || {}
        const sanitizedImages = {}
        Object.keys(images).forEach((k) => {
          sanitizedImages[k] = null
        })
        cloned.theme.emoji.custom.images = sanitizedImages
        
        // keep_the_new_structure emotionMap（emotion -> hash mapping）
        if (cloned.theme.emoji.custom.emotionMap) {
          // emotionMap contains_only_string_maps，can_be_retained_directly
          // no_processing_required，because_it_does_not_contain File object
        }
        
        // clean_up fileMap（hash -> File mapping），will File the_object_is_set_to null
        if (cloned.theme.emoji.custom.fileMap) {
          const fileMap = cloned.theme.emoji.custom.fileMap
          const sanitizedFileMap = {}
          Object.keys(fileMap).forEach((hash) => {
            sanitizedFileMap[hash] = null
          })
          cloned.theme.emoji.custom.fileMap = sanitizedFileMap
        }
      }

      // background_image
      if (cloned?.theme?.skin?.light) {
        cloned.theme.skin.light.backgroundImage = null
      }
      if (cloned?.theme?.skin?.dark) {
        cloned.theme.skin.dark.backgroundImage = null
      }
    } catch (e) {
      // ignore_cleanup_exceptions，return_the_cloned_object
    }

    return cloned
  }

  /**
   * from IndexedDB restore_configuration
   * @returns {Promise<Object|null>} configuration_data_or_null
   */
  async loadConfig() {
    if (!this.initialized) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['configs'], 'readonly')
      const store = transaction.objectStore('configs')
      const request = store.get('current_config')

      request.onerror = () => {
        console.error('加载配置失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        const result = request.result
        if (result) {
          console.log('从 IndexedDB 恢复配置成功')
          resolve({
            config: result.config,
            timestamp: result.timestamp
          })
        } else {
          resolve(null)
        }
      }
    })
  }

  /**
   * save_file_to IndexedDB
   * @param {string} id - file_id
   * @param {File} file - file_object
   * @param {string} type - file_type (font, emoji, background)
   * @param {Object} metadata - additional_metadata
   * @returns {Promise<void>}
   */
  async saveFile(id, file, type, metadata = {}) {
    if (!this.initialized) {
      await this.initialize()
    }

    // convert_file_to ArrayBuffer for_storage
    const arrayBuffer = await this.fileToArrayBuffer(file)

    // make_sure metadata can_be_cloned_structured（remove Proxy/Ref/loop_etc）
    let safeMetadata = {}
    try {
      safeMetadata = metadata ? JSON.parse(JSON.stringify(metadata)) : {}
    } catch (e) {
      // fallback_to_shallow_copy_of_pure_object
      safeMetadata = { ...metadata }
    }

    const fileData = {
      id,
      type,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      lastModified: file.lastModified,
      data: arrayBuffer,
      metadata: safeMetadata,
      timestamp: Date.now()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['files'], 'readwrite')
      const store = transaction.objectStore('files')
      const request = store.put(fileData)

      request.onerror = () => {
        console.error('保存文件失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        console.log(`document ${file.name} saved_to IndexedDB`)
        resolve()
      }
    })
  }

  /**
   * from IndexedDB load_file
   * @param {string} id - file_id
   * @returns {Promise<File|null>} file_object_or_null
   */
  async loadFile(id) {
    if (!this.initialized) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['files'], 'readonly')
      const store = transaction.objectStore('files')
      const request = store.get(id)

      request.onerror = () => {
        console.error('加载文件失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        const result = request.result
        if (result) {
          // will ArrayBuffer convert_back File object
          const blob = new Blob([result.data], { type: result.mimeType })
          const file = new File([blob], result.name, {
            type: result.mimeType,
            lastModified: result.lastModified
          })

          // add_additional_metadata
          file.storedId = result.id
          file.storedType = result.type
          file.storedMetadata = result.metadata
          file.storedTimestamp = result.timestamp

          console.log(`document ${result.name} from IndexedDB recovery_successful`)
          resolve(file)
        } else {
          resolve(null)
        }
      }
    })
  }

  /**
   * get_all_files_of_a_specified_type
   * @param {string} type - file_type
   * @returns {Promise<Array>} file_list
   */
  async getFilesByType(type) {
    if (!this.initialized) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['files'], 'readonly')
      const store = transaction.objectStore('files')
      const index = store.index('type')
      const request = index.getAll(type)

      request.onerror = () => {
        console.error('获取文件列表失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        const results = request.result || []
        const files = results.map(result => {
          const blob = new Blob([result.data], { type: result.mimeType })
          const file = new File([blob], result.name, {
            type: result.mimeType,
            lastModified: result.lastModified
          })

          file.storedId = result.id
          file.storedType = result.type
          file.storedMetadata = result.metadata
          file.storedTimestamp = result.timestamp

          return file
        })

        resolve(files)
      }
    })
  }

  /**
   * save_temporary_data（such_as_converted_fonts_etc）
   * @param {string} key - data_key
   * @param {ArrayBuffer} data - data
   * @param {string} type - data_type
   * @param {Object} metadata - metadata
   * @returns {Promise<void>}
   */
  async saveTempData(key, data, type, metadata = {}) {
    if (!this.initialized) {
      await this.initialize()
    }

    const tempData = {
      key,
      type,
      data,
      metadata,
      timestamp: Date.now()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['temp_data'], 'readwrite')
      const store = transaction.objectStore('temp_data')
      const request = store.put(tempData)

      request.onerror = () => {
        console.error('保存临时数据失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        console.log(`temporary_data ${key} saved`)
        resolve()
      }
    })
  }

  /**
   * load_temporary_data
   * @param {string} key - data_key
   * @returns {Promise<Object|null>} temporary_data_or_null
   */
  async loadTempData(key) {
    if (!this.initialized) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['temp_data'], 'readonly')
      const store = transaction.objectStore('temp_data')
      const request = store.get(key)

      request.onerror = () => {
        console.error('加载临时数据失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        const result = request.result
        resolve(result || null)
      }
    })
  }

  /**
   * clear_all_stored_data
   * @returns {Promise<void>}
   */
  async clearAll() {
    if (!this.initialized) {
      await this.initialize()
    }

    const storeNames = ['configs', 'files', 'temp_data']
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeNames, 'readwrite')
      let completedStores = 0
      let hasError = false

      const checkComplete = () => {
        completedStores++
        if (completedStores === storeNames.length) {
          if (hasError) {
            reject(new Error('清空部分数据时出现错误'))
          } else {
            console.log('所有存储数据已清空')
            resolve()
          }
        }
      }

      storeNames.forEach(storeName => {
        const store = transaction.objectStore(storeName)
        const request = store.clear()

        request.onerror = () => {
          console.error(`clear ${storeName} fail:`, request.error)
          hasError = true
          checkComplete()
        }

        request.onsuccess = () => {
          console.log(`${storeName} cleared`)
          checkComplete()
        }
      })
    })
  }

  /**
   * delete_specified_file
   * @param {string} id - file_id
   * @returns {Promise<void>}
   */
  async deleteFile(id) {
    if (!this.initialized) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['files'], 'readwrite')
      const store = transaction.objectStore('files')
      const request = store.delete(id)

      request.onerror = () => {
        console.error('删除文件失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        console.log(`document ${id} deleted`)
        resolve()
      }
    })
  }

  /**
   * get_storage_usage
   * @returns {Promise<Object>} store_statistics
   */
  async getStorageInfo() {
    if (!this.initialized) {
      await this.initialize()
    }

    const storeNames = ['configs', 'files', 'temp_data']
    const info = {}

    for (const storeName of storeNames) {
      const count = await new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readonly')
        const store = transaction.objectStore(storeName)
        const request = store.count()

        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)
      })

      info[storeName] = { count }
    }

    // get_the_time_when_the_configuration_was_last_saved
    const configData = await this.loadConfig()
    info.lastSaved = configData ? new Date(configData.timestamp) : null

    return info
  }

  /**
   * check_if_there_is_a_stored_configuration
   * @returns {Promise<boolean>}
   */
  async hasStoredConfig() {
    try {
      const config = await this.loadConfig()
      return config !== null
    } catch (error) {
      console.error('检查存储配置时出错:', error)
      return false
    }
  }

  /**
   * convert_file_to ArrayBuffer
   * @param {File} file - file_object
   * @returns {Promise<ArrayBuffer>}
   */
  fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('读取文件失败'))
      reader.readAsArrayBuffer(file)
    })
  }

  /**
   * close_database_connection
   */
  close() {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initialized = false
      console.log('IndexedDB 连接已关闭')
    }
  }
}

// create_a_singleton_instance
const configStorage = new ConfigStorage()

export default configStorage

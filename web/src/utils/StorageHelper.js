/**
 * StorageHelper tools
 * provide_convenient_file_storage_functions_for_each_component
 */

import configStorage from './ConfigStorage.js'

class StorageHelper {
  /**
   * provides_autosave_functionality_for_font_files
   * @param {File} file - font_file
   * @param {Object} config - font_configuration
   * @returns {Promise<void>}
   */
  static async saveFontFile(file, config = {}) {
    if (file) {
      const key = 'custom_font'
      try {
        await configStorage.saveFile(key, file, 'font', {
          size: config.size || 20,
          bpp: config.bpp || 4,
          charset: config.charset || 'deepseek'
        })
        console.log(`font_file_saved: ${file.name}`)
      } catch (error) {
        console.warn(`failed_to_save_font_file: ${file.name}`, error)
      }
    }
  }

  /**
   * provide_automatic_saving_function_for_emoticon_files
   * @param {string} emojiName - expression_name_or_file_hash（if_it_starts_with_hash_）
   * @param {File} file - emoticon_file
   * @param {Object} config - expression_configuration
   * @returns {Promise<void>}
   */
  static async saveEmojiFile(emojiName, file, config = {}) {
    if (file && emojiName) {
      // if emojiName already_with hash_ beginning（new_deduplication_structure），use_directly
      // otherwise_add emoji_ prefix（old_structure，backwards_compatible）
      const key = emojiName.startsWith('hash_') ? emojiName : `emoji_${emojiName}`
      
      try {
        const width = config?.size?.width ?? 64
        const height = config?.size?.height ?? 64

        // pass_in_a_normal_object_that_can_be_cloned，avoid Vue Proxy
        await configStorage.saveFile(key, file, 'emoji', {
          name: emojiName,
          size: { width, height },
          format: config?.format,
          emotions: config?.emotions  // new：record_the_list_of_expressions_using_this_file
        })
        console.log(`emoticon_file_saved: ${key} - ${file.name}`)
      } catch (error) {
        console.warn(`failed_to_save_emoticon_file: ${emojiName}`, error)
      }
    }
  }

  /*
*
   * provides_autosave_functionality_for_background_files
* @param {string} mode - model ('light' or 'dark')
   * @param {File} file - background_document
   * @param {Object} config - background_configuration
   * @returns {Promise<void>}
*/
  static async saveBackgroundFile(mode, file, config = {}) {
    if (file && mode) {
      const key = `background_${mode}`
      try {
        let safeConfig = {}
        try {
          safeConfig = config ? JSON.parse(JSON.stringify(config)) : {}
        } catch (e) {
          safeConfig = { ...config }
        }

        await configStorage.saveFile(key, file, 'background', {
          mode,
          ...safeConfig
        })
        console.log(`background_file_saved: ${mode} - ${file.name}`)
      } catch (error) {
        console.warn(`failed_to_save_background_file: ${mode}`, error)
      }
    }
  }

  /**
   * restore_font_files
   * @returns {Promise<File|null>}
   */
  static async restoreFontFile() {
    try {
      return await configStorage.loadFile('custom_font')
    } catch (error) {
      console.warn('恢复字体文件失败:', error)
      return null
    }
  }

  /**
   * recover_emoticon_files
   * @param {string} emojiName - expression_name_or_file_hash（if_it_starts_with_hash_）
   * @returns {Promise<File|null>}
   */
  static async restoreEmojiFile(emojiName) {
    if (!emojiName) return null

    try {
      // if emojiName already_with hash_ beginning（new_deduplication_structure），use_directly
      // otherwise_add emoji_ prefix（old_structure，backwards_compatible）
      const key = emojiName.startsWith('hash_') ? emojiName : `emoji_${emojiName}`
      return await configStorage.loadFile(key)
    } catch (error) {
      console.warn(`failed_to_restore_emoticon_files: ${emojiName}`, error)
      return null
    }
  }

  /*
*
   * recover_background_files
* @param {string} mode - model ('light' or 'dark')
   * @returns {Promise<File|null>}
*/
  static async restoreBackgroundFile(mode) {
    if (!mode) return null

    try {
      const key = `background_${mode}`
      return await configStorage.loadFile(key)
    } catch (error) {
      console.warn(`failed_to_restore_background_file: ${mode}`, error)
      return null
    }
  }

  /**
   * delete_font_files
   * @returns {Promise<void>}
   */
  static async deleteFontFile() {
    try {
      await configStorage.deleteFile('custom_font')
      console.log('字体文件已删除')
    } catch (error) {
      console.warn('删除字体文件失败:', error)
    }
  }

  /**
   * delete_emoticon_files
   * @param {string} emojiName - expression_name_or_file_hash（if_it_starts_with_hash_）
   * @returns {Promise<void>}
   */
  static async deleteEmojiFile(emojiName) {
    if (!emojiName) return

    try {
      // if emojiName already_with hash_ beginning（new_deduplication_structure），use_directly
      // otherwise_add emoji_ prefix（old_structure，backwards_compatible）
      const key = emojiName.startsWith('hash_') ? emojiName : `emoji_${emojiName}`
      await configStorage.deleteFile(key)
      console.log(`emoticon_file_deleted: ${key}`)
    } catch (error) {
      console.warn(`failed_to_delete_emoticon_file: ${emojiName}`, error)
    }
  }

  /*
*
   * delete_background_files
* @param {string} mode - model ('light' or 'dark')
   * @returns {Promise<void>}
*/
  static async deleteBackgroundFile(mode) {
    if (!mode) return

    try {
      const key = `background_${mode}`
      await configStorage.deleteFile(key)
      console.log(`background_file_deleted: ${mode}`)
    } catch (error) {
      console.warn(`failed_to_delete_background_file: ${mode}`, error)
    }
  }

  /**
   * get_file_storage_information
   * @returns {Promise<Object>}
   */
  static async getStorageInfo() {
    try {
      return await configStorage.getStorageInfo()
    } catch (error) {
      console.warn('获取存储信息失败:', error)
      return {
        configs: { count: 0 },
        files: { count: 0 },
        temp_data: { count: 0 },
        lastSaved: null
      }
    }
  }

  /**
   * clean_all_file_storage
   * @returns {Promise<void>}
   */
  static async clearAllFiles() {
    try {
      await configStorage.clearAll()
      console.log('所有存储文件已清理')
    } catch (error) {
      console.warn('清理存储文件失败:', error)
      throw error
    }
  }
}

export default StorageHelper

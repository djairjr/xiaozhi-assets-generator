/*
*
 * WakenetModelPacker kind
 * imitate pack_model.py function，used_to_package_the_wake_word_model_on_the_browser_side
 * 
 * notice：fixed_compatibility_issues_with_python_versions：
* - use_ascii_encoding_instead_of_utf-8 encoding
 * - ensure_that_littleendian_integer_formats_are_consistent
 * - remove_redundant_string_replacement_operations
 * 
 * packaging_format：
 * {
* model_num: int (4 bytes)
 *     model1_info: model_info_t
 *     model2_info: model_info_t
 *     ...
* model1 data
* model2 data
 *     ...
 * }
 * 
* model_info_t format:
 * {
* model_name: char[32] (32 bytes)
* file_number: int (4 bytes)
* file1_name: char[32] (32 bytes)
* file1_start: int (4 bytes)
* file1_len: int (4 bytes)
* file2_name: char[32] (32 bytes)
* file2_start: int (4 bytes)
* file2_len: int (4 bytes)
 *     ...
 * }
*/

class WakenetModelPacker {
  constructor() {
    this.models = new Map()
  }

  /**
   * add_model_file
   * @param {string} modelName - model_name
   * @param {string} fileName - file_name
   * @param {ArrayBuffer} fileData - file_data
   */
  addModelFile(modelName, fileName, fileData) {
    if (!this.models.has(modelName)) {
      this.models.set(modelName, new Map())
    }
    this.models.get(modelName).set(fileName, fileData)
  }

  /*
*
* Load model from_share/wakenet_model directory
   * @param {string} modelName - model_name (for_example: wn9s_nihaoxiaozhi)
   * @returns {Promise<boolean>} is_the_loading_successful
*/
  async loadModelFromShare(modelName) {
    try {
      // all_wakenet_models_use_the_same_filename
      const modelFiles = [
        '_MODEL_INFO_',
        'wn9_data',
        'wn9_index'
      ]

      let loadedFiles = 0
      for (const fileName of modelFiles) {
        try {
          const response = await fetch(`./static/wakenet_model/${modelName}/${fileName}`)
          if (response.ok) {
            const fileData = await response.arrayBuffer()
            this.addModelFile(modelName, fileName, fileData)
            loadedFiles++
          } else {
            console.warn(`unable_to_load_file: ${fileName}, status: ${response.status}`)
          }
        } catch (error) {
          console.warn(`failed_to_load_file: ${fileName}`, error)
        }
      }

      return loadedFiles === modelFiles.length
    } catch (error) {
      console.error(`failed_to_load_model: ${modelName}`, error)
      return false
    }
  }

  /**
   * pack_a_string_into_fixedlength_binary_data
   * mimics_the_python_version_of_struct_pack_string_behavior，use_ascii_encoding
   * @param {string} string - input_string
   * @param {number} maxLen - maximum_length
   * @returns {Uint8Array} packed_binary_data
   */
  packString(string, maxLen) {
    const bytes = new Uint8Array(maxLen)
    
    // use_ascii_encoding，keep_consistent_with_python_version
    // no_space_reserved_for_null_terminator，complete_use_of_maxlen_bytes
    const copyLen = Math.min(string.length, maxLen)
    
    for (let i = 0; i < copyLen; i++) {
      // use_charcodeat_to_get_the_ascii_code，only_take_the_lower_8_bits_to_ensure_compatibility
      bytes[i] = string.charCodeAt(i) & 0xFF
    }
    
    // remaining_bytes_remain_0（default_initialization_value）
    return bytes
  }

  /*
*
   * convert_32bit_integer_to_littleendian_byte_array
   * with_the_python_version_of_struct.pack('<I', value)be_consistent
   * @param {number} value - integer_value
* @returns {Uint8Array} 4-byte little-endian array
*/
  packUint32(value) {
    const bytes = new Uint8Array(4)
    bytes[0] = value & 0xFF          // lowest_byte (LSB)
    bytes[1] = (value >> 8) & 0xFF   // 
    bytes[2] = (value >> 16) & 0xFF  // 
    bytes[3] = (value >> 24) & 0xFF  // highest_byte (MSB)
    return bytes
  }

  /*
*
* package_all_models_as_srmodels.bin format
   * @returns {ArrayBuffer} packed_binary_data
*/
  packModels() {
    if (this.models.size === 0) {
      throw new Error('没有模型数据可打包')
    }

    // calculate_the_total_number_and_data_of_all_files
    let totalFileNum = 0
    const modelDataList = []
    
    // sort_by_model_name
    for (const [modelName, files] of Array.from(this.models.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      totalFileNum += files.size
      // sort_by_file_name，ensure_that_the_order_is_consistent_with_the_python_version
      const sortedFiles = Array.from(files.entries()).sort((a, b) => a[0].localeCompare(b[0]))
      modelDataList.push({
        name: modelName,
        files: sortedFiles
      })
    }

    // calculate_head_length: number_of_models(4) + each_model_information(32+4+number_of_files*(32+4+4))
    const modelNum = this.models.size
    let headerLen = 4 // model_num
    
    for (const model of modelDataList) {
      headerLen += 32 + 4 // model_name + file_number
      headerLen += model.files.length * (32 + 4 + 4) // of_each_file name + start + len
    }

    // create_output_buffer
    const totalSize = headerLen + Array.from(this.models.values())
      .reduce((total, files) => total + Array.from(files.values())
        .reduce((fileTotal, fileData) => fileTotal + fileData.byteLength, 0), 0)
    
    const output = new Uint8Array(totalSize)
    let offset = 0

    // number_of_written_models
    output.set(this.packUint32(modelNum), offset)
    offset += 4

    // write_model_information_header
    let dataOffset = headerLen
    
    for (const model of modelDataList) {
      // write_model_name
      output.set(this.packString(model.name, 32), offset)
      offset += 32
      
      // number_of_files_written
      output.set(this.packUint32(model.files.length), offset)
      offset += 4

      // information_written_to_each_file
      for (const [fileName, fileData] of model.files) {
        // file_name
        output.set(this.packString(fileName, 32), offset)
        offset += 32
        
        // file_starting_position
        output.set(this.packUint32(dataOffset), offset)
        offset += 4
        
        // file_length
        output.set(this.packUint32(fileData.byteLength), offset)
        offset += 4

        dataOffset += fileData.byteLength
      }
    }

    // write_file_data
    for (const model of modelDataList) {
      for (const [fileName, fileData] of model.files) {
        output.set(new Uint8Array(fileData), offset)
        offset += fileData.byteLength
      }
    }

    return output.buffer
  }

  /**
   * get_a_list_of_available_models
   * @returns {Promise<Array>} model_list
   */
  static async getAvailableModels() {
    try {
      // try_a_few_ways_to_get_a_list_of_models
      const wn9Models = [
        'wn9_alexa', 'wn9_astrolabe_tts', 'wn9_bluechip_tts2', 'wn9_computer_tts',
        'wn9_haixiaowu_tts', 'wn9_heyily_tts2', 'wn9_heyprinter_tts', 'wn9_heywanda_tts',
        'wn9_heywillow_tts', 'wn9_hiesp', 'wn9_hifairy_tts2', 'wn9_hijason_tts2',
        'wn9_hijolly_tts2', 'wn9_hijoy_tts', 'wn9_hilexin', 'wn9_hilili_tts',
        'wn9_himfive', 'wn9_himiaomiao_tts', 'wn9_hitelly_tts', 'wn9_hiwalle_tts2',
        'wn9_hixiaoxing_tts', 'wn9_jarvis_tts', 'wn9_linaiban_tts2', 'wn9_miaomiaotongxue_tts',
        'wn9_mycroft_tts', 'wn9_nihaobaiying_tts2', 'wn9_nihaodongdong_tts2', 'wn9_nihaomiaoban_tts2',
        'wn9_nihaoxiaoan_tts2', 'wn9_nihaoxiaoxin_tts', 'wn9_nihaoxiaoyi_tts2', 'wn9_nihaoxiaozhi',
        'wn9_nihaoxiaozhi_tts', 'wn9_sophia_tts', 'wn9_xiaoaitongxue', 'wn9_xiaobinxiaobin_tts',
        'wn9_xiaojianxiaojian_tts2', 'wn9_xiaokangtongxue_tts2', 'wn9_xiaolongxiaolong_tts',
        'wn9_xiaoluxiaolu_tts2', 'wn9_xiaomeitongxue_tts', 'wn9_xiaomingtongxue_tts2',
        'wn9_xiaosurou_tts2', 'wn9_xiaotexiaote_tts2', 'wn9_xiaoyaxiaoya_tts2', 'wn9_xiaoyutongxue_tts2'
      ]

      const wn9sModels = [
        'wn9s_alexa', 'wn9s_hiesp', 'wn9s_hijason', 'wn9s_hilexin', 'wn9s_nihaoxiaozhi'
      ]

      return {
        WakeNet9: wn9Models,
        WakeNet9s: wn9sModels
      }
    } catch (error) {
      console.error('获取模型列表失败:', error)
      return { WakeNet9: [], WakeNet9s: [] }
    }
  }

  /**
   * verify_that_the_model_name_is_valid
   * @param {string} modelName - model_name
   * @param {string} chipModel - chip_model
   * @returns {boolean} is_it_valid
   */
  static isValidModel(modelName, chipModel) {
    const isC3OrC6 = chipModel === 'esp32c3' || chipModel === 'esp32c6'
    
    if (isC3OrC6) {
      return modelName.startsWith('wn9s_')
    } else {
      return modelName.startsWith('wn9_')
    }
  }

  /**
   * clean_loaded_model_data
   */
  clear() {
    this.models.clear()
  }

  /**
   * get_loaded_model_statistics
   * @returns {Object} statistics
   */
  getStats() {
    let totalFiles = 0
    let totalSize = 0
    
    for (const files of this.models.values()) {
      totalFiles += files.size
      for (const fileData of files.values()) {
        totalSize += fileData.byteLength
      }
    }

    return {
      modelCount: this.models.size,
      fileCount: totalFiles,
      totalSize,
      models: Array.from(this.models.keys())
    }
  }

  /**
   * verify_packaging_format_compatibility
   * for_testing_consistency_with_python_version
   * @returns {Object} verification_results
   */
  validatePackingCompatibility() {
    // test_string_packaging
    const testString = "test_model"
    const packedString = this.packString(testString, 32)
    
    // testing_integer_packing
    const testInt = 0x12345678
    const packedInt = this.packUint32(testInt)
    
    return {
      stringPacking: {
        input: testString,
        output: Array.from(packedString).map(b => `0x${b.toString(16).padStart(2, '0')}`),
        isASCII: packedString.every((b, i) => i >= testString.length || b === testString.charCodeAt(i))
      },
      intPacking: {
        input: `0x${testInt.toString(16)}`,
        output: Array.from(packedInt).map(b => `0x${b.toString(16).padStart(2, '0')}`),
        isLittleEndian: packedInt[0] === 0x78 && packedInt[3] === 0x12
      }
    }
  }
}

export default WakenetModelPacker

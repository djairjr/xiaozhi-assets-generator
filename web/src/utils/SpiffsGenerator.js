/*
*
 * SpiffsGenerator kind
 * imitate spiffs_assets_gen.py function，used_to_generate_on_the_browser_side assets.bin document
 * 
 * file_format：
 * {
* total_files: int (4 bytes) // total_number_of_files
* checksum: int (4 bytes) // checksum
* combined_data_length: int (4 bytes) // total_length_of_data
 *     mmap_table: [                    // file_mapping_table
 *         {
* name: char[32] // file_name (32 bytes)
* size: int (4 bytes) // file_size
* offset: int (4 bytes) // file_offset
* width: short (2 bytes) // image_width
* height: short (2 bytes) // image_height
 *         }
 *         ...
 *     ]
 *     file_data: [                     // file_data
 *         0x5A 0x5A + file1_data      // add_the_0x5a5a_mark_in_front_of_each_file
 *         0x5A 0x5A + file2_data
 *         ...
 *     ]
 * }
*/
 */

class SpiffsGenerator {
  constructor() {
    this.files = []
    this.textEncoder = new TextEncoder()
  }

  /**
   * add_files
   * @param {string} filename - file_name
   * @param {ArrayBuffer} data - file_data
   * @param {Object} options - optional_parameters {width?, height?}
   */
  addFile(filename, data, options = {}) {
    if (filename.length > 32) {
      console.warn(`Filename "${filename}" exceeds 32 bytes and will be truncated`)
    }

    this.files.push({
      filename,
      data,
      size: data.byteLength,
      width: options.width || 0,
      height: options.height || 0
    })
  }

  /**
   * get_size_information_from_image_file
   * @param {ArrayBuffer} imageData - image_data
   * @returns {Promise<Object>} {width, height}
   */
  async getImageDimensions(imageData) {
    return new Promise((resolve) => {
      try {
        const blob = new Blob([imageData])
        const url = URL.createObjectURL(blob)
        const img = new Image()
        
        img.onload = () => {
          URL.revokeObjectURL(url)
          resolve({ width: img.width, height: img.height })
        }
        
        img.onerror = () => {
          URL.revokeObjectURL(url)
          resolve({ width: 0, height: 0 })
        }
        
        img.src = url
      } catch (error) {
        resolve({ width: 0, height: 0 })
      }
    })
  }

  /**
   * check_whether_it_is_a_special_image_format (.sjpg, .spng, .sqoi)
   * @param {string} filename - file_name
   * @param {ArrayBuffer} data - file_data
   * @returns {Object} {width, height}
   */
  parseSpecialImageFormat(filename, data) {
    const ext = filename.toLowerCase().split('.').pop()
    
    if (['.sjpg', '.spng', '.sqoi'].includes('.' + ext)) {
      try {
        // specially_formatted_header_structure：offset_by_14_bytes_are_the_width_and_height（var_2_bytes_each，little_endian）
        const view = new DataView(data)
        const width = view.getUint16(14, true)  // little_endian
        const height = view.getUint16(16, true) // little_endian
        return { width, height }
      } catch (error) {
        console.warn(`Failed to parse special image format: ${filename}`, error)
      }
    }
    
    return { width: 0, height: 0 }
  }

  /*
*
   * convert_32bit_integer_to_littleendian_byte_array
   * @param {number} value - integer_value
* @returns {Uint8Array} 4-byte little-endian array
*/
  packUint32(value) {
    const bytes = new Uint8Array(4)
    bytes[0] = value & 0xFF
    bytes[1] = (value >> 8) & 0xFF
    bytes[2] = (value >> 16) & 0xFF
    bytes[3] = (value >> 24) & 0xFF
    return bytes
  }

  /*
*
   * convert_16bit_integer_to_littleendian_byte_array
   * @param {number} value - integer_value
* @returns {Uint8Array} 2-byte little-endian array
*/
  packUint16(value) {
    const bytes = new Uint8Array(2)
    bytes[0] = value & 0xFF
    bytes[1] = (value >> 8) & 0xFF
    return bytes
  }

  /**
   * pack_a_string_into_fixedlength_binary_data
   * @param {string} string - input_string
   * @param {number} maxLen - maximum_length
   * @returns {Uint8Array} packed_binary_data
   */
  packString(string, maxLen) {
    const bytes = new Uint8Array(maxLen)
    const encoded = this.textEncoder.encode(string)
    
    // copy_string_data，make_sure_not_to_exceed_the_maximum_length
    const copyLen = Math.min(encoded.length, maxLen)
    bytes.set(encoded.slice(0, copyLen), 0)
    
    // the_remaining_bytes_are_padded_with_0
    return bytes
  }

  /*
*
   * calculate_checksum
   * @param {Uint8Array} data - data
* @returns {number} 16-bit checksum
*/
  computeChecksum(data) {
    let checksum = 0
    for (let i = 0; i < data.length; i++) {
      checksum += data[i]
    }
    return checksum & 0xFFFF
  }

  /**
   * sort_files
   * @param {Array} files - file_list
   * @returns {Array} sorted_file_list
   */
  sortFiles(files) {
    return files.slice().sort((a, b) => {
      const extA = a.filename.split('.').pop() || ''
      const extB = b.filename.split('.').pop() || ''
      
      if (extA !== extB) {
        return extA.localeCompare(extB)
      }
      
      const nameA = a.filename.replace(/\.[^/.]+$/, '')
      const nameB = b.filename.replace(/\.[^/.]+$/, '')
      return nameA.localeCompare(nameB)
    })
  }

  /**
   * generate assets.bin document
   * @param {Function} progressCallback - progress_callback_function
   * @returns {Promise<ArrayBuffer>} generated assets.bin data
   */
  async generate(progressCallback = null) {
    if (this.files.length === 0) {
      throw new Error('No files to package')
    }

    if (progressCallback) progressCallback(0, 'Starting to package files...')

    // sort_files
    const sortedFiles = this.sortFiles(this.files)
    const totalFiles = sortedFiles.length

    // process_file_information_and_obtain_image_dimensions
    const fileInfoList = []
    let mergedDataSize = 0

    for (let i = 0; i < sortedFiles.length; i++) {
      const file = sortedFiles[i]
      let width = file.width
      let height = file.height

      if (progressCallback) {
        progressCallback(10 + (i / totalFiles) * 30, `Processing file: ${file.filename}`)
      }

      // if_no_size_information_is_provided，try_to_get_it_automatically
      if (width === 0 && height === 0) {
        // check_special_image_formats_first
        const specialDimensions = this.parseSpecialImageFormat(file.filename, file.data)
        if (specialDimensions.width > 0 || specialDimensions.height > 0) {
          width = specialDimensions.width
          height = specialDimensions.height
        } else {
          // try_to_parse_as_a_normal_image
          const ext = file.filename.toLowerCase().split('.').pop()
          if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(ext)) {
            const dimensions = await this.getImageDimensions(file.data)
            width = dimensions.width
            height = dimensions.height
          }
        }
      }

      fileInfoList.push({
        filename: file.filename,
        data: file.data,
        size: file.size,
        offset: mergedDataSize,
        width,
        height
      })

      mergedDataSize += 2 + file.size // 2-byte prefix + file_data
    }

    if (progressCallback) progressCallback(40, 'Building file mapping table...')

    // build_mapping_table
    const mmapTableSize = totalFiles * (32 + 4 + 4 + 2 + 2) // name + size + offset + width + height
    const mmapTable = new Uint8Array(mmapTableSize)
    let mmapOffset = 0

    for (const fileInfo of fileInfoList) {
      // file_name (32 bytes)
      mmapTable.set(this.packString(fileInfo.filename, 32), mmapOffset)
      mmapOffset += 32

      // file_size (4 bytes)
      mmapTable.set(this.packUint32(fileInfo.size), mmapOffset)
      mmapOffset += 4

      // file_offset (4 bytes)
      mmapTable.set(this.packUint32(fileInfo.offset), mmapOffset)
      mmapOffset += 4

      // image_width (2 bytes)
      mmapTable.set(this.packUint16(fileInfo.width), mmapOffset)
      mmapOffset += 2

      // image_height (2 bytes)
      mmapTable.set(this.packUint16(fileInfo.height), mmapOffset)
      mmapOffset += 2
    }

    if (progressCallback) progressCallback(60, 'Merging file data...')

    // merge_file_data
    const mergedData = new Uint8Array(mergedDataSize)
    let mergedOffset = 0

    for (let i = 0; i < fileInfoList.length; i++) {
      const fileInfo = fileInfoList[i]
      
      if (progressCallback) {
        progressCallback(60 + (i / totalFiles) * 20, `Merging file: ${fileInfo.filename}`)
      }

      // add_0x5a5a_prefix
      mergedData[mergedOffset] = 0x5A
      mergedData[mergedOffset + 1] = 0x5A
      mergedOffset += 2

      // add_file_data
      mergedData.set(new Uint8Array(fileInfo.data), mergedOffset)
      mergedOffset += fileInfo.size
    }

    if (progressCallback) progressCallback(80, 'Computing checksum...')

    // compute_checksum_of_combined_data
    const combinedData = new Uint8Array(mmapTableSize + mergedDataSize)
    combinedData.set(mmapTable, 0)
    combinedData.set(mergedData, mmapTableSize)
    
    const checksum = this.computeChecksum(combinedData)
    const combinedDataLength = combinedData.length

    if (progressCallback) progressCallback(90, 'Building final file...')

    // build_final_output
    const headerSize = 4 + 4 + 4 // total_files + checksum + combined_data_length
    const totalSize = headerSize + combinedDataLength
    const finalData = new Uint8Array(totalSize)
    
    let offset = 0

    // total_number_of_files_written
    finalData.set(this.packUint32(totalFiles), offset)
    offset += 4

    // write_checksum
    finalData.set(this.packUint32(checksum), offset)
    offset += 4

    // write_combined_data_length
    finalData.set(this.packUint32(combinedDataLength), offset)
    offset += 4

    // write_combined_data
    finalData.set(combinedData, offset)

    if (progressCallback) progressCallback(100, 'Packaging completed')

    return finalData.buffer
  }

  /**
   * get_file_statistics
   * @returns {Object} statistics
   */
  getStats() {
    let totalSize = 0
    const fileTypes = new Map()

    for (const file of this.files) {
      totalSize += file.size
      
      const ext = file.filename.split('.').pop()?.toLowerCase() || 'unknown'
      fileTypes.set(ext, (fileTypes.get(ext) || 0) + 1)
    }

    return {
      fileCount: this.files.length,
      totalSize,
      fileTypes: Object.fromEntries(fileTypes),
      averageFileSize: this.files.length > 0 ? Math.round(totalSize / this.files.length) : 0
    }
  }

  /**
   * print_a_list_of_packed_files
   */
  printFileList() {
    console.log('=== Packaged File List ===')
    console.log(`Total files: ${this.files.length}`)

    if (this.files.length === 0) {
      console.log('No files available')
      return
    }

    // Print after sorting by extension and file name
    const sortedFiles = this.sortFiles(this.files)

    sortedFiles.forEach((file, index) => {
      const ext = file.filename.split('.').pop()?.toLowerCase() || 'unknown'
      const sizeKB = (file.size / 1024).toFixed(2)
      const dimensions = (file.width && file.height) ? `${file.width}x${file.height}` : 'N/A'

      console.log(`${String(index + 1).padStart(3, ' ')}. ${file.filename}`)
      console.log(`    Type: ${ext.toUpperCase()}`)
      console.log(`    Size: ${sizeKB} KB (${file.size} bytes)`)
      console.log(`    Dimensions: ${dimensions}`)
      console.log('')
    })

    // print_statistics
    const stats = this.getStats()
    console.log('=== File Statistics ===')
    console.log(`Total size: ${(stats.totalSize / 1024).toFixed(2)} KB`)
    console.log(`Average size: ${(stats.averageFileSize / 1024).toFixed(2)} KB`)
    console.log('File type distribution:')
    Object.entries(stats.fileTypes).forEach(([ext, count]) => {
      console.log(`  ${ext.toUpperCase()}: ${count} files`)
    })
  }

  /**
   * clean_file_list
   */
  clear() {
    this.files = []
  }
}

export default SpiffsGenerator

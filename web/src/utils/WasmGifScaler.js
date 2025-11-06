/**
 * WasmGifScaler kind
 * use gifsicle-wasm-browser conduct GIF image_scaling
 * 
 * main_functions：
 * - GIF image_zoom
 * - keep_aspect_ratio
 * - GIF optimize_compression
 * - multiple_zoom_modes
 */

import gifsicle from 'gifsicle-wasm-browser'

class WasmGifScaler {
  constructor(options = {}) {
    this.quality = options.quality || 10 // 1-200, lossy compression_quality
    this.debug = options.debug || false
    this.scalingMode = options.scalingMode || 'auto' // 'auto', 'fit', 'fill'
    this.optimize = options.optimize !== false // optimization_enabled_by_default
    this.optimizationLevel = options.optimizationLevel || 2 // 1-3, optimization_level
  }

  /**
   * zoom GIF picture
   * @param {File|Blob|ArrayBuffer} gifFile - GIF document
   * @param {Object} options - zoom_options
   * @param {number} options.maxWidth - maximum_width
   * @param {number} options.maxHeight - maximum_height
   * @param {boolean} options.keepAspectRatio - whether_to_maintain_aspect_ratio，default true
   * @param {boolean} options.optimize - optimize_or_not，default true
   * @param {number} options.lossy - lossy compression_quality (1-200)，use_instance_configuration_by_default
   * @param {number} options.loopCount - number_of_cycles，0 indicates_infinite_loop（default），-1 means_to_keep_it_as_it_is
   * @returns {Promise<Blob>} scaled GIF Blob
   */
  async scaleGif(gifFile, options = {}) {
    const {
      maxWidth,
      maxHeight,
      keepAspectRatio = true,
      optimize = this.optimize,
      lossy = this.quality,
      loopCount = 0  // default_infinite_loop
    } = options

    if (!maxWidth && !maxHeight) {
      throw new Error('必须指定 maxWidth or maxHeight')
    }

    try {
      // build resize order
      let resizeCmd
      if (keepAspectRatio) {
        // scale_to_maintain_aspect_ratio，use --resize-fit
        const width = maxWidth || '_'
        const height = maxHeight || '_'
        resizeCmd = `--resize-fit ${width}x${height}`
      } else {
        // force_zoom_to_specified_size，use --resize
        const width = maxWidth || '_'
        const height = maxHeight || '_'
        resizeCmd = `--resize ${width}x${height}!`
      }

      // build_a_complete gifsicle order
      const commandParts = []
      
      // add_to unoptimize make_sure_to_handle_it_correctly
      commandParts.push('-U')
      
      // add_to resize order
      commandParts.push(resizeCmd)
      
      // add_loop_count_setting（loopCount >= 0 effective_when，-1 indicates_not_setting）
      if (loopCount >= 0) {
        commandParts.push(`--loopcount=${loopCount}`)
      }
      
      // add_to lossy compression
      if (lossy && lossy > 0) {
        commandParts.push(`--lossy=${lossy}`)
      }
      
      // add_optimization
      if (optimize) {
        commandParts.push(`-O${this.optimizationLevel}`)
      }
      
      // input_and_output
      commandParts.push('1.gif')
      commandParts.push('-o /out/output.gif')
      
      const command = commandParts.join(' ')
      
      if (this.debug) {
        console.log('GIF 缩放命令:', command)
        console.log('输入文件大小:', gifFile.size || '未知')
      }

      // call gifsicle
      const result = await gifsicle.run({
        input: [{
          file: gifFile,
          name: '1.gif'
        }],
        command: [command]
      })

      if (!result || result.length === 0) {
        throw new Error('gifsicle processing_failed，未返回结果')
      }

      const outputFile = result[0]
      
      if (this.debug) {
        console.log('GIF 缩放完成')
        console.log('输出文件大小:', outputFile.size)
        if (gifFile.size) {
          const ratio = ((1 - outputFile.size / gifFile.size) * 100).toFixed(2)
          console.log(`compression_rate: ${ratio}%`)
        }
      }

      // convert_to Blob
      return new Blob([outputFile], { type: 'image/gif' })
      
    } catch (error) {
      console.error('GIF 缩放失败:', error)
      throw new Error(`GIF zoom_failed: ${error.message}`)
    }
  }

  /**
   * batch_scaling GIF picture
   * @param {Array} files - GIF file_array [{file, options}]
   * @returns {Promise<Array>} scaled GIF Blob array
   */
  async scaleGifBatch(files) {
    const results = []
    
    for (let i = 0; i < files.length; i++) {
      const { file, options } = files[i]
      try {
        const result = await this.scaleGif(file, options)
        results.push(result)
      } catch (error) {
        console.error(`batch_scaling ${i + 1} files_failed:`, error)
        results.push(null)
      }
    }
    
    return results
  }

  /**
   * optimization GIF（do_not_change_size）
   * @param {File|Blob|ArrayBuffer} gifFile - GIF document
   * @param {Object} options - optimization_options
   * @param {number} options.lossy - lossy compression_quality (1-200)
   * @param {number} options.level - optimization_level (1-3)
   * @param {number} options.loopCount - number_of_cycles，0 indicates_infinite_loop（default），-1 means_to_keep_it_as_it_is
   * @returns {Promise<Blob>} optimized GIF Blob
   */
  async optimizeGif(gifFile, options = {}) {
    const {
      lossy = this.quality,
      level = this.optimizationLevel,
      loopCount = 0  // default_infinite_loop
    } = options

    try {
      const commandParts = ['-U']
      
      // add_loop_count_setting
      if (loopCount >= 0) {
        commandParts.push(`--loopcount=${loopCount}`)
      }
      
      if (lossy && lossy > 0) {
        commandParts.push(`--lossy=${lossy}`)
      }
      
      commandParts.push(`-O${level}`)
      commandParts.push('1.gif')
      commandParts.push('-o /out/output.gif')
      
      const command = commandParts.join(' ')
      
      if (this.debug) {
        console.log('GIF 优化命令:', command)
      }

      const result = await gifsicle.run({
        input: [{
          file: gifFile,
          name: '1.gif'
        }],
        command: [command]
      })

      if (!result || result.length === 0) {
        throw new Error('gifsicle 优化失败')
      }

      return new Blob([result[0]], { type: 'image/gif' })
      
    } catch (error) {
      console.error('GIF 优化失败:', error)
      throw new Error(`GIF optimization_failed: ${error.message}`)
    }
  }

  /**
   * get GIF information
   * @param {File|Blob|ArrayBuffer} gifFile - GIF document
   * @returns {Promise<Object>} GIF information
   */
  async getGifInfo(gifFile) {
    try {
      const result = await gifsicle.run({
        input: [{
          file: gifFile,
          name: '1.gif'
        }],
        command: ['--info 1.gif -o /out/info.txt']
      })

      if (!result || result.length === 0) {
        throw new Error('无法获取 GIF 信息')
      }

      const infoFile = result[0]
      const infoText = await infoFile.text()
      
      // parse_message_text
      const info = this.parseGifInfo(infoText)
      
      return info
      
    } catch (error) {
      console.error('获取 GIF 信息失败:', error)
      // return_to_basic_information
      return {
        size: gifFile.size || 0,
        type: 'image/gif'
      }
    }
  }

  /**
   * parse GIF information_text
   * @param {string} infoText - gifsicle --info output_text
   * @returns {Object} parsed_information_object
   */
  parseGifInfo(infoText) {
    const info = {
      frames: 0,
      width: 0,
      height: 0,
      colors: 0,
      loopCount: 0
    }

    try {
      // Number of parsed frames
      const framesMatch = infoText.match(/(\d+) images?/)
      if (framesMatch) {
        info.frames = parseInt(framesMatch[1])
      }

      // parse_size
      const sizeMatch = infoText.match(/logical screen (\d+)x(\d+)/)
      if (sizeMatch) {
        info.width = parseInt(sizeMatch[1])
        info.height = parseInt(sizeMatch[2])
      }

      // parse_color_number
      const colorsMatch = infoText.match(/(\d+) colors/)
      if (colorsMatch) {
        info.colors = parseInt(colorsMatch[1])
      }

      // number_of_parsing_loops
      if (infoText.includes('loop forever')) {
        info.loopCount = 0
      } else {
        const loopMatch = infoText.match(/loop count (\d+)/)
        if (loopMatch) {
          info.loopCount = parseInt(loopMatch[1])
        }
      }
    } catch (error) {
      console.warn('解析 GIF 信息时出错:', error)
    }

    return info
  }

  /**
   * crop GIF
   * @param {File|Blob|ArrayBuffer} gifFile - GIF document
   * @param {Object} cropRect - crop_area {x, y, width, height}
   * @returns {Promise<Blob>} cropped GIF Blob
   */
  async cropGif(gifFile, cropRect) {
    const { x, y, width, height } = cropRect

    try {
      const command = [
        '-U',
        `--crop ${x},${y}+${width}x${height}`,
        '1.gif',
        '-o /out/output.gif'
      ].join(' ')

      if (this.debug) {
        console.log('GIF 裁剪命令:', command)
      }

      const result = await gifsicle.run({
        input: [{
          file: gifFile,
          name: '1.gif'
        }],
        command: [command]
      })

      if (!result || result.length === 0) {
        throw new Error('gifsicle 裁剪失败')
      }

      return new Blob([result[0]], { type: 'image/gif' })
      
    } catch (error) {
      console.error('GIF 裁剪失败:', error)
      throw new Error(`GIF cropping_failed: ${error.message}`)
    }
  }

  /**
   * clean_up_resources
   */
  dispose() {
    // gifsicle-wasm-browser no_special_cleanup_required
    if (this.debug) {
      console.log('WasmGifScaler disposed')
    }
  }

  /**
   * set_debug_mode
   * @param {boolean} enabled - whether_to_enable_debugging
   */
  setDebug(enabled) {
    this.debug = enabled
  }

  /**
   * set_compression_quality
   * @param {number} quality - compression_quality (1-200)
   */
  setQuality(quality) {
    if (quality < 1 || quality > 200) {
      throw new Error('质量参数必须在 1-200 之间')
    }
    this.quality = quality
  }

  /**
   * set_optimization_level
   * @param {number} level - optimization_level (1-3)
   */
  setOptimizationLevel(level) {
    if (level < 1 || level > 3) {
      throw new Error('优化级别必须在 1-3 之间')
    }
    this.optimizationLevel = level
  }
}

export default WasmGifScaler


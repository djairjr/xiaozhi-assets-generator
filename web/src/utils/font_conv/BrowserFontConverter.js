/**
 * BrowserFontConverter - complete_browserside_font_converter
 * based_on lv_font_conv the_core_logic_of，adapt_to_browser_environment
 */

import opentype from 'opentype.js'
import collect_font_data from './CollectFontData.js'
import AppError from './AppError.js'
import write_cbin from './writers/CBinWriter.js'

class BrowserFontConverter {
  constructor() {
    this.initialized = false
    this.supportedFormats = ['ttf', 'woff', 'woff2', 'otf']
    this.charsetCache = new Map() // cache_loaded_character_sets
  }

  /**
   * initialize_converter
   */
  async initialize() {
    if (this.initialized) return
    
    try {
      // check_if_dependencies_are_available
      if (typeof opentype === 'undefined') {
        throw new Error('opentype.js not loaded')
      }
      
      this.initialized = true
      console.log('BrowserFontConverter 初始化完成')
    } catch (error) {
      console.error('BrowserFontConverter initialization failed:', error)
      throw error
    }
  }

  /**
   * verify_font_files
   */
  validateFont(fontFile) {
    if (!fontFile) return false
    
    if (fontFile instanceof File) {
      const fileName = fontFile.name.toLowerCase()
      const fileType = fontFile.type.toLowerCase()
      
      const validExtension = this.supportedFormats.some(ext => 
        fileName.endsWith(`.${ext}`)
      )
      
      const validMimeType = [
        'font/ttf', 'font/truetype', 'application/x-font-ttf',
        'font/woff', 'font/woff2', 'application/font-woff',
        'font/otf', 'application/x-font-otf'
      ].some(type => fileType.includes(type))
      
      return validExtension || validMimeType
    }
    
    return fontFile instanceof ArrayBuffer && fontFile.byteLength > 0
  }

  /**
   * get_font_information
   */
  async getFontInfo(fontFile) {
    try {
      let buffer
      
      if (fontFile instanceof File) {
        buffer = await fontFile.arrayBuffer()
      } else if (fontFile instanceof ArrayBuffer) {
        buffer = fontFile
      } else {
        throw new Error('Unsupported font file type')
      }
      
      const font = opentype.parse(buffer)
      
      return {
        familyName: this.getLocalizedName(font.names.fontFamily) || 'Unknown',
        fullName: this.getLocalizedName(font.names.fullName) || 'Unknown',
        postScriptName: this.getLocalizedName(font.names.postScriptName) || 'Unknown',
        version: this.getLocalizedName(font.names.version) || 'Unknown',
        unitsPerEm: font.unitsPerEm,
        ascender: font.ascender,
        descender: font.descender,
        numGlyphs: font.numGlyphs,
        supported: true
      }
    } catch (error) {
      console.error('Failed to get font information:', error)
      return {
        familyName: 'Unknown',
        supported: false,
        error: error.message
      }
    }
  }

  /**
   * get_localized_name
   */
  getLocalizedName(nameObj) {
    if (!nameObj) return null
    
    // priority：chinese > english > first_available
    return nameObj['zh'] || nameObj['zh-CN'] || nameObj['en'] || 
           nameObj[Object.keys(nameObj)[0]]
  }

  /**
   * convert_font_to CBIN format
   */
  async convertToCBIN(options) {
    if (!this.initialized) {
      await this.initialize()
    }

    const {
      fontFile,
      fontName,
      fontSize = 20,
      bpp = 4,
      charset = 'deepseek',
      symbols = '',
      range = '',
      compression = false,
      lcd = false,
      lcd_v = false,
      progressCallback = null
    } = options

    if (!this.validateFont(fontFile)) {
      throw new AppError('不支持的字体文件格式')
    }

    try {
      if (progressCallback) progressCallback(0, 'Starting font processing...')

      // prepare_font_data
      let fontBuffer
      if (fontFile instanceof File) {
        fontBuffer = await fontFile.arrayBuffer()
      } else {
        fontBuffer = fontFile
      }

      if (progressCallback) progressCallback(10, 'Parsing font structure...')

      // build_character_ranges_and_symbols（support_for_loading_character_sets_from_files_using_the_asynchronous_version）
      const { ranges, charSymbols } = await this.parseCharacterInputAsync(charset, symbols, range)

      if (progressCallback) progressCallback(20, 'Preparing conversion parameters...')

      // build_conversion_parameters
      const convertArgs = {
        font: [{
          source_path: fontName || 'custom_font',
          source_bin: fontBuffer,
          ranges: [{ 
            range: ranges, 
            symbols: charSymbols 
          }],
          autohint_off: false,
          autohint_strong: false
        }],
        size: fontSize,
        bpp: bpp,
        lcd: lcd,
        lcd_v: lcd_v,
        no_compress: !compression,
        no_kerning: false,
        use_color_info: false,
        format: 'cbin',
        output: fontName || 'font'
      }

      if (progressCallback) progressCallback(30, 'Collecting font data...')

      // collect_font_data
      const fontData = await collect_font_data(convertArgs)

      if (progressCallback) progressCallback(70, 'Generating CBIN format...')

      // generate CBIN data
      const result = write_cbin(convertArgs, fontData)
      const outputName = convertArgs.output
      
      if (progressCallback) progressCallback(100, 'Conversion completed!')

      return result[outputName]

    } catch (error) {
      console.error('Font conversion failed:', error)
      throw new AppError(`Font conversion failed: ${error.message}`)
    }
  }

  /**
   * parse_character_input（character_set、symbol、scope）- asynchronous_version
   */
  async parseCharacterInputAsync(charset, symbols, range) {
    let ranges = []
    let charSymbols = symbols || ''

    // handle_default_character_sets
    if (charset && charset !== 'custom') {
      const presetChars = await this.getCharsetContentAsync(charset)
      charSymbols = presetChars + charSymbols
    }

    // deal_with Unicode scope
    if (range) {
      ranges = this.parseUnicodeRange(range)
    }

    return { ranges, charSymbols }
  }

  /**
   * parse_character_input（character_set、symbol、scope）- sync_version（backwards_compatible）
   */
  parseCharacterInput(charset, symbols, range) {
    let ranges = []
    let charSymbols = symbols || ''

    // handle_default_character_sets
    if (charset && charset !== 'custom') {
      const presetChars = this.getCharsetContent(charset)
      charSymbols = presetChars + charSymbols
    }

    // deal_with Unicode scope
    if (range) {
      ranges = this.parseUnicodeRange(range)
    }

    return { ranges, charSymbols }
  }


  /**
   * asynchronously_load_character_set_files
   */
  async loadCharsetFromFile(charset) {
    const charsetFiles = {
      latin: './static/charsets/latin1.txt',
      deepseek: './static/charsets/deepseek.txt',
      gb2312: './static/charsets/gb2312.txt'
    }
    
    const filePath = charsetFiles[charset]
    if (!filePath) {
      return null
    }
    
    try {
      const response = await fetch(filePath)
      if (!response.ok) {
        throw new Error(`Failed to load charset file: ${response.status}`)
      }
      
      const text = await response.text()
      // concatenate_the_characters_of_each_line_into_a_string，keep_all_characters（include_whitespace_characters）
      const characters = text.split('\n').join('')
      
      // cache_results
      this.charsetCache.set(charset, characters)
      return characters
    } catch (error) {
      console.error(`Failed to load charset ${charset}:`, error)
      return null
    }
  }

  /**
   * get_character_set_content（sync_method，for_cached_character_sets）
   */
  getCharsetContent(charset) {
    const charsets = {}
    
    // if_it_is_a_character_set_that_needs_to_be_loaded_from_a_file，check_cache_first
    if ((charset === 'latin' || charset === 'deepseek' || charset === 'gb2312') && this.charsetCache.has(charset)) {
      return this.charsetCache.get(charset)
    }
    
    // if_requested basic，redirect_to latin（backwards_compatible）
    if (charset === 'basic') {
      return this.getCharsetContent('latin')
    }
    
    // returns_empty_string_by_default，need_to_call_the_asynchronous_method_to_load_first
    return charsets[charset] || ''
  }

  /**
   * asynchronously_obtain_character_set_content
   */
  async getCharsetContentAsync(charset) {
    // if_requested basic，redirect_to latin（backwards_compatible）
    if (charset === 'basic') {
      charset = 'latin'
    }
    
    // if_the_character_set_is_cached，return_directly
    if (this.charsetCache.has(charset)) {
      return this.charsetCache.get(charset)
    }
    
    // for_character_sets_that_need_to_be_loaded_from_a_file
    if (charset === 'latin' || charset === 'deepseek' || charset === 'gb2312') {
      const loadedCharset = await this.loadCharsetFromFile(charset)
      if (loadedCharset) {
        return loadedCharset
      }
    }
    
    // fallback_to_synchronous_method
    return this.getCharsetContent(charset)
  }

  /**
   * parse Unicode range_string
   */
  parseUnicodeRange(rangeStr) {
    const ranges = []
    const parts = rangeStr.split(',')
    
    for (const part of parts) {
      const trimmed = part.trim()
      if (!trimmed) continue
      
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-')
        const startCode = this.parseHexOrDec(start)
        const endCode = this.parseHexOrDec(end)
        
        if (startCode !== null && endCode !== null) {
          ranges.push(startCode, endCode, startCode)
        }
      } else {
        const code = this.parseHexOrDec(trimmed)
        if (code !== null) {
          ranges.push(code, code, code)
        }
      }
    }
    
    return ranges
  }

  /**
   * parse_hexadecimal_or_decimal_numbers
   */
  parseHexOrDec(str) {
    const trimmed = str.trim()
    
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
      const parsed = parseInt(trimmed, 16)
      return isNaN(parsed) ? null : parsed
    }
    
    const parsed = parseInt(trimmed, 10)
    return isNaN(parsed) ? null : parsed
  }

  /**
   * estimate_output_size - asynchronous_version
   */
  async estimateSizeAsync(options) {
    const { fontSize = 20, bpp = 4, charset = 'latin', symbols = '', range = '' } = options
    
    // count_the_number_of_characters
    let charCount = symbols.length
    
    if (charset && charset !== 'custom') {
      const charsetContent = await this.getCharsetContentAsync(charset)
      charCount += charsetContent.length
    }
    
    if (range) {
      const ranges = this.parseUnicodeRange(range)
      for (let i = 0; i < ranges.length; i += 3) {
        charCount += ranges[i + 1] - ranges[i] + 1
      }
    }
    
    // number_of_characters_to_remove_duplicates（rough_estimate）
    charCount = Math.min(charCount, charCount * 0.8)
    
    // estimate_the_number_of_bytes_per_character
    const avgBytesPerChar = Math.ceil((fontSize * fontSize * bpp) / 8) + 40
    
    const estimatedSize = charCount * avgBytesPerChar + 2048 // add_header_and_index
    
    return {
      characterCount: Math.floor(charCount),
      avgBytesPerChar,
      estimatedSize,
      formattedSize: this.formatBytes(estimatedSize)
    }
  }

  /**
   * estimate_output_size - sync_version（backwards_compatible）
   */
  estimateSize(options) {
    const { fontSize = 20, bpp = 4, charset = 'latin', symbols = '', range = '' } = options
    
    // count_the_number_of_characters
    let charCount = symbols.length
    
    if (charset && charset !== 'custom') {
      const charsetContent = this.getCharsetContent(charset)
      charCount += charsetContent.length
    }
    
    if (range) {
      const ranges = this.parseUnicodeRange(range)
      for (let i = 0; i < ranges.length; i += 3) {
        charCount += ranges[i + 1] - ranges[i] + 1
      }
    }
    
    // number_of_characters_to_remove_duplicates（rough_estimate）
    charCount = Math.min(charCount, charCount * 0.8)
    
    // estimate_the_number_of_bytes_per_character
    const avgBytesPerChar = Math.ceil((fontSize * fontSize * bpp) / 8) + 40
    
    const estimatedSize = charCount * avgBytesPerChar + 2048 // add_header_and_index
    
    return {
      characterCount: Math.floor(charCount),
      avgBytesPerChar,
      estimatedSize,
      formattedSize: this.formatBytes(estimatedSize)
    }
  }

  /**
   * format_byte_size
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * clean_up_resources
   */
  cleanup() {
    // clean_up_possible_resource_references
    this.initialized = false
  }
}

// create_a_singleton_instance
const browserFontConverter = new BrowserFontConverter()

export default browserFontConverter
export { BrowserFontConverter }

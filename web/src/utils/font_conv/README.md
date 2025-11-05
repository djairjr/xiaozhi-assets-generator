# Font Converter - Browser font converter

This is a browser-side font converter based on the core logic of lv_font_conv, which supports converting TTF/WOFF font files to LVGL-compatible CBIN format.

## 📁 Module structure

```
font_conv/
├── AppError.js # Error handling class
├── Ranger.js # Character range manager
├── Utils.js # Collection of tool functions
├── FreeType.js # FreeType interface (ES6 version)
├── CollectFontData.js #Font data collection core module
├── BrowserFontConverter.js # Main converter interface
├── TestConverter.js # Test module
├── freetype_build/ # WebAssembly FreeType module
└── writers/
    ├── CBinWriter.js # CBIN format writer
    └── CBinFont.js # CBIN font class
```

## 🚀 How to use

### Basic usage

```javascript
import browserFontConverter from './font_conv/BrowserFontConverter.js'

//Initialize converter
await browserFontConverter.initialize()

//Convert font
const result = await browserFontConverter.convertToCBIN({
  fontFile: fontFile, // File object
  fontName: 'my_font',
  fontSize: 20,
  bpp: 4,
  charset: 'deepseek',
  progressCallback: (progress, message) => {
    console.log(`${progress}% - ${message}`)
  }
})

// result is an ArrayBuffer, containing font data in CBIN format
```

### Get font information

```javascript
const fontInfo = await browserFontConverter.getFontInfo(fontFile)
console.log('Font information:', fontInfo)
/*
{
  familyName: "Arial",
  fullName: "Arial Regular", 
  postScriptName: "ArialMT",
  version: "1.0",
  unitsPerEm: 2048,
  ascender: 1854,
  descender: -434,
  numGlyphs: 3200,
  supported: true
}
*/
```

### Size estimate

```javascript
const estimate = browserFontConverter.estimateSize({
  fontSize: 20,
  bpp: 4,
  charset: 'deepseek'
})

console.log('estimate result:', estimate)
/*
{
  characterCount: 7405,
  avgBytesPerChar: 65,
  estimatedSize: 481325,
  formattedSize: "470 KB"
}
*/
```

## ⚙️ Configuration options

### Conversion parameters

| Parameters | Type | Default value | Description |
|------|------|--------|------|
| `fontFile` | File/ArrayBuffer | - | Font file |
| `fontName` | string | 'font' | Output font name |
| `fontSize` | number | 20 | font size (8-80) |
| `bpp` | number | 4 | bit depth (1,2,4,8) |
| `charset` | string | 'basic' | Default character set |
| `symbols` | string | '' | Custom characters |
| `range` | string | '' | Unicode range |
| `compression` | boolean | true | enable compression |
| `lcd` | boolean | false | Horizontal sub-pixel rendering |
| `lcd_v` | boolean | false | Vertical sub-pixel rendering |

### Supported character sets

- `basic`: Basic ASCII character set (95 characters)
- `deepseek`: DeepSeek R1 commonly used Chinese characters (7405 characters)
- `gb2312`: GB2312 Chinese character set (7445 characters)

### Supported font formats

- TTF (TrueType Font)
- WOFF (Web Open Font Format)
- WOFF2 (Web Open Font Format 2.0)
- OTF (OpenType Font)

## 🔧 Technical implementation

### Core dependencies

1. **opentype.js**: used to parse font file structure
2. **WebAssembly FreeType**: used for font rendering and glyph generation
3. **Custom CBIN Writer**: Generate LVGL compatible format

### Conversion process

1. **Font Analysis**: Use opentype.js to analyze font files
2. **Glyph Rendering**: Rendering glyphs through FreeType WebAssembly
3. **Data collection**: Collect font data, measurement information, and kerning adjustment
4. **Format Conversion**: Convert data to CBIN format
5. **Output Generation**: Generate the final binary file

### Differences from the original version

| Features | Original lv_font_conv | Browser version |
|------|-------------------|------------|
| Running environment | Node.js | Browser |
| Module system | CommonJS | ES6 Modules |
| File System | fs module | File API |
| Buffer | Buffer | ArrayBuffer/Uint8Array |
| Command line | CLI interface | JavaScript API |

## 🧪 Test

```javascript
import { testFontConverter, testWithSampleFont } from './font_conv/TestConverter.js'

//Basic functional testing
await testFontConverter()

// Font file test
const result = await testWithSampleFont(fontFile)
console.log('Test result:', result)
```

## ⚠️ Notes

1. **WebAssembly support**: The browser needs to support WebAssembly
2. **Memory Limitation**: Large font files may consume more memory
3. **Processing time**: Conversion of complex fonts and large character sets takes a long time
4. **File size**: ft_render.wasm file is large (~2MB)
5. **Compatibility**: Requires modern browser support

## 📊 Performance indicators

| Character set size | Font size | BPP | Estimated conversion time | Output size |
|------------|------|-----|-------------|----------|
| 100 characters | 16px | 4 | < 1 second | ~10KB |
| 1000 characters | 20px | 4 | 2-5 seconds | ~100KB |
| 7000 characters | 20px | 4 | 10-30 seconds | ~500KB |

## 🐛 Known issues

1. **Font Verification**: Partially corrupted font files may cause crashes
2. **Memory Management**: Long-term use may cause memory leaks
3. **Error Handling**: WebAssembly errors are difficult to debug
4. **Character Set**: Some special characters may not render correctly

## 🔮 Future improvements

- [ ] supports more font formats
- [ ] Optimize memory usage
- [ ] Add font preview function
- [ ] supports font subsetting
- [ ] Add more compression options
- [ ] Support color fonts

---

*Based on the lv_font_conv project, adapted to the browser environment*

// CBIN format writer - ES6 version
// write_the_font_data_as CBIN format

import AppError from '../AppError.js'
import CBinFont from './CBinFont.js'

export default function write_cbin(args, fontData) {
  if (!args.output) throw new AppError('Output is required for "cbin" writer')

  const font = new CBinFont(fontData, args)
  const result = font.toCBin()

  return {
    [args.output]: result
  }
}

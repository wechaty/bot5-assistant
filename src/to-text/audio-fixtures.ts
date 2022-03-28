import {
  FileBox,
  FileBoxInterface,
}                   from 'file-box'

import path from 'path'
import { fileURLToPath } from 'url'

const getSilk = async () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))

  const EXPECTED_TEXT = '大可乐两个统一，冰红茶三箱。'
  const base64 = await FileBox.fromFile(path.join(
    __dirname,
    '../../tests/fixtures/sample.sil',
  )).toBase64()

  const FILE_BOX = FileBox.fromBase64(base64, 'sample.sil') as FileBoxInterface

  return {
    fileBox: FILE_BOX,
    text: EXPECTED_TEXT,
  }
}

const silk = await getSilk()

export {
  silk,
}

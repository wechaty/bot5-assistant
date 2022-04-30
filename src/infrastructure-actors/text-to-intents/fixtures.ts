import * as duck from '../../duck/mod.js'

export const FIXTURES = () => [
  [ '开始', [ duck.Intent.Start ] ],
  [ '停止', [ duck.Intent.Stop ] ],
  [ '三个Intents的测试', [ duck.Intent.Start, duck.Intent.Stop, duck.Intent.Unknown ] ],
] as const

import * as duck from '../../duck/mod.js'

export const FIXTURES = () => [
  [ '开始', [ duck.Intent.Start ] ],
  [ '停止', [ duck.Intent.Stop ] ],
  [ '', [] ],
  [ '!@#$%^&*()_+-=', [ duck.Intent.Unknown ] ],
  /**
   * Testing only
   */
  [ '三个Intents的测试', [ duck.Intent.Start, duck.Intent.Stop, duck.Intent.Unknown ] ],
  [ '大可乐两个，统一冰红茶三箱。', [ duck.Intent.CocaCola ] ],
] as const

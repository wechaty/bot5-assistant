import * as duck from '../../duck/mod.js'

export const FIXTURES = () => [
  /**
   * Testing only
   */
  [
    [ '三个Intents的测试（23a6f026-f861-48b6-b691-ab11f364774e）' ],
    [ duck.Intent.Start, duck.Intent.Stop, duck.Intent.Unknown ],
  ],
  [
    [ '大可乐两个，统一冰红茶三箱。' ],
    [ duck.Intent.CocaCola ],
  ],

  /**
   * Special values
   */
  [
    [ '' ],
    [],
  ],
  [
    [ '!@#$%^&*()_+-=' ],
    [ duck.Intent.Unknown ],
  ],

  /**
   * Meeting Intents
   */
  [
    [ '开始' ],
    [ duck.Intent.Start ],
  ],
  [
    [
      '停止',
      '结束',
    ],
    [ duck.Intent.Stop ],
  ],
  [
    [
      'yes',
      '是',
      '好',
      '对',
    ],
    [ duck.Intent.Affirm ],
  ],
  [
    [
      'no',
      '不',
      '否',
    ],
    [ duck.Intent.Deny ],
  ],
  [
    [
      '下一步',
      '/next',
      'next',
    ],
    [ duck.Intent.Next ],
  ],
  [
    [
      '上一步',
      '/back',
      'back',
    ],
    [ duck.Intent.Back ],
  ],
  [
    [
      '取消',
      'cancel',
    ],
    [ duck.Intent.Cancel ],
  ],
  [
    [ '继续' ],
    [ duck.Intent.Continue ],
  ],
] as const

import { Intent } from './intent-fancy-enum.js'

export const FIXTURES = () => [
  /**
   * Testing only
   */
  [
    [ '测试三个Intents（f861-48b6-b691）' ],
    [ Intent.Start, Intent.Stop, Intent.Unknown ],
  ],
  [
    [ '测试大可乐两个，统一冰红茶三箱。' ],
    [ Intent.CocaCola ],
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
    [ Intent.Unknown ],
  ],

  /**
   * Meeting Intents
   */
  [
    [ '开始' ],
    [ Intent.Start ],
  ],
  [
    [
      '停止',
      '结束',
    ],
    [ Intent.Stop ],
  ],
  [
    [
      'yes',
      '是',
      '好',
      '对',
    ],
    [ Intent.Affirm ],
  ],
  [
    [
      'no',
      '不',
      '否',
    ],
    [ Intent.Deny ],
  ],
  [
    [
      '下一步',
      '/next',
      'next',
      'NEXT',
    ],
    [ Intent.Next ],
  ],
  [
    [
      '上一步',
      '返回',
      '/back',
      'back',
    ],
    [ Intent.Back ],
  ],
  [
    [
      '取消',
      'cancel',
    ],
    [ Intent.Cancel ],
  ],
  [
    [ '继续' ],
    [ Intent.Continue ],
  ],
  [
    [ '完成' ],
    [ Intent.Complete ],
  ],
  [
    [ '结束' ],
    [ Intent.Finish ],
  ],
  [
    [ '帮助', 'help' ],
    [ Intent.Help ],
  ],
] as const

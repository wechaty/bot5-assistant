/**
 * 文档中心 > 语音识别 > API 文档 > 录音文件识别极速版相关接口 > 录音文件识别极速版
 *  @link https://cloud.tencent.com/document/product/1093/52097
 *
 * Source: docs-for-tencent-cloud/docs/大数据与AI/语音识别/实时语音识别 SDK/Node.js SDK.md
 *  @link https://github.com/codinggirl/docs-for-tencent-cloud/blob/main/docs/%E5%A4%A7%E6%95%B0%E6%8D%AE%E4%B8%8EAI/%E8%AF%AD%E9%9F%B3%E8%AF%86%E5%88%AB/%E5%AE%9E%E6%97%B6%E8%AF%AD%E9%9F%B3%E8%AF%86%E5%88%AB%20SDK/Node.js%20SDK.md
 */

/* eslint-disable sort-keys */
import * as TencentCloud from 'tencentcloud-sdk-nodejs'
import type { SentenceRecognitionRequest } from 'tencentcloud-sdk-nodejs/tencentcloud/services/asr/v20190614/asr_models'

import * as uuid from 'uuid'
import type {
  FileBoxInterface,
}                     from 'file-box'

const AsrClient = TencentCloud.asr.v20190614.Client

const clientConfig = {
  /**
   * Huan(202111): the plain text secret is for easy developing.
   *  will be removed in the future and use environment variable from plugin options instead.
   */
  // 腾讯云认证信息
  credential: {
    secretId: 'AKIDpTryoMefPs4zdz5uSjiRt75nFQNC8oCJ',
    secretKey: 'sTnqd9NK0PWMvEG1UgbFbgU1HGzQaT6S',
  },
  // 可选配置实例
  profile: {},
  /**
   * 产品地域 @link https://intl.cloud.tencent.com/document/product/213/6091
   */
  region: 'na-siliconvalley',
} as const

// 实例化要请求产品(以cvm为例)的client对象
const client = new AsrClient(clientConfig)

export async function speechToText (
  fileBox?: FileBoxInterface | Promise<FileBoxInterface>,
): Promise<string> {
  if (!fileBox) {
    return ''
  }

  if (fileBox instanceof Promise) {
    fileBox = await fileBox
  }

  let voiceFormat = fileBox.name.split('.').pop()
  if (!voiceFormat) {
    throw new Error('no ext for fileBox name: ' + fileBox.name)
  }

  switch (voiceFormat) {
    case 'sil':
      voiceFormat = 'silk'
      break
    default:
      throw new Error('ext not supported: ' + voiceFormat)
  }

  const req: SentenceRecognitionRequest = {
    /**
      * 腾讯云项目 ID，可填 0，总长度不超过 1024 字节。
      */
    ProjectId: 0,
    /**
      * 子服务类型。2： 一句话识别。
      */
    SubServiceType: 2,
    /**
      * 引擎模型类型。
      *
        电话场景：
        • 8k_en：电话 8k 英语；
        • 8k_zh：电话 8k 中文普通话通用；
        非电话场景：
        • 16k_zh：16k 中文普通话通用；
        • 16k_en：16k 英语；
        • 16k_ca：16k 粤语；
        • 16k_ja：16k 日语；
        •16k_wuu-SH：16k 上海话方言；
        •16k_zh_medical：16k 医疗。
      */
    EngSerViceType: '16k_zh',
    /**
      * 语音数据来源。0：语音 URL；1：语音数据（post body）。
      */
    SourceType: 1,
    /**
      * 识别音频的音频格式。mp3、wav。
      * Huan(202111): wav、pcm、ogg-opus、speex、silk、mp3、m4a、aac
      *   @see https://cloud.tencent.com/document/product/1093/52097
      */
    VoiceFormat: voiceFormat, // FIXME: check the file extension
    /**
      * 用户端对此任务的唯一标识，用户自助生成，用于用户查找识别结果。
      */
    UsrAudioKey: uuid.v4(),
    /**
      * 语音 URL，公网可下载。当 SourceType 值为 0（语音 URL上传） 时须填写该字段，为 1 时不填；URL 的长度大于 0，小于 2048，需进行urlencode编码。音频时长不能超过60s，音频文件大小不能超过3MB。
      */
    // Url?: string,
    /**
      * 语音数据，当SourceType 值为1（本地语音数据上传）时必须填写，当SourceType 值为0（语音 URL上传）可不写。要使用base64编码(采用python语言时注意读取文件应该为string而不是byte，以byte格式读取后要decode()。编码后的数据不可带有回车换行符)。音频时长不能超过60s，音频文件大小不能超过3MB（Base64后）。
      */
    Data: await fileBox.toBase64(),
    /**
      * 数据长度，单位为字节。当 SourceType 值为1（本地语音数据上传）时必须填写，当 SourceType 值为0（语音 URL上传）可不写（此数据长度为数据未进行base64编码时的数据长度）。
      */
    DataLen: fileBox.size,
    /**
      * 热词id。用于调用对应的热词表，如果在调用语音识别服务时，不进行单独的热词id设置，自动生效默认热词；如果进行了单独的热词id设置，那么将生效单独设置的热词id。
      */
    // HotwordId?: string,
    /**
      * 是否过滤脏词（目前支持中文普通话引擎）。0：不过滤脏词；1：过滤脏词；2：将脏词替换为 * 。默认值为 0。
      */
    FilterDirty: 2,
    /**
      * 是否过语气词（目前支持中文普通话引擎）。0：不过滤语气词；1：部分过滤；2：严格过滤 。默认值为 0。
      */
    FilterModal: 2,
    /**
      * 是否过滤标点符号（目前支持中文普通话引擎）。 0：不过滤，1：过滤句末标点，2：过滤所有标点。默认值为 0。
      */
    FilterPunc: 0,
    /**
      * 是否进行阿拉伯数字智能转换。0：不转换，直接输出中文数字，1：根据场景智能转换为阿拉伯数字。默认值为1。
      */
    ConvertNumMode: 1,
    /**
      * 是否显示词级别时间戳。0：不显示；1：显示，不包含标点时间戳，2：显示，包含标点时间戳。支持引擎8k_zh，16k_zh，16k_en，16k_ca，16k_ja，16k_wuu-SH。默认值为 0。
      */
    WordInfo: 0,
  }

  // 通过client对象调用想要访问的接口，需要传入请求对象以及响应回调函数
  const data = await client.SentenceRecognition(req)
  return data.Result
}

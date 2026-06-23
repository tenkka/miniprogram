const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// ⚠️ 填入你的微信支付商户信息（开通后配置）
const APP_ID = 'wx8edd0d8a513f30eb'      // 小程序 AppID，如 wx1234567890abcdef
const MCH_ID = '1745481188'      // 商户号，如 1234567890
const API_KEY = '49gbEAovrzIjPYVgINPgjy41JW79lvtT'     // API 密钥（v2），商户平台设置的 32 位字符串
const NOTIFY_URL = ''  // 支付结果通知地址，留空则不接收回调

function sign(params) {
  const str =
    Object.keys(params)
      .sort()
      .filter(k => params[k] !== undefined && params[k] !== '')
      .map(k => `${k}=${params[k]}`)
      .join('&') + `&key=${API_KEY}`
  return crypto.createHash('md5').update(str, 'utf8').digest('hex').toUpperCase()
}

function toXml(obj) {
  return (
    '<xml>' +
    Object.entries(obj)
      .map(([k, v]) => `<${k}><![CDATA[${v}]]></${k}>`)
      .join('') +
    '</xml>'
  )
}

function fromXml(xml) {
  const inner = xml.replace(/<\/?xml>/g, '')
  const result = {}
  const re = /<(\w+)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/\1>/g
  let m
  while ((m = re.exec(inner)) !== null) result[m[1]] = m[2]
  return result
}

function post(url, xml) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(xml, 'utf8')
    const req = https.request(
      url,
      { method: 'POST', headers: { 'Content-Type': 'text/xml', 'Content-Length': buf.length } },
      res => {
        let data = ''
        res.on('data', d => (data += d))
        res.on('end', () => resolve(data))
      }
    )
    req.on('error', reject)
    req.write(buf)
    req.end()
  })
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { price, productName } = event

  if (!APP_ID || !MCH_ID || !API_KEY) {
    return { code: 1, msg: '微信支付尚未配置，请联系管理员' }
  }

  const totalFee = Math.round(price * 100) // 元 → 分
  const nonceStr = Math.random().toString(36).slice(2, 18)
  const outTradeNo = `NUTS${Date.now()}${Math.floor(Math.random() * 1000)}`

  const params = {
    appid: APP_ID,
    mch_id: MCH_ID,
    nonce_str: nonceStr,
    body: productName,
    out_trade_no: outTradeNo,
    total_fee: totalFee,
    spbill_create_ip: '127.0.0.1',
    notify_url: NOTIFY_URL || 'https://example.com/placeholder',
    trade_type: 'JSAPI',
    openid: OPENID,
  }
  params.sign = sign(params)

  try {
    const resXml = await post('https://api.mch.weixin.qq.com/pay/unifiedorder', toXml(params))
    const res = fromXml(resXml)

    if (res.return_code !== 'SUCCESS' || res.result_code !== 'SUCCESS') {
      console.error('unifiedorder failed:', JSON.stringify(res))
      return {
        code: 1,
        msg: res.err_code_des || res.return_msg || res.err_code || '创建订单失败',
        detail: res,
      }
    }

    const timestamp = String(Math.floor(Date.now() / 1000))
    const payParams = {
      appId: APP_ID,
      timeStamp: timestamp,
      nonceStr,
      package: `prepay_id=${res.prepay_id}`,
      signType: 'MD5',
    }
    payParams.paySign = sign(payParams)

    return { code: 0, payParams, outTradeNo }
  } catch (e) {
    return { code: 1, msg: '网络错误: ' + (e.message || JSON.stringify(e)) }
  }
}

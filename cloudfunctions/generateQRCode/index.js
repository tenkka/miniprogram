const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const QRCode = require('qrcode')

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { code: -1, msg: '未登录' }

  const timestamp = event.timestamp || Date.now()
  const text = `NUTS|${OPENID}|${timestamp}`

  const dataUrl = await QRCode.toDataURL(text, {
    width: 400,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  })

  const base64 = dataUrl.split(',')[1]
  return { code: 0, base64, text }
}

const cloud = require('wx-server-sdk')
const crypto = require('crypto')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const TOKEN = 'a579erguqwh0893y5w' // 替换为微信后台消息推送里填写的Token

exports.main = async (event) => {
  // GET：微信服务器验证
  if (event.httpMethod === 'GET') {
    const { signature, timestamp, nonce, echostr } = event.queryStringParameters || {}
    const sha1 = crypto
      .createHash('sha1')
      .update([TOKEN, timestamp, nonce].sort().join(''))
      .digest('hex')
    if (sha1 === signature) {
      return { statusCode: 200, headers: { 'Content-Type': 'text/plain' }, body: echostr }
    }
    return { statusCode: 403, body: 'forbidden' }
  }

  // POST：处理内容安全回调
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || event)
    const { trace_id, result } = body

    if (!trace_id || !result) {
      return { statusCode: 200, body: 'ok' }
    }

    const suggest = result.suggest || 'pass'

    const checkRes = await db.collection('media_security_checks')
      .where({ traceId: trace_id })
      .get()

    if (checkRes.data.length === 0) {
      return { statusCode: 200, body: 'ok' }
    }

    const check = checkRes.data[0]

    await db.collection('media_security_checks').doc(check._id).update({
      data: { status: suggest, result, updatedAt: db.serverDate() }
    })

    if (suggest === 'risky') {
      await db.collection('users').where({ openid: check.openid }).update({
        data: { avatarUrl: '', avatarFlagged: true, updatedAt: db.serverDate() }
      })
    }

    return { statusCode: 200, body: 'ok' }
  } catch (e) {
    console.error('mediaSecCallback error:', e)
    return { statusCode: 200, body: 'ok' }
  }
}

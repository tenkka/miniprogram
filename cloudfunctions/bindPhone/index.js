const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { code } = event

  let phone
  try {
    const phoneRes = await cloud.openapi.phonenumber.getPhoneNumber({ code })
    console.log('phoneRes:', JSON.stringify(phoneRes))
    const phoneInfo = phoneRes.phoneInfo || phoneRes.phone_info
    phone = phoneInfo && (phoneInfo.purePhoneNumber || phoneInfo.phoneNumber)
    if (!phone) {
      console.error('phoneInfo missing, full phoneRes:', JSON.stringify(phoneRes))
      return { code: 1, msg: '获取手机号失败，请重试' }
    }
  } catch (e) {
    console.error('getPhoneNumber openapi error:', JSON.stringify(e))
    return { code: 1, msg: `openapi调用失败: ${e.errMsg || e.message || JSON.stringify(e)}` }
  }

  try {
    const userRes = await db.collection('users').where({ openid: OPENID }).get()
    if (userRes.data.length > 0) {
      await db.collection('users').doc(userRes.data[0]._id).update({ data: { phone } })
    } else {
      await db.collection('users').add({
        data: { openid: OPENID, phone, nick: '', avatarUrl: '', power: 0, champion: 0, rechargeBalance: 0, giftBalance: 0 },
      })
    }
    return { code: 0, phone }
  } catch (e) {
    console.error('save phone error:', e)
    return { code: 1, msg: '保存失败，请重试' }
  }
}

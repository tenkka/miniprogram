const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 新人输入老人邀请码完成绑定
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { code: -1, msg: '未登录' }

  let { code } = event
  if (!code) return { code: 1, msg: '请输入邀请码' }
  code = String(code).trim().toUpperCase()

  const meRes = await db.collection('users').where({ openid: OPENID }).get()
  if (!meRes.data.length) return { code: 1, msg: '用户不存在' }
  const me = meRes.data[0]

  // 已绑定过
  if (me.referrer) return { code: 2, msg: '你已绑定过邀请人' }
  // 新客限定：已有套餐购买（已体验德州扑克）不可再作为新人被邀请
  if (me.firstPurchaseAt) return { code: 3, msg: '仅新客可填写邀请码' }
  // 不能填自己的码
  if (me.inviteCode === code) return { code: 4, msg: '不能填写自己的邀请码' }

  // 查邀请人
  const inviterRes = await db.collection('users').where({ inviteCode: code }).get()
  if (!inviterRes.data.length) return { code: 5, msg: '邀请码无效' }
  const inviter = inviterRes.data[0]
  if (inviter.openid === OPENID) return { code: 4, msg: '不能填写自己的邀请码' }

  // 绑定
  await db.collection('users').doc(me._id).update({
    data: { referrer: inviter.openid },
  })
  await db.collection('referrals').add({
    data: {
      inviterOpenid: inviter.openid,
      inviteeOpenid: OPENID,
      inviteeNick: me.nick || '',
      status: 'bound',
      rewardPower: 0,
      boundAt: db.serverDate(),
    },
  })

  return { code: 0, msg: '绑定成功' }
}

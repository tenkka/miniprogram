const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 各套餐购买后赠送的积分（按 productId，服务端定义防篡改，与 pages/order/index.js 对齐）
const PRODUCT_GIFT_SCORE = { 1: 3000, 2: 5000, 3: 10000, 4: 3000, 5: 3000 }
// 老带新：邀请人可得新人首购套餐赠送积分的比例
const REFERRAL_REWARD_RATIO = 0.5

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { price, productName, productId, realPrice, wechatAmount, outTradeNo } = event
  // price = 本次从余额扣除的金额（可为 0）
  // wechatAmount = 微信支付部分（可为 0）

  const userRes = await db.collection('users').where({ openid: OPENID }).get()
  if (!userRes.data.length) return { code: 1, msg: '用户不存在' }

  const user = userRes.data[0]

  let giftDeduct = 0
  let rechargeDeduct = 0

  if (price > 0) {
    const gift = user.giftBalance || 0
    const recharge = user.rechargeBalance || 0
    const total = +(gift + recharge).toFixed(2)

    if (total < price) {
      return { code: 2, msg: '余额不足', availableBalance: total }
    }

    giftDeduct = +Math.min(gift, price).toFixed(2)
    rechargeDeduct = +(price - giftDeduct).toFixed(2)

    await db.collection('users').doc(user._id).update({
      data: {
        giftBalance: _.inc(giftDeduct > 0 ? -giftDeduct : 0),
        rechargeBalance: _.inc(rechargeDeduct > 0 ? -rechargeDeduct : 0),
      },
    })
  }

  const wxAmount = wechatAmount || 0
  const method = wxAmount > 0 ? (price > 0 ? 'mixed' : 'wechat') : 'balance'

  await db.collection('balanceLogs').add({
    data: {
      openid: OPENID,
      nick: user.nick || '',
      type: 'consume',
      rechargeAmount: rechargeDeduct > 0 ? -rechargeDeduct : 0,
      giftAmount: giftDeduct > 0 ? -giftDeduct : 0,
      wechatAmount: wxAmount,
      note: productName,
      productId: productId || null,
      realPrice: realPrice || (price + wxAmount),
      method,
      outTradeNo: outTradeNo || '',
      createdAt: db.serverDate(),
    },
  })

  // ===== 套餐赠送积分 =====
  const giftScore = PRODUCT_GIFT_SCORE[productId] || 0
  if (giftScore > 0) {
    await db.collection('users').doc(user._id).update({
      data: { power: _.inc(giftScore) },
    })
    await db.collection('scoreLogs').add({
      data: {
        openid: OPENID,
        type: 'purchase_gift',
        score: giftScore,
        note: `购买${productName}赠送积分`,
        createdAt: db.serverDate(),
      },
    })
  }

  // ===== 首购 + 老带新奖励 =====
  // 仅在用户的第一次套餐购买时触发；标记 firstPurchaseAt 避免重复
  const isFirstPurchase = !user.firstPurchaseAt
  if (isFirstPurchase) {
    await db.collection('users').doc(user._id).update({
      data: { firstPurchaseAt: db.serverDate() },
    })

    if (user.referrer && giftScore > 0) {
      // 取该被邀请人对应的、尚未发放奖励的绑定记录
      const refRes = await db.collection('referrals').where({
        inviterOpenid: user.referrer,
        inviteeOpenid: OPENID,
        status: 'bound',
      }).get()

      if (refRes.data.length) {
        const referral = refRes.data[0]
        const reward = Math.round(giftScore * REFERRAL_REWARD_RATIO)

        const inviterRes = await db.collection('users').where({ openid: user.referrer }).get()
        if (inviterRes.data.length) {
          const inviter = inviterRes.data[0]
          await db.collection('users').doc(inviter._id).update({
            data: { power: _.inc(reward) },
          })
          await db.collection('referrals').doc(referral._id).update({
            data: { status: 'rewarded', rewardPower: reward, rewardedAt: db.serverDate() },
          })
          await db.collection('scoreLogs').add({
            data: {
              openid: user.referrer,
              type: 'referral_reward',
              score: reward,
              note: `老带新奖励（${user.nick || '好友'}首购${productName}）`,
              inviteeOpenid: OPENID,
              createdAt: db.serverDate(),
            },
          })
        }
      }
    }
  }

  return { code: 0, giftDeduct, rechargeDeduct, giftScore }
}

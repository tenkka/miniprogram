const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const PRODUCT_GIFT_POINTS = { 1: 3500, 2: 7100, 3: 15000, 4: 3000, 5: 3000 }
const REFERRAL_REWARD_RATIO = 0.5

async function addPoints(openid, amount, sourceId, description) {
  const res = await db.collection('user_points').where({ openid }).get()
  let balanceBefore = 0
  if (res.data.length > 0) {
    balanceBefore = res.data[0].balance || 0
    await db.collection('user_points').doc(res.data[0]._id).update({
      data: {
        balance: _.inc(amount),
        totalEarned: _.inc(amount),
        updatedAt: db.serverDate(),
      },
    })
  } else {
    await db.collection('user_points').add({
      data: {
        openid,
        balance: amount,
        totalEarned: amount,
        totalSpent: 0,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
      },
    })
  }
  await db.collection('points_transactions').add({
    data: {
      openid,
      type: 'earn',
      amount,
      source: 'purchase',
      sourceId,
      description,
      balanceBefore,
      balanceAfter: balanceBefore + amount,
      createdAt: db.serverDate(),
    },
  })
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { price, productName, productId, realPrice, wechatAmount, outTradeNo, storeId, storeName } = event

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
      storeId: storeId || '',
      storeName: storeName || '',
      createdAt: db.serverDate(),
    },
  })

  // ===== 套餐赠送积分 =====
  const giftPoints = PRODUCT_GIFT_POINTS[productId] || 0
  if (giftPoints > 0) {
    const purchaseSourceId = `purchase_${outTradeNo || (OPENID + '_' + Date.now())}_${productId}`
    await addPoints(OPENID, giftPoints, purchaseSourceId, `购买${productName}赠送${giftPoints}积分`)
  }

  // ===== 首购 + 老带新奖励 =====
  const isFirstPurchase = !user.firstPurchaseAt
  if (isFirstPurchase) {
    await db.collection('users').doc(user._id).update({
      data: { firstPurchaseAt: db.serverDate() },
    })

    if (user.referrer && giftPoints > 0) {
      let refRes = { data: [] }
      try {
        refRes = await db.collection('referrals').where({
          inviterOpenid: user.referrer,
          inviteeOpenid: OPENID,
          status: 'bound',
        }).get()
      } catch (e) {
        refRes = { data: [] }
      }

      if (refRes.data.length) {
        const referral = refRes.data[0]
        const reward = Math.round(giftPoints * REFERRAL_REWARD_RATIO)
        const inviterRes = await db.collection('users').where({ openid: user.referrer }).get()
        if (inviterRes.data.length) {
          const referralSourceId = `referral_${OPENID}_${productId}`
          await addPoints(
            user.referrer,
            reward,
            referralSourceId,
            `老带新奖励（${user.nick || '好友'}首购${productName}）`,
          )
          await db.collection('referrals').doc(referral._id).update({
            data: { status: 'rewarded', rewardPoints: reward, rewardedAt: db.serverDate() },
          })
        }
      }
    }
  }

  return { code: 0, giftDeduct, rechargeDeduct, giftPoints }
}

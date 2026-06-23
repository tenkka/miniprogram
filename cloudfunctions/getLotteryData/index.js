const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 与 drawLottery 一致的 10 扇区配置（前端绘制转盘用）
const PRIZES = [
  { index: 0, name: '谢谢参与', type: 'none', value: 0 },
  { index: 1, name: '5000积分券', type: 'power', value: 5000 },
  { index: 2, name: '3000积分券', type: 'power', value: 3000 },
  { index: 3, name: '1000积分券', type: 'power', value: 1000 },
  { index: 4, name: '50元代金券', type: 'gift', value: 50 },
  { index: 5, name: '5元代金券', type: 'gift', value: 5 },
  { index: 6, name: '10元代金券', type: 'gift', value: 10 },
  { index: 7, name: '+100积分带入', type: 'power', value: 100 },
  { index: 8, name: '+200积分带入', type: 'power', value: 200 },
  { index: 9, name: '+500积分带入', type: 'power', value: 500 },
]

// 积分兑换商城（牌桌福利阁）
const EXCHANGE_ITEMS = [
  { id: 'combo398', name: '398 酒水套餐', comboPrice: 398, cost: 30000 },
  { id: 'combo218', name: '218 酒水套餐', comboPrice: 218, cost: 18888 },
  { id: 'combo138', name: '138 酒水套餐', comboPrice: 138, cost: 12888 },
]

const RECORD_LIMIT = 20

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { code: -1, msg: '未登录' }

  const userRes = await db.collection('users').where({ openid: OPENID })
    .field({ power: true, lotteryTickets: true }).get()
  const user = userRes.data[0] || {}

  // 本人最近中奖记录（lotteryLogs 集合可能尚未创建，容错为空）
  let records = []
  try {
    const logsRes = await db.collection('lotteryLogs')
      .where({ openid: OPENID })
      .orderBy('createdAt', 'desc')
      .limit(RECORD_LIMIT)
      .get()
    records = logsRes.data
  } catch (e) {
    records = []
  }

  return {
    code: 0,
    tickets: user.lotteryTickets || 0,
    power: user.power || 0,
    prizes: PRIZES,
    exchangeItems: EXCHANGE_ITEMS,
    records,
  }
}

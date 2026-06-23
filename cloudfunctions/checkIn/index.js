const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const POINTS = [10, 20, 30, 40, 60, 80, 100]

function getDateStr(offsetDays = 0) {
  const now = new Date()
  const utc8 = new Date(now.getTime() + 8 * 3600 * 1000 + offsetDays * 86400 * 1000)
  return utc8.toISOString().slice(0, 10)
}

function getWeekRange() {
  const now = new Date()
  const utc8 = new Date(now.getTime() + 8 * 3600 * 1000)
  const day = utc8.getUTCDay()
  const daysFromMon = day === 0 ? 6 : day - 1
  const monday = new Date(utc8.getTime() - daysFromMon * 86400 * 1000)
  const sunday = new Date(monday.getTime() + 6 * 86400 * 1000)
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { code: -1, msg: '未登录' }

  const today = getDateStr(0)
  const { start: weekStart, end: weekEnd } = getWeekRange()

  // 今天已签到？
  const todayRes = await db.collection('checkIns').where({ openid: OPENID, date: today }).count()
  if (todayRes.total > 0) return { code: 1, msg: '今日已签到', todayCheckedIn: true }

  // 本周已签到次数（不含今天）
  const weekRes = await db.collection('checkIns').where({
    openid: OPENID,
    date: _.gte(weekStart).and(_.lte(weekEnd)),
  }).count()

  // 本周第 N 次签到（断签不影响计数）
  const streak = Math.min(weekRes.total + 1, 7)
  const points = POINTS[streak - 1]

  // 签到加积分，同时 +1 抽奖次数
  await db.collection('users').where({ openid: OPENID }).update({
    data: { power: _.inc(points), lotteryTickets: _.inc(1) },
  })

  await db.collection('checkIns').add({
    data: { openid: OPENID, date: today, streak, points, createdAt: db.serverDate() },
  })

  return { code: 0, streak, points, todayCheckedIn: true }
}

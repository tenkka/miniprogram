const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

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

  const weekRes = await db.collection('checkIns').where({
    openid: OPENID,
    date: _.gte(weekStart).and(_.lte(weekEnd)),
  }).get()

  const weekCheckedDates = weekRes.data.map(r => r.date)
  const todayCheckedIn = weekCheckedDates.includes(today)

  // streak = 本周已签次数（含今天），或若今天未签则为下次签到的序号
  const streak = todayCheckedIn
    ? weekCheckedDates.length
    : Math.min(weekCheckedDates.length + 1, 7)

  return { code: 0, todayCheckedIn, streak, weekCheckedDates }
}

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function buildDates() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dates = []
  // 昨天 + 今天 + 未来6天，共8天
  for (let i = -1; i <= 6; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    dates.push({
      dateStr: toDateStr(d),
      weekLabel: i === -1 ? '昨天' : i === 0 ? '今天' : i === 1 ? '明天' : WEEK[d.getDay()],
      dayNum: d.getDate(),
      isToday: i === 0,
    })
  }
  return dates
}

Page({
  data: {
    dates: [],
    selectedDate: '',
    activities: [],
    loading: false,
    storeName: '',
    storeId: null,
  },

  onLoad() {
    const store = wx.getStorageSync('currentStore')
    const dates = buildDates()
    const today = dates.find(d => d.isToday)
    this.setData({
      dates,
      selectedDate: today.dateStr,
      storeName: store ? store.name : '',
      storeId: store ? store.id : null,
    })
    this.loadActivities(today.dateStr)
  },

  onShow() {
    const store = wx.getStorageSync('currentStore')
    this.setData({
      storeName: store ? store.name : '',
      storeId: store ? store.id : null,
    })
  },

  selectDate(e) {
    const date = e.currentTarget.dataset.date
    if (date === this.data.selectedDate) return
    this.setData({ selectedDate: date })
    this.loadActivities(date)
  },

  async loadActivities(date) {
    this.setData({ loading: true, activities: [] })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getActivities',
        data: { date, storeId: this.data.storeId },
      })
      this.setData({ activities: res.result.list || [] })
    } catch (e) {
      console.error('getActivities error:', e)
    } finally {
      this.setData({ loading: false })
    }
  },
})

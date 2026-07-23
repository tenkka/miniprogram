const { requireLogin } = require('../../utils/requireLogin')

Page({
  data: {
    currentStore: null,
    storeId: '',
    tables: [],
    filteredTables: [],
    filterTab: 0,
    filterLabels: ['全部', '可预约', '已满员'],
    isAdmin: false,
    loading: true,
    openCount: 0,
    fullCount: 0,
    submitting: false,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    const store = wx.getStorageSync('currentStore')
    if (store) {
      this.setData({ currentStore: store, storeId: store.id })
      this.loadTables(store.id)
    } else {
      wx.navigateTo({ url: '/pages/stores/index' })
    }
  },

  onPullDownRefresh() {
    this.loadTables(this.data.storeId).then(() => wx.stopPullDownRefresh())
  },

  goStores() {
    wx.navigateTo({ url: '/pages/stores/index' })
  },

  async loadTables(storeId) {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'getTables', data: { storeId } })
      const { isAdmin } = res.result
      const raw = res.result.tables || []
      let openCount = 0, fullCount = 0
      const myOpenid = wx.getStorageSync('openid') || ''
      const myUserInfo = wx.getStorageSync('userInfo') || {}

      const tables = raw.map(t => {
        let seatBookings = t.seatBookings || []

        if (t.myBooking && t.myBooking.type === 'booking') {
          const exists = seatBookings.some(b => b._id === t.myBooking._id)
          if (!exists) {
            seatBookings = [...seatBookings, {
              _id: t.myBooking._id,
              nick: myUserInfo.nick || '',
              avatarUrl: myUserInfo.avatarUrl || '',
              status: t.myBooking.status,
              openid: myOpenid,
            }]
          }
        }

        if (t.isFull) fullCount++; else openCount++
        return {
          ...t,
          occupiedCount: seatBookings.length,
        }
      })

      this.setData({ tables, isAdmin, openCount, fullCount })
      this.applyFilter(tables, this.data.filterTab)
    } catch (e) {
      console.error('loadTables error:', e)
      wx.showToast({ title: '加载失败，请下拉刷新', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  setFilter(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ filterTab: tab })
    this.applyFilter(this.data.tables, tab)
  },

  applyFilter(tables, tab) {
    let filtered
    if (tab === 0 || tab === '0') {
      filtered = tables
    } else if (tab === 1 || tab === '1') {
      filtered = tables.filter(t => !t.isFull)
    } else {
      filtered = tables.filter(t => t.isFull)
    }
    this.setData({ filteredTables: filtered })
  },

  onBookTap(e) {
    if (!requireLogin()) return
    const table = e.currentTarget.dataset.table

    // 已预约 → 提供取消选项
    if (table.myBooking) {
      const openid = wx.getStorageSync('openid')
      if (table.myBooking.openid === openid || table.myBooking) {
        wx.showModal({
          title: '取消预约',
          content: `确定取消 ${table.name} 的预约？`,
          confirmText: '取消预约',
          confirmColor: '#E64340',
          cancelText: '保留',
          success: (res) => {
            if (res.confirm) this.cancelBookingById(table.myBooking._id)
          },
        })
      }
      return
    }

    // 已满员 → 排队
    if (table.isFull) {
      const tip = table.queueCount > 0 ? `当前 ${table.queueCount} 人等候` : '暂无人排队'
      wx.showModal({
        title: `加入排队 · ${table.name}`,
        content: `${tip}，确认加入？`,
        confirmText: '确认',
        success: (res) => {
          if (res.confirm) this.submitBooking(table._id, '20:00')
        },
      })
      return
    }

    // 正常预约，默认 20:00
    wx.showModal({
      title: `预约 · ${table.name}`,
      content: `确认预约？默认到场时间 20:00`,
      confirmText: '确认预约',
      success: (res) => {
        if (res.confirm) this.submitBooking(table._id, '20:00')
      },
    })
  },

  async cancelBookingById(bookingId) {
    wx.showLoading({ title: '处理中...' })
    try {
      const r = await wx.cloud.callFunction({ name: 'cancelBooking', data: { bookingId } })
      if (r.result.code === 0) {
        wx.showToast({ title: '已取消', icon: 'success' })
        await this.loadTables(this.data.storeId)
      } else {
        wx.showToast({ title: r.result.msg, icon: 'none' })
      }
    } finally { wx.hideLoading() }
  },

  async submitBooking(tableId, arrivalTime) {
    if (this.data.submitting) return
    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...' })
    try {
      const res = await wx.cloud.callFunction({ name: 'submitBooking', data: { tableId, arrivalTime } })
      const result = res.result
      if (result.code !== 0) {
        wx.showToast({ title: result.msg, icon: 'none' })
        return
      }
      const msg = result.type === 'queue' ? `已加入排队，第 ${result.queueNo} 位` : '预约成功'
      wx.showToast({ title: msg, icon: 'success', duration: 2500 })
      await this.loadTables(this.data.storeId)
    } catch (e) {
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ submitting: false })
    }
  },
})

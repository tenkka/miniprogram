const { requireLogin } = require('../../utils/requireLogin')

// 座位椭圆参数（rpx，与 WXSS 中的 stage 尺寸对应）
const CX = 375, CY = 230, RX = 270, RY = 155, HALF = 44

function computeSeats(seatBookings, maxplayer) {
  const seats = []
  for (let i = 0; i < maxplayer; i++) {
    const angle = (i / maxplayer) * Math.PI * 2 - Math.PI / 2
    seats.push({
      left: Math.round(CX + RX * Math.cos(angle)) - HALF,
      top:  Math.round(CY + RY * Math.sin(angle)) - HALF,
      booking: seatBookings[i] || null,
    })
  }
  return seats
}

Page({
  data: {
    currentStore: null,
    storeId: '',
    tables: [],
    isAdmin: false,
    loading: true,
    openCount: 0,
    fullCount: 0,
    showBookingForm: false,
    selectedTable: null,
    arrivalTime: '',
    showDatetimePop: false,
    currentDate: 0,
    minDate: 0,
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

        // 如果 myBooking 是预约类型但不在 seatBookings 里，手动补入
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

        // 对当前用户的座位，用本地缓存补全空的 avatarUrl
        seatBookings = seatBookings.map(b => {
          if (b.openid === myOpenid && !b.avatarUrl && myUserInfo.avatarUrl) {
            return { ...b, avatarUrl: myUserInfo.avatarUrl }
          }
          return b
        })

        if (t.isFull) fullCount++; else openCount++
        return {
          ...t,
          seats: computeSeats(seatBookings, t.maxplayer),
          occupiedCount: seatBookings.length,
        }
      })

      this.setData({ tables, isAdmin, openCount, fullCount })
    } catch (e) {
      console.error('loadTables error:', e)
      wx.showToast({ title: '加载失败，请下拉刷新', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // ===== 点击座位 =====
  tapSeat(e) {
    if (!requireLogin()) return
    const booking = e.currentTarget.dataset.booking
    const tableIdx = e.currentTarget.dataset.tableidx
    const table = this.data.tables[tableIdx]
    if (!table) return

    if (!booking) {
      // 空位 → 预约流程
      if (table.myBooking) {
        wx.showToast({ title: '您已预约该桌', icon: 'none' })
        return
      }
      if (table.isFull) {
        const tip = table.queueCount > 0 ? `当前 ${table.queueCount} 人等候` : '暂无人排队'
        wx.showModal({
          title: `加入排队 · ${table.name}`,
          content: tip + '，确认加入？',
          confirmText: '确认',
          success: (res) => { if (res.confirm) this.submitBooking(table._id, null) },
        })
        return
      }
      this.setData({
        selectedTable: table,
        showBookingForm: true,
        arrivalTime: '',
        currentDate: Date.now(),
        minDate: Date.now(),
      })
      return
    }

    // 已有预约的座位
    if (this.data.isAdmin) {
      // 管理员：改状态
      wx.showActionSheet({
        itemList: ['确认预约', '取消预约'],
        success: async (res) => {
          const statusMap = ['confirmed', 'cancelled']
          const status = statusMap[res.tapIndex]
          wx.showLoading({ title: '更新中...' })
          try {
            const r = await wx.cloud.callFunction({ name: 'updateBookingStatus', data: { bookingId: booking._id, status } })
            if (r.result.code === 0) {
              wx.showToast({ title: status === 'confirmed' ? '已确认' : '已取消', icon: 'success' })
              await this.loadTables(this.data.storeId)
            } else {
              wx.showToast({ title: r.result.msg, icon: 'none' })
            }
          } finally { wx.hideLoading() }
        },
      })
      return
    }

    // 普通用户：只能取消自己的
    const openid = wx.getStorageSync('openid')
    if (booking.openid === openid) {
      wx.showModal({
        title: '取消预约',
        content: '确定取消您的预约？',
        confirmText: '取消预约',
        confirmColor: '#e64340',
        cancelText: '保留',
        success: (res) => { if (res.confirm) this.cancelBookingById(booking._id) },
      })
    }
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
  closeBookingForm() {
    this.setData({ showBookingForm: false, selectedTable: null })
  },
  showTimePicker() { this.setData({ showDatetimePop: true }) },
  hideDatetimePop() { this.setData({ showDatetimePop: false }) },
  confirmTime(e) {
    const d = new Date(e.detail)
    const mo = d.getMonth() + 1
    const day = d.getDate()
    const h = d.getHours()
    const min = String(d.getMinutes()).padStart(2, '0')
    this.setData({ arrivalTime: `${mo}月${day}日 ${h}:${min}`, showDatetimePop: false })
  },
  async confirmBooking() {
    if (!this.data.arrivalTime) {
      wx.showToast({ title: '请选择到场时间', icon: 'none' })
      return
    }
    if (this.data.submitting) return
    const { _id } = this.data.selectedTable
    const arrivalTime = this.data.arrivalTime
    this.closeBookingForm()
    await this.submitBooking(_id, arrivalTime)
  },
  async submitBooking(tableId, arrivalTime) {
    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...' })
    try {
      const res = await wx.cloud.callFunction({ name: 'submitBooking', data: { tableId, arrivalTime } })
      const result = res.result
      if (result.code !== 0) { wx.showToast({ title: result.msg, icon: 'none' }); return }
      const msg = result.type === 'queue' ? `已加入排队，第 ${result.queueNo} 位` : '预约成功'
      wx.showToast({ title: msg, icon: 'success', duration: 2500 })
      if (result.type === 'booking') this.patchLocalBooking(tableId)
      await this.loadTables(this.data.storeId)
    } catch (e) {
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ submitting: false })
    }
  },

  patchLocalBooking(tableId) {
    const myOpenid = wx.getStorageSync('openid') || ''
    const myUserInfo = wx.getStorageSync('userInfo') || {}
    const newBooking = {
      _id: `local_${Date.now()}`,
      nick: myUserInfo.nick || '',
      avatarUrl: myUserInfo.avatarUrl || '',
      status: 'pending',
      openid: myOpenid,
    }
    const tables = this.data.tables.map(t => {
      if (t._id !== tableId) return t
      const seatBookings = [...(t.seatBookings || []), newBooking]
      return {
        ...t,
        seatBookings,
        myBooking: newBooking,
        isFull: seatBookings.length >= t.maxplayer,
        seats: computeSeats(seatBookings, t.maxplayer),
        occupiedCount: seatBookings.length,
      }
    })
    this.setData({ tables })
  },

})

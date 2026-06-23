Page({
  data: {
    tableId: '',
    table: null,
    seats: [],
    occupiedCount: 0,
    queueList: [],   // bookings with type='queue'
    myBooking: null,
    isAdmin: false,
    loading: true,
    showBookingForm: false,
    arrivalTime: '',
    showDatetimePop: false,
    currentDate: new Date().getTime(),
    minDate: new Date().getTime(),
    submitting: false,
  },

  onLoad(options) {
    const tableId = options.tableId
    this.setData({ tableId })
    this.loadDetail(tableId)
  },

  onPullDownRefresh() {
    this.loadDetail(this.data.tableId).then(() => wx.stopPullDownRefresh())
  },

  async loadDetail(tableId) {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'getTableDetail', data: { tableId } })
      const { table, bookings, myBooking, isAdmin } = res.result

      wx.setNavigationBarTitle({ title: table.name })

      const seatBookings = bookings.filter(b => b.type === 'booking')
      const queueList = bookings.filter(b => b.type === 'queue')
      const seats = this.computeSeats(seatBookings, table.maxplayer)
      const occupiedCount = seatBookings.length

      this.setData({ table, seats, occupiedCount, queueList, myBooking, isAdmin })
    } catch (e) {
      console.error('loadDetail error:', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 计算各座位在椭圆形桌台周围的坐标（rpx）
  computeSeats(seatBookings, maxPlayers) {
    const cx = 375, cy = 230
    const rx = 270, ry = 155
    const half = 44  // 座位半径

    const seats = []
    for (let i = 0; i < maxPlayers; i++) {
      const angle = (i / maxPlayers) * Math.PI * 2 - Math.PI / 2
      const left = Math.round(cx + rx * Math.cos(angle)) - half
      const top = Math.round(cy + ry * Math.sin(angle)) - half
      seats.push({ left, top, booking: seatBookings[i] || null })
    }
    return seats
  },

  // ===== 预约操作 =====
  showBookingForm() {
    this.setData({ showBookingForm: true, arrivalTime: '', currentDate: Date.now(), minDate: Date.now() })
  },
  closeBookingForm() {
    this.setData({ showBookingForm: false })
  },
  showTimePicker() {
    this.setData({ showDatetimePop: true })
  },
  hideDatetimePop() {
    this.setData({ showDatetimePop: false })
  },
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
    const arrivalTime = this.data.arrivalTime
    this.closeBookingForm()
    await this.submitBooking(arrivalTime)
  },
  tapQueue() {
    const { queueList } = this.data
    const tip = queueList.length > 0 ? `当前 ${queueList.length} 人等候` : '暂无人排队'
    wx.showModal({
      title: '加入排队',
      content: tip + '，确认加入？',
      confirmText: '确认',
      success: (res) => { if (res.confirm) this.submitBooking(null) },
    })
  },
  async submitBooking(arrivalTime) {
    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'submitBooking',
        data: { tableId: this.data.tableId, arrivalTime },
      })
      const result = res.result
      if (result.code !== 0) {
        wx.showToast({ title: result.msg, icon: 'none' })
        return
      }
      const msg = result.type === 'queue' ? `已加入排队，第 ${result.queueNo} 位` : '预约成功'
      wx.showToast({ title: msg, icon: 'success', duration: 2500 })
      await this.loadDetail(this.data.tableId)
    } catch (e) {
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ submitting: false })
    }
  },
  cancelMyBooking() {
    const bookingId = this.data.myBooking._id
    wx.showModal({
      title: '取消预约',
      content: '确定取消预约吗？',
      confirmText: '确定取消',
      confirmColor: '#e64340',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '处理中...' })
        try {
          const r = await wx.cloud.callFunction({ name: 'cancelBooking', data: { bookingId } })
          if (r.result.code === 0) {
            wx.showToast({ title: '已取消', icon: 'success' })
            await this.loadDetail(this.data.tableId)
          } else {
            wx.showToast({ title: r.result.msg, icon: 'none' })
          }
        } finally {
          wx.hideLoading()
        }
      },
    })
  },

  // ===== 管理员操作 =====
  tapSeat(e) {
    if (!this.data.isAdmin) return
    const booking = e.currentTarget.dataset.booking
    if (!booking) return
    this.showAdminActions(booking)
  },
  tapBookingRow(e) {
    if (!this.data.isAdmin) return
    const booking = e.currentTarget.dataset.booking
    this.showAdminActions(booking)
  },
  showAdminActions(booking) {
    const nick = booking.nick || '该用户'
    wx.showActionSheet({
      itemList: ['确认预约', '标记入座', '取消预约'],
      success: async (res) => {
        const statusMap = ['confirmed', 'seated', 'cancelled']
        const status = statusMap[res.tapIndex]
        wx.showLoading({ title: '更新中...' })
        try {
          const r = await wx.cloud.callFunction({
            name: 'updateBookingStatus',
            data: { bookingId: booking._id, status },
          })
          if (r.result.code === 0) {
            const labelMap = { confirmed: '已确认预约', seated: '已标记入座', cancelled: '已取消预约' }
            wx.showToast({ title: labelMap[status], icon: 'success' })
            await this.loadDetail(this.data.tableId)
          } else {
            wx.showToast({ title: r.result.msg, icon: 'none' })
          }
        } finally {
          wx.hideLoading()
        }
      },
    })
  },
})

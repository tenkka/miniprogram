Page({
  data: {
    activeTab: 0,
    loading: true,
    tables: [],
    bookings: [],
    posts: [],
    // 桌台编辑
    editTableShow: false,
    editingTable: null,
    editMaxplayer: '',
    // 用户管理
    users: [],
    filteredUsers: [],
    userSearchPhone: '',
    usersLoaded: false,
    loadingUsers: false,
    editUserShow: false,
    editingUser: null,
    editPower: '',
    editChampion: '',
    // 余额添加
    editRechargeAdd: '',
    editGiftAdd: '',
    editBalanceNote: '',
    addingBalance: false,
    // 余额划扣
    editDeductAmount: '',
    editDeductNote: '',
    deducting: false,
    // 积分管理
    editPointsAmount: '',
    editPointsDesc: '',
    addingPoints: false,
    editingUserPoints: null,
    // 余额明细
    balanceDetailShow: false,
    balanceDetailUser: null,
    balanceDetailLogs: [],
    loadingBalanceDetail: false,
    // 发布动态
    publishShow: false,
    publishContent: '',
    publishImages: [],
    publishing: false,
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'adminGetData' })
      if (res.result.code !== 0) {
        wx.showToast({ title: res.result.msg || '无权限', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1500)
        return
      }
      const { tables, bookings, posts } = res.result
      this.setData({ tables, bookings, posts })
    } catch (e) {
      console.error('adminGetData error:', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onTabChange(e) {
    const idx = e.detail.index
    this.setData({ activeTab: idx })
    if (idx === 3 && !this.data.usersLoaded) {
      this.loadUsers()
    }
  },

  // ===== 桌台管理 =====
  async toggleOpen(e) {
    const { tableId } = e.currentTarget.dataset
    const newValue = e.detail.value
    wx.showLoading({ title: '更新中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminUpdateTable',
        data: { tableId, updates: { isOpen: newValue } },
      })
      if (res.result.code === 0) {
        const tables = this.data.tables.map(t =>
          t._id === tableId ? { ...t, isOpen: newValue } : t
        )
        this.setData({ tables })
        wx.showToast({ title: newValue ? '已开放' : '已关闭', icon: 'success' })
      } else {
        wx.showToast({ title: res.result.msg, icon: 'none' })
      }
    } finally { wx.hideLoading() }
  },

  openEditMaxplayer(e) {
    const table = e.currentTarget.dataset.table
    this.setData({ editTableShow: true, editingTable: table, editMaxplayer: String(table.maxplayer) })
  },

  closeEditTable() {
    this.setData({ editTableShow: false, editingTable: null })
  },

  onMaxplayerInput(e) {
    this.setData({ editMaxplayer: e.detail.value })
  },

  async saveMaxplayer() {
    const val = parseInt(this.data.editMaxplayer)
    if (!val || val < 2 || val > 20) {
      wx.showToast({ title: '请输入 2~20 的数字', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminUpdateTable',
        data: { tableId: this.data.editingTable._id, updates: { maxplayer: val } },
      })
      if (res.result.code === 0) {
        this.setData({ editTableShow: false })
        await this.loadData()
        wx.showToast({ title: '已保存', icon: 'success' })
      }
    } finally { wx.hideLoading() }
  },

  // ===== 预约管理 =====
  changeStatus(e) {
    const { bookingId, status } = e.currentTarget.dataset
    const labels = ['待确认', '已确认', '取消预约']
    const statuses = ['pending', 'confirmed', 'cancelled']
    wx.showActionSheet({
      itemList: labels,
      success: async (res) => {
        const newStatus = statuses[res.tapIndex]
        if (newStatus === status) return
        wx.showLoading({ title: '更新中...' })
        try {
          const r = await wx.cloud.callFunction({
            name: 'updateBookingStatus',
            data: { bookingId, status: newStatus },
          })
          if (r.result.code === 0) {
            await this.loadData()
            wx.showToast({ title: '已更新', icon: 'success' })
          } else {
            wx.showToast({ title: r.result.msg, icon: 'none' })
          }
        } finally { wx.hideLoading() }
      },
    })
  },

  clearAllBookings() {
    wx.showModal({
      title: '清空所有预约',
      content: '此操作将删除全部预约记录，不可撤销，确认继续？',
      confirmText: '确认清空',
      confirmColor: '#E64340',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '清空中...' })
        try {
          const r = await wx.cloud.callFunction({ name: 'adminClearBookings' })
          if (r.result.code === 0) {
            await this.loadData()
            wx.showToast({ title: `已清空 ${r.result.deleted} 条`, icon: 'success' })
          } else {
            wx.showToast({ title: r.result.msg, icon: 'none' })
          }
        } catch (e) {
          wx.showToast({ title: '操作失败，请重试', icon: 'none' })
        } finally {
          wx.hideLoading()
        }
      },
    })
  },

  // ===== 广场管理 =====
  openPublish() {
    this.setData({ publishShow: true, publishContent: '', publishImages: [] })
  },

  closePublish() {
    if (this.data.publishing) return
    this.setData({ publishShow: false, publishContent: '', publishImages: [] })
  },

  onPublishContentInput(e) {
    this.setData({ publishContent: e.detail.value })
  },

  choosePublishImages() {
    const remaining = 9 - this.data.publishImages.length
    if (remaining <= 0) return
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      success: (res) => {
        const added = res.tempFiles.map(f => ({ tempFilePath: f.tempFilePath }))
        this.setData({ publishImages: [...this.data.publishImages, ...added] })
      },
    })
  },

  removePublishImage(e) {
    const idx = e.currentTarget.dataset.idx
    const publishImages = this.data.publishImages.filter((_, i) => i !== idx)
    this.setData({ publishImages })
  },

  async submitPublish() {
    const { publishContent, publishImages } = this.data
    if (!publishContent.trim() && publishImages.length === 0) {
      wx.showToast({ title: '请输入文字或选择图片', icon: 'none' })
      return
    }
    if (this.data.publishing) return
    this.setData({ publishing: true })
    wx.showLoading({ title: '发布中...' })
    try {
      const fileIds = []
      for (const img of publishImages) {
        const ext = img.tempFilePath.split('.').pop().split('?')[0] || 'jpg'
        const cloudPath = `posts/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const up = await wx.cloud.uploadFile({ cloudPath, filePath: img.tempFilePath })
        fileIds.push(up.fileID)
      }
      const res = await wx.cloud.callFunction({
        name: 'adminPublishPost',
        data: { content: publishContent.trim(), imageFileIds: fileIds },
      })
      if (res.result.code === 0) {
        this.setData({ publishShow: false, publishContent: '', publishImages: [] })
        await this.loadData()
        wx.showToast({ title: '发布成功', icon: 'success' })
      } else {
        wx.showToast({ title: res.result.msg || '发布失败', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '发布失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ publishing: false })
    }
  },

  async togglePin(e) {
    const { postId, pinned } = e.currentTarget.dataset
    wx.showLoading({ title: '更新中...' })
    try {
      const r = await wx.cloud.callFunction({
        name: 'adminManagePost',
        data: { postId, action: 'togglePin', value: !pinned },
      })
      if (r.result.code === 0) {
        await this.loadData()
        wx.showToast({ title: !pinned ? '已置顶' : '已取消置顶', icon: 'success' })
      }
    } finally { wx.hideLoading() }
  },

  deletePost(e) {
    const { postId } = e.currentTarget.dataset
    wx.showModal({
      title: '删除动态',
      content: '确认删除？此操作不可撤销。',
      confirmText: '删除',
      confirmColor: '#E64340',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '删除中...' })
        try {
          const r = await wx.cloud.callFunction({
            name: 'adminManagePost',
            data: { postId, action: 'delete' },
          })
          if (r.result.code === 0) {
            await this.loadData()
            wx.showToast({ title: '已删除', icon: 'success' })
          }
        } finally { wx.hideLoading() }
      },
    })
  },

  // ===== 用户管理 =====
  async loadUsers() {
    this.setData({ loadingUsers: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'adminGetUsers' })
      if (res.result.code === 0) {
        const users = res.result.users.map(u => ({
          ...u,
          totalBalance: ((u.rechargeBalance || 0) + (u.giftBalance || 0)).toFixed(2),
        }))
        this.setData({ users, filteredUsers: users, usersLoaded: true })
      } else {
        wx.showToast({ title: res.result.msg, icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loadingUsers: false })
    }
  },

  onUserSearchInput(e) {
    const q = (e.detail.value || '').trim()
    this.setData({ userSearchPhone: q })
    if (!q) {
      this.setData({ filteredUsers: this.data.users })
    } else {
      this.setData({ filteredUsers: this.data.users.filter(u => (u.phone || '').includes(q)) })
    }
  },

  openEditUser(e) {
    const user = e.currentTarget.dataset.user
    this.setData({
      editUserShow: true,
      editingUser: user,
      editPower: String(user.power || 0),
      editChampion: String(user.champion || 0),
      editRechargeAdd: '',
      editGiftAdd: '',
      editBalanceNote: '',
      editDeductAmount: '',
      editDeductNote: '',
      editPointsAmount: '',
      editPointsDesc: '',
      editingUserPoints: null,
    })
    // Fetch new-system points balance
    wx.cloud.callFunction({
      name: 'adminGetUserPoints',
      data: { targetOpenid: user.openid },
    }).then(res => {
      if (res.result && res.result.code === 0) {
        this.setData({ editingUserPoints: res.result.balance })
      }
    }).catch(() => {})
  },

  closeEditUser() {
    this.setData({ editUserShow: false, editingUser: null })
  },

  onPowerInput(e) {
    this.setData({ editPower: e.detail.value })
  },

  onChampionInput(e) {
    this.setData({ editChampion: e.detail.value })
  },

  async saveUser() {
    const power = parseInt(this.data.editPower) || 0
    const champion = parseInt(this.data.editChampion) || 0
    if (power < 0 || champion < 0) {
      wx.showToast({ title: '数值不能为负数', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminUpdateUser',
        data: { userId: this.data.editingUser._id, power, champion },
      })
      if (res.result.code === 0) {
        const users = this.data.users.map(u =>
          u._id === this.data.editingUser._id ? { ...u, power, champion } : u
        )
        const q = this.data.userSearchPhone
        const filteredUsers = q ? users.filter(u => (u.phone || '').includes(q)) : users
        this.setData({ editUserShow: false, users, filteredUsers })
        wx.showToast({ title: '已保存', icon: 'success' })
      } else {
        wx.showToast({ title: res.result.msg, icon: 'none' })
      }
    } finally { wx.hideLoading() }
  },

  onRechargeAddInput(e) { this.setData({ editRechargeAdd: e.detail.value }) },
  onGiftAddInput(e) { this.setData({ editGiftAdd: e.detail.value }) },
  onBalanceNoteInput(e) { this.setData({ editBalanceNote: e.detail.value }) },
  onDeductAmountInput(e) { this.setData({ editDeductAmount: e.detail.value }) },
  onDeductNoteInput(e) { this.setData({ editDeductNote: e.detail.value }) },
  onPointsAmountInput(e) { this.setData({ editPointsAmount: e.detail.value }) },
  onPointsDescInput(e) { this.setData({ editPointsDesc: e.detail.value }) },

  async adjustPoints() {
    const { editingUser, editPointsAmount, editPointsDesc } = this.data
    const amount = parseInt(editPointsAmount)
    if (!amount || amount === 0) {
      wx.showToast({ title: '请输入积分数量', icon: 'none' })
      return
    }
    if (this.data.addingPoints) return
    this.setData({ addingPoints: true })
    wx.showLoading({ title: amount > 0 ? '添加中...' : '扣除中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminAddPoints',
        data: {
          targetOpenid: editingUser.openid,
          amount,
          description: editPointsDesc || undefined,
        },
      })
      if (res.result.code === 0) {
        this.setData({
          editingUserPoints: res.result.balanceAfter,
          editPointsAmount: '',
          editPointsDesc: '',
        })
        wx.showToast({ title: `操作成功，余额 ${res.result.balanceAfter}`, icon: 'success' })
      } else {
        wx.showToast({ title: res.result.msg || '操作失败', icon: 'none' })
      }
    } catch (e) {
      console.error('adjustPoints error:', e)
      wx.showToast({ title: e.message || '操作失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ addingPoints: false })
    }
  },

  async deductBalance() {
    const { editingUser, editDeductAmount, editDeductNote } = this.data
    const amount = parseFloat(editDeductAmount)
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入划扣金额', icon: 'none' })
      return
    }
    const total = (editingUser.rechargeBalance || 0) + (editingUser.giftBalance || 0)
    if (amount > total) {
      wx.showToast({ title: `余额不足，当前 ¥${total.toFixed(2)}`, icon: 'none' })
      return
    }
    if (this.data.deducting) return
    this.setData({ deducting: true })
    wx.showLoading({ title: '划扣中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminDeductBalance',
        data: {
          targetOpenid: editingUser.openid,
          amount,
          note: editDeductNote,
        },
      })
      if (res.result.code === 0) {
        const newGift = res.result.remainGift
        const newRecharge = res.result.remainRecharge
        const totalBalance = (newGift + newRecharge).toFixed(2)
        const q = this.data.userSearchPhone
        const users = this.data.users.map(u =>
          u._id === editingUser._id
            ? { ...u, giftBalance: newGift, rechargeBalance: newRecharge, totalBalance }
            : u
        )
        const filteredUsers = q ? users.filter(u => (u.phone || '').includes(q)) : users
        this.setData({
          users,
          filteredUsers,
          'editingUser.giftBalance': newGift,
          'editingUser.rechargeBalance': newRecharge,
          editDeductAmount: '',
          editDeductNote: '',
        })
        wx.showToast({ title: '划扣成功', icon: 'success' })
      } else {
        wx.showToast({ title: res.result.msg || '划扣失败', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '划扣失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ deducting: false })
    }
  },

  async viewUserBalance(e) {
    const { openid, nick } = e.currentTarget.dataset
    const eu = this.data.editingUser
    this.setData({
      balanceDetailShow: true,
      balanceDetailUser: {
        openid,
        nick,
        rechargeBalance: eu ? (eu.rechargeBalance || 0) : 0,
        giftBalance: eu ? (eu.giftBalance || 0) : 0,
      },
      balanceDetailLogs: [],
      loadingBalanceDetail: true,
    })
    try {
      const res = await wx.cloud.callFunction({ name: 'adminGetUserBalance', data: { targetOpenid: openid } })
      if (res.result.code === 0) {
        this.setData({
          balanceDetailLogs: res.result.logs.map(l => this.formatBalanceLog(l)),
          'balanceDetailUser.rechargeBalance': res.result.rechargeBalance,
          'balanceDetailUser.giftBalance': res.result.giftBalance,
        })
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loadingBalanceDetail: false })
    }
  },

  closeBalanceDetail() {
    this.setData({ balanceDetailShow: false })
  },

  formatBalanceLog(log) {
    const recharge = log.rechargeAmount || 0
    const gift = log.giftAmount || 0
    const total = recharge + gift
    const isPositive = total >= 0

    let typeLabel = '手动添加'
    if (log.type === 'consume') typeLabel = '消费'
    else if (log.type === 'recharge') typeLabel = '充值'
    else if (log.type === 'refund') typeLabel = '退款'

    const parts = []
    if (recharge !== 0) parts.push(`充值 ${recharge > 0 ? '+' : ''}¥${Math.abs(recharge).toFixed(2)}`)
    if (gift !== 0) parts.push(`赠送 ${gift > 0 ? '+' : ''}¥${Math.abs(gift).toFixed(2)}`)
    const amountText = parts.join(' + ') || '¥0.00'

    const d = new Date(log.createdAt)
    const pad = n => String(n).padStart(2, '0')
    const formattedDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`

    return { ...log, typeLabel, amountText, isPositive, formattedDate }
  },

  async addBalance() {
    const { editingUser, editRechargeAdd, editGiftAdd, editBalanceNote } = this.data
    const recharge = parseFloat(editRechargeAdd) || 0
    const gift = parseFloat(editGiftAdd) || 0
    if (recharge === 0 && gift === 0) {
      wx.showToast({ title: '请输入金额', icon: 'none' })
      return
    }
    if (this.data.addingBalance) return
    this.setData({ addingBalance: true })
    wx.showLoading({ title: '添加中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminAddBalance',
        data: {
          targetOpenid: editingUser.openid,
          rechargeAmount: recharge,
          giftAmount: gift,
          note: editBalanceNote,
        },
      })
      if (res.result.code === 0) {
        const newRecharge = (editingUser.rechargeBalance || 0) + recharge
        const newGift = (editingUser.giftBalance || 0) + gift
        const totalBalance = (newRecharge + newGift).toFixed(2)
        const users = this.data.users.map(u =>
          u._id === editingUser._id
            ? { ...u, rechargeBalance: newRecharge, giftBalance: newGift, totalBalance }
            : u
        )
        const q = this.data.userSearchPhone
        const filteredUsers = q ? users.filter(u => (u.phone || '').includes(q)) : users
        this.setData({
          users,
          filteredUsers,
          'editingUser.rechargeBalance': newRecharge,
          'editingUser.giftBalance': newGift,
          editRechargeAdd: '',
          editGiftAdd: '',
          editBalanceNote: '',
        })
        wx.showToast({ title: '余额已添加', icon: 'success' })
      } else {
        wx.showToast({ title: res.result.msg, icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '添加失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ addingBalance: false })
    }
  },
})

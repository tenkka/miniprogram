Page({
  data: {
    balance: 0,
    items: [],
    loading: true,
    confirmShow: false,
    selectedItem: null,
    redeeming: false,
  },

  async onLoad() {
    await this.loadData()
  },

  async onShow() {
    // Refresh balance on return
    this.loadBalance()
  },

  async loadData() {
    this.setData({ loading: true })
    const store = wx.getStorageSync('currentStore')
    const storeId = store ? store.id : null
    try {
      const [infoRes, itemsRes] = await Promise.all([
        wx.cloud.callFunction({ name: 'getPointsInfo' }),
        wx.cloud.callFunction({ name: 'getSnackItems', data: { storeId } }),
      ])
      this.setData({
        balance: infoRes.result.balance || 0,
        items: itemsRes.result.list || [],
      })
    } catch (e) {
      console.error('shop loadData error:', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadBalance() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getPointsInfo' })
      if (res.result.code === 0) {
        this.setData({ balance: res.result.balance || 0 })
      }
    } catch (e) { /* non-fatal */ }
  },

  onItemTap(e) {
    const item = e.currentTarget.dataset.item
    if (this.data.balance < item.pointsCost) {
      wx.showToast({ title: `积分不足，还差 ${item.pointsCost - this.data.balance} 积分`, icon: 'none' })
      return
    }
    this.setData({ selectedItem: item, confirmShow: true })
  },

  closeConfirm() {
    this.setData({ confirmShow: false, selectedItem: null })
  },

  async confirmRedeem() {
    if (this.data.redeeming || !this.data.selectedItem) return
    this.setData({ redeeming: true })
    try {
      const currentStore = wx.getStorageSync('currentStore') || {}
      const res = await wx.cloud.callFunction({
        name: 'redeemSnack',
        data: {
          itemId: this.data.selectedItem._id,
          qty: 1,
          storeId: currentStore._id || '',
          storeName: currentStore.name || '',
        },
      })
      if (res.result.code === 0) {
        this.setData({
          balance: res.result.balanceAfter,
          confirmShow: false,
          selectedItem: null,
        })
        wx.showToast({ title: res.result.msg || '兑换成功', icon: 'success' })
        // Refresh item list to update stock
        const store = wx.getStorageSync('currentStore')
        const itemsRes = await wx.cloud.callFunction({ name: 'getSnackItems', data: { storeId: store ? store.id : null } })
        this.setData({ items: itemsRes.result.list || [] })
      } else {
        wx.showToast({ title: res.result.msg || '兑换失败', icon: 'none' })
        this.setData({ confirmShow: false })
      }
    } catch (e) {
      console.error('redeemSnack error:', e)
      wx.showToast({ title: '网络异常，请重试', icon: 'none' })
    } finally {
      this.setData({ redeeming: false })
    }
  },
})

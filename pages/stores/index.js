Page({
  data: {
    cities: [],
    selectedCity: '',
    allStores: [],
    cityStores: [],
    loading: true,
    currentStoreId: null,
  },

  async onLoad() {
    const saved = wx.getStorageSync('currentStore')
    if (saved) this.setData({ currentStoreId: saved._id })
    await this.loadStores()
  },

  async loadStores() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getStores' })
      const list = res.result.list || []

      // 提取去重城市列表（保持原始顺序）
      const citySet = []
      list.forEach(s => {
        if (!citySet.includes(s.city)) citySet.push(s.city)
      })

      const selectedCity = citySet[0] || ''
      this.setData({
        cities: citySet,
        selectedCity,
        allStores: list,
        cityStores: list.filter(s => s.city === selectedCity),
        loading: false,
      })
    } catch (e) {
      console.error('getStores error:', e)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
    }
  },

  selectCity(e) {
    const city = e.currentTarget.dataset.city
    this.setData({
      selectedCity: city,
      cityStores: this.data.allStores.filter(s => s.city === city),
    })
  },

  callPhone(e) {
    const phone = e.currentTarget.dataset.phone
    wx.makePhoneCall({ phoneNumber: phone })
  },

  copyAddress(e) {
    const address = e.currentTarget.dataset.address
    wx.setClipboardData({ data: address, success: () => wx.showToast({ title: '已复制地址', icon: 'success' }) })
  },

  onSelectStore(e) {
    const store = e.currentTarget.dataset.store
    wx.setStorageSync('currentStore', store)
    this.setData({ currentStoreId: store._id })
    wx.navigateBack()
  },
})

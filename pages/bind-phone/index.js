Page({
  data: {
    isBound: false,
    maskedPhone: '',
    binding: false,
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '绑定手机号' })
    this.checkBound()
  },

  onShow() {
    this.checkBound()
  },

  checkBound() {
    const userInfo = wx.getStorageSync('userInfo') || {}
    const phone = userInfo.phone || ''
    this.setData({
      isBound: !!phone,
      maskedPhone: phone ? this.maskPhone(phone) : '',
    })
  },

  maskPhone(phone) {
    if (!phone || phone.length < 7) return phone
    return phone.slice(0, 3) + '****' + phone.slice(-4)
  },

  async onGetPhoneNumber(e) {
    const errno = e.detail.errno
    if (errno !== undefined && errno !== 0) {
      const msg = errno === 20001 ? '您已取消授权' : `授权失败 (errno: ${errno})`
      console.error('getPhoneNumber client error:', JSON.stringify(e.detail))
      wx.showToast({ title: msg, icon: 'none' })
      return
    }
    const code = e.detail.code
    if (!code) {
      console.error('getPhoneNumber: no code in detail:', JSON.stringify(e.detail))
      wx.showToast({ title: '未获取到授权码，请重试', icon: 'none' })
      return
    }
    this.setData({ binding: true })
    wx.showLoading({ title: '绑定中...' })
    try {
      const res = await wx.cloud.callFunction({ name: 'bindPhone', data: { code } })
      if (res.result.code === 0) {
        const phone = res.result.phone
        const userInfo = wx.getStorageSync('userInfo') || {}
        userInfo.phone = phone
        wx.setStorageSync('userInfo', userInfo)
        this.setData({ isBound: true, maskedPhone: this.maskPhone(phone) })
        wx.showToast({ title: '绑定成功', icon: 'success' })
      } else {
        const msg = res.result.msg || '绑定失败'
        console.error('bindPhone failed:', JSON.stringify(res.result))
        wx.showModal({ title: '绑定失败', content: msg, showCancel: false, confirmText: '确定' })
      }
    } catch (err) {
      console.error('bindPhone error:', err)
      wx.showToast({ title: '绑定失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ binding: false })
    }
  },
})

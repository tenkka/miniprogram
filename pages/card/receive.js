const WXAPI = require('apifm-wxapi')
Page({
  data: {
  },
  onLoad (e) {

    wx.setNavigationBarTitle({
      title: '请你喝杯奶茶~',
    })
    this.setData({
      id: e.id,
      shareToken: e.shareToken
    })
    this.cardShareFetch(true)
  },
  submit() {
    this.cardShareFetch(false)
  },
  async cardShareFetch(calculate) {
    wx.showLoading({
      title: '',
    })
    // https://www.yuque.com/apifm/nu0f75/gmfdsdag0gxv8tp0
    const res = await WXAPI.cardShareFetch({
      token: wx.getStorageSync('token'),
      id: this.data.id,
      shareToken: this.data.shareToken,
      calculate
    })
    wx.hideLoading()
    if (res.code == 0) {
      if (calculate) {
        this.setData({
          user: res.data.user,
          cardUser: res.data.cardUser,
          cardInfo: res.data.cardInfo,
        })
      } else {
        wx.showModal({
          content: '礼品卡已存入卡包',
          showCancel: false,
          confirmText: '知道了',
          success: (res) => {
            wx.reLaunch({
              url: '/pages/home/index',
            })
          }
        })
      }
    } else {
      wx.showModal({
        content: '当前礼品卡不存在或已被领取',
        showCancel: false,
        confirmText: '知道了',
        success: (res) => {
          wx.reLaunch({
            url: '/pages/home/index',
          })
        }
      })
    }
  },
})
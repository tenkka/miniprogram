const WXAPI = require('apifm-wxapi')
Page({
  data: {
    agree: false,
  },
  onLoad: function (options) {

    wx.setNavigationBarTitle({
      title: '兑换礼品卡',
    })
  },
  _agree() {
    this.setData({
      agree: !this.data.agree
    })
  },
  xieyi() {
    wx.navigateTo({
      url: '/pages/about/index?key=lipinkaxieyi',
    })
  },
  async submit(){
    if (!this.data.number) {
      wx.showToast({
        title: '请输入兑换码',
        icon: 'none'
      })
      return
    }
    if (!this.data.agree) {
      wx.showToast({
        title: '请先阅读并同意《礼品卡使用协议》',
        icon: 'none'
      })
      return
    }
    wx.showLoading({
      title: '',
    })
    // https://www.yuque.com/apifm/nu0f75/twoctygmpqlhnfkm
    const res = await WXAPI.cardExchangeFromPwd({
      token: wx.getStorageSync('token'),
      number: this.data.number
    })
    wx.hideLoading()
    if (res.code == 0) {
      wx.showModal({
        content: '兑换成功',
        showCancel: false,
        success: (res) => {
          wx.setStorageSync('cardmyrefresh', true)
          wx.navigateBack()
        }
      })
    } else {
      wx.showToast({
        title: res.msg,
        icon: 'none'
      })
    }
  },
})
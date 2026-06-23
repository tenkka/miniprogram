const APP = getApp()
const WXAPI = require('apifm-wxapi')
const AUTH = require('../../utils/auth')
const { requirePhone } = require('../../utils/phoneCheck')

// fixed首次打开不显示标题的bug
APP.configLoadOK = () => {
  
}

Page({
  data: {
    
  },
  onLoad: function (options) {

    wx.setNavigationBarTitle({
        title: '已点菜品',
    })
  },
  onShow: function () {
    this.fetchOrder()
  },
  onPullDownRefresh() {
    this.fetchOrder()
    wx.stopPullDownRefresh()
  },
  async fetchOrder() {
    wx.showLoading({
      title: '',
    })
    const res = await WXAPI.orderList({
      token: wx.getStorageSync('token'),
      status: 0
    })
    wx.hideLoading({
      success: (res) => {},
    })
    if (res.code == 0) {
      this.setData({
        orderInfo: res.data.orderList[0],
        goodsList: res.data.goodsMap[res.data.orderList[0].id],
      })
    }
  },
  async goPayOrder() {
    if (!requirePhone('支付前需要先绑定手机号')) return
    // token 需要使用买单这个用户的token，而不是当前餐桌的token
    const code = await AUTH.wxaCode()
    let res = await WXAPI.authorize({
      code
    })
    if (res.code != 0) {
      wx.showModal({
        confirmText: '确定',
        cancelText: '取消',
        content: res.msg,
        showCancel: false
      })
      return
    }
    wx.setStorageSync('payToken', res.data.token) // 支付用户的token
    this.setData({
      paymentShow: true,
      money: this.data.orderInfo.amountReal,
      nextAction: {
        // https://www.yuque.com/apifm/doc/aetmlb#8tiFW
        type: 9,
        orderId: this.data.orderInfo.id
      }
    })
  },
  paymentOk(e) {
    console.log(e.detail); // 这里是组件里data的数据
    this.setData({
      paymentShow: false,
      paySuccess: true
    })
  },
  paymentCancel() {
    this.setData({
      paymentShow: false
    })
  },
})
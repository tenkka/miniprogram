const { requireLogin } = require('../../utils/requireLogin')

Page({
  data: {
    packages: [
      { id: 1, recharge: 1966, gift: 666 },
      { id: 2, recharge: 4966, gift: 2566 },
      { id: 3, recharge: 9966, gift: 6166 },
    ],
    showModal: false,
    selectedPkg: null,
    paying: false,
  },

  onSelectPkg(e) {
    if (!requireLogin()) return
    const idx = e.currentTarget.dataset.idx
    this.setData({ selectedPkg: this.data.packages[idx], showModal: true })
  },

  closeModal() {
    if (this.data.paying) return
    this.setData({ showModal: false, selectedPkg: null })
  },

  async confirmRecharge() {
    if (this.data.paying) return
    const pkg = this.data.selectedPkg
    this.setData({ paying: true })
    try {
      // 1. 创建微信支付订单
      const orderRes = await wx.cloud.callFunction({
        name: 'createPayOrder',
        data: { price: pkg.recharge, productName: `充值 ¥${pkg.recharge}` },
      })
      if (orderRes.result.code !== 0) {
        wx.showToast({ title: orderRes.result.msg || '创建订单失败', icon: 'none' })
        return
      }

      // 2. 拉起微信支付
      const { payParams, outTradeNo } = orderRes.result
      await wx.requestPayment({
        timeStamp: payParams.timeStamp,
        nonceStr: payParams.nonceStr,
        package: payParams.package,
        signType: payParams.signType,
        paySign: payParams.paySign,
      })

      // 3. 支付成功，写入余额和流水
      await wx.cloud.callFunction({
        name: 'createRecharge',
        data: { rechargeAmount: pkg.recharge, giftAmount: pkg.gift, outTradeNo },
      })

      this.setData({ showModal: false, selectedPkg: null })
      wx.showToast({ title: '充值成功', icon: 'success' })
    } catch (e) {
      if (e && e.errMsg && e.errMsg.includes('cancel')) {
        wx.showToast({ title: '已取消支付', icon: 'none' })
      } else {
        console.error('recharge error:', e)
        wx.showToast({ title: e.message || '充值失败，请重试', icon: 'none' })
      }
    } finally {
      this.setData({ paying: false })
    }
  },
})

const { requireLogin } = require('../../utils/requireLogin')

Page({
  data: {
    packages: [
      { id: 1, recharge: 2000, bonusPoints: 170000 },
      { id: 2, recharge: 5000, bonusPoints: 435000 },
      { id: 3, recharge: 10000, bonusPoints: 1535000 },
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
      const currentStore = wx.getStorageSync('currentStore') || {}
      await wx.cloud.callFunction({
        name: 'createRecharge',
        data: {
          rechargeAmount: pkg.recharge,
          giftAmount: 0,
          outTradeNo,
          storeId: currentStore._id || '',
          storeName: currentStore.name || '',
        },
      })

      // 4. 赠送积分
      await wx.cloud.callFunction({
        name: 'earnPoints',
        data: {
          amount: pkg.bonusPoints,
          source: 'recharge',
          sourceId: outTradeNo,
          description: `充值¥${pkg.recharge}赠送${pkg.bonusPoints}积分`,
        },
      })

      this.setData({ showModal: false, selectedPkg: null })
      wx.showToast({ title: `充值成功，已赠送${pkg.bonusPoints}积分`, icon: 'success' })
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

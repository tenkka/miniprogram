const { requireLogin } = require('../../utils/requireLogin')
const CLOUD_BASE = 'cloud://cloud1-d3gr4sr26cf1d38a2.636c-cloud1-d3gr4sr26cf1d38a2-1423192796/product/'

const RAW_PRODUCTS = [
  { id: 1, name: '138 酒水套餐', price: 138, cloudImage: CLOUD_BASE + 'combo_138.png', desc: '基础饮品畅饮，赠送3000积分' },
  { id: 2, name: '218 酒水套餐', price: 218, cloudImage: CLOUD_BASE + 'combo_218.jpg', desc: '基础饮品+鸡尾酒畅饮，赠送5000积分' },
  { id: 3, name: '398 酒水套餐', price: 398, cloudImage: CLOUD_BASE + 'combo_398.jpg', desc: '基础饮品+特调鸡尾酒畅饮，赠送10000积分' },
  { id: 4, name: '99 早鸟票 - 20点前到店可使用', price: 99, cloudImage: CLOUD_BASE + 'special_99.jpg', desc: '晚8点前到店可用，基础饮品畅饮，赠送3000积分' },
  { id: 5, name: '89 下午茶特惠 - 13-17点可用', price: 89, cloudImage: CLOUD_BASE + 'special_99.jpg', desc: '下午茶特惠，13-17点间可用，茶水畅饮+精美点心1份，赠送3000积分' },
]

Page({
  data: {
    products: RAW_PRODUCTS.map(p => ({ ...p, image: '' })),
    showPayModal: false,
    selectedProduct: null,
    totalBalance: 0,
    balanceDeduct: 0,   // 本次从余额扣除
    wechatAmount: 0,    // 本次微信支付金额
    paying: false,
  },

  onLoad() {
    this._loadImages()
  },

  async _loadImages() {
    const uniqueIds = [...new Set(RAW_PRODUCTS.map(p => p.cloudImage))]
    try {
      const res = await wx.cloud.callFunction({ name: 'getProductImages', data: { fileList: uniqueIds } })
      if (res.result.code === 0) {
        const urlMap = res.result.urlMap
        this.setData({ products: RAW_PRODUCTS.map(p => ({ ...p, image: urlMap[p.cloudImage] || '' })) })
      }
    } catch (e) { console.error('getProductImages error:', e) }
  },

  async onBuy(e) {
    if (!requireLogin()) return
    const idx = e.currentTarget.dataset.idx
    const product = this.data.products[idx]

    let totalBalance = 0
    try {
      const res = await wx.cloud.callFunction({ name: 'getUserBalance' })
      if (res.result.code === 0) {
        totalBalance = +((res.result.rechargeBalance || 0) + (res.result.giftBalance || 0)).toFixed(2)
      }
    } catch (e) { /* 余额获取失败不阻塞弹窗 */ }

    const balanceDeduct = +Math.min(totalBalance, product.price).toFixed(2)
    const wechatAmount = +(product.price - balanceDeduct).toFixed(2)

    this.setData({ selectedProduct: product, totalBalance, balanceDeduct, wechatAmount, showPayModal: true })
  },

  closePayModal() {
    if (this.data.paying) return
    this.setData({ showPayModal: false, selectedProduct: null })
  },

  async confirmPay() {
    if (this.data.paying) return
    const { selectedProduct: product, balanceDeduct, wechatAmount } = this.data
    this.setData({ paying: true })
    try {
      if (wechatAmount > 0) {
        await this._payMixed(product, balanceDeduct, wechatAmount)
      } else {
        await this._payWithBalance(product, balanceDeduct)
      }
    } catch (e) {
      if (e && e.errMsg && e.errMsg.includes('cancel')) {
        wx.showToast({ title: '已取消支付', icon: 'none' })
      } else {
        wx.showToast({ title: e.message || '支付失败', icon: 'none' })
      }
    } finally {
      this.setData({ paying: false })
    }
  },

  // 纯余额支付
  async _payWithBalance(product, balanceDeduct) {
    const res = await wx.cloud.callFunction({
      name: 'purchaseProduct',
      data: { productId: product.id, productName: product.name, price: balanceDeduct, realPrice: product.price },
    })
    if (res.result.code === 0) {
      this.setData({ showPayModal: false, selectedProduct: null })
      const gs = res.result.giftScore || 0
      wx.showToast({ title: gs > 0 ? `购买成功 +${gs}积分` : '购买成功', icon: gs > 0 ? 'none' : 'success' })
    } else {
      wx.showToast({ title: res.result.msg || '购买失败', icon: 'none' })
    }
  },

  // 余额 + 微信混合支付（或纯微信）
  async _payMixed(product, balanceDeduct, wechatAmount) {
    // 先拉起微信支付（用户取消时不扣余额）
    const orderRes = await wx.cloud.callFunction({
      name: 'createPayOrder',
      data: { price: wechatAmount, productName: product.name },
    })
    if (orderRes.result.code !== 0) {
      console.error('createPayOrder result:', JSON.stringify(orderRes.result))
      wx.showToast({ title: orderRes.result.msg || '创建订单失败', icon: 'none' })
      return
    }
    const { payParams, outTradeNo } = orderRes.result
    await wx.requestPayment({
      timeStamp: payParams.timeStamp,
      nonceStr: payParams.nonceStr,
      package: payParams.package,
      signType: payParams.signType,
      paySign: payParams.paySign,
    })
    // 微信支付成功后再扣余额并记录
    await wx.cloud.callFunction({
      name: 'purchaseProduct',
      data: {
        productId: product.id,
        productName: product.name,
        price: balanceDeduct,
        wechatAmount,
        outTradeNo,
        realPrice: product.price,
      },
    })
    this.setData({ showPayModal: false, selectedProduct: null })
    wx.showToast({ title: '支付成功', icon: 'success' })
  },
})

const { requireLogin } = require('../../utils/requireLogin')
const AUTH = require('../../utils/auth')

Page({
  data: {
    isLogined: false,
    inviteCode: '',
    canBind: false,      // 是否还能填写邀请人邀请码（新客且未绑定）
    bound: false,        // 是否已绑定邀请人
    isOldCustomer: false,
    inputCode: '',
    binding: false,
    totalInvited: 0,
    totalReward: 0,
    list: [],
    rules: [
      '本活动不与店内其他优惠同享',
      '新客定义：未注册小程序用户，或已注册但无德州扑克体验记录的用户',
      '活动可多次参加，邀请好友越多积分越多',
      '奖励为新人酒水套餐赠送积分的 50%，仅限新人首次购入有效',
    ],
  },

  onLoad(options) {
    wx.setNavigationBarTitle({ title: '邀请有礼' })
    // 通过分享链接进入时预填邀请人邀请码
    if (options && options.code) {
      this.setData({ inputCode: String(options.code).trim().toUpperCase() })
    }
  },

  onShow() {
    AUTH.checkHasLogined().then(isLogined => {
      this.setData({ isLogined })
      if (isLogined) this.loadData()
    })
  },

  async loadData() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getReferralData' })
      const r = res.result
      if (r.code === 0) {
        const list = (r.list || []).map(it => ({
          ...it,
          statusText: it.status === 'rewarded' ? `已奖励 +${it.rewardPower}` : '待消费',
        }))
        this.setData({
          inviteCode: r.inviteCode,
          canBind: r.canBind,
          bound: r.bound,
          isOldCustomer: r.isOldCustomer,
          totalInvited: r.totalInvited,
          totalReward: r.totalReward,
          list,
        })
      }
    } catch (e) {
      console.error('getReferralData error:', e)
    }
  },

  copyInviteCode() {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => wx.showToast({ title: '邀请码已复制', icon: 'none' }),
    })
  },

  onInputCode(e) {
    this.setData({ inputCode: e.detail.value })
  },

  async bindCode() {
    if (!requireLogin()) return
    const code = (this.data.inputCode || '').trim()
    if (!code) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' })
      return
    }
    if (this.data.binding) return
    this.setData({ binding: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'bindReferrer', data: { code } })
      const r = res.result
      if (r.code === 0) {
        wx.showToast({ title: '绑定成功', icon: 'success' })
        this.setData({ inputCode: '' })
        this.loadData()
      } else {
        wx.showToast({ title: r.msg || '绑定失败', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '绑定失败，请重试', icon: 'none' })
    } finally {
      this.setData({ binding: false })
    }
  },

  onShareAppMessage() {
    return {
      title: '邀请你来 NUTS 体验德州扑克，新人首单有好礼',
      path: `/pages/invite/index?code=${this.data.inviteCode}`,
    }
  },
})

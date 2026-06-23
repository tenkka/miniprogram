const WXAPI = require('apifm-wxapi')
const AUTH = require('../../utils/auth')
const APP = getApp()
APP.configLoadOK = () => {

}
Page({
  data: {
    apiOk: false
  },
  cancelOrderTap: function(e) {
    const that = this;
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      confirmText: '确定',
      cancelText: '取消',
      content: '确定要取消该订单吗？',
      success: function(res) {
        if (res.confirm) {
          WXAPI.orderClose(wx.getStorageSync('token'), orderId).then(function(res) {
            if (res.code == 0) {
              that.onShow();
            }
          })
        }
      }
    })
  },
  toPayTap: function(e) {
    // 防止连续点击--开始
    if (this.data.payButtonClicked) {
      wx.showToast({
        title: '休息一下~',
        icon: 'none'
      })
      return
    }
    this.data.payButtonClicked = true
    setTimeout(() => {
      this.data.payButtonClicked = false
    }, 3000)  // 可自行修改时间间隔（目前是3秒内只能点击一次支付按钮）
    // 防止连续点击--结束
    const that = this;
    const orderId = e.currentTarget.dataset.id;
    let money = e.currentTarget.dataset.money;
    const needScore = e.currentTarget.dataset.score;
    WXAPI.userAmount(wx.getStorageSync('token')).then(function(res) {
      if (res.code == 0) {
        // 增加提示框
        if (res.data.score < needScore) {
          wx.showToast({
            title: '您的积分不足，无法支付',
            icon: 'none'
          })
          return;
        }
        let _msg = '订单金额' + ' ' + money
        if (res.data.balance > 0) {
          _msg += ' ' + '可用余额' + ' ' + res.data.balance
          if (money - res.data.balance > 0) {
            _msg += ' ' + '仍需支付' + ' ' + (money - res.data.balance)
          }          
        }
        if (needScore > 0) {
          _msg += ' ' + '需要扣除积分:' + ' ' + needScore
        }
        money = money - res.data.balance
        wx.showModal({
          content: _msg,
          confirmText: '确定',
          cancelText: '取消',
          success: function (res) {
            console.log(res);
            if (res.confirm) {
              that._toPayTap(orderId, money)
            }
          }
        });
      } else {
        wx.showModal({
          confirmText: '确定',
          cancelText: '取消',
          content: '无法获取用户资金信息',
          showCancel: false
        })
      }
    })
  },
  _toPayTap: function (orderId, money){
    const _this = this
    if (money <= 0) {
      // 直接使用余额支付
      WXAPI.orderPay(wx.getStorageSync('token'), orderId).then(function (res) {
        _this.onShow();
      })
    } else {
      this.setData({
        paymentShow: true,
        orderId,
        money,
        nextAction: {
          type: 0,
          id: orderId
        }
      })
    }
  },
  paymentOk(e) {
    console.log(e.detail); // 这里是组件里data的数据
    this.setData({
      paymentShow: false
    })
    wx.redirectTo({
      url: '/pages/all-orders/index',
    })
  },
  paymentCancel() {
    this.setData({
      paymentShow: false
    })
  },
  onLoad: function(options) {

    wx.setNavigationBarTitle({
      title: '全部订单',
    })
  },
  onShow: function() {
    AUTH.checkHasLogined().then(isLogined => {
      if (isLogined) {
        this.doneShow();
      } else {
        wx.showModal({
          confirmText: '确定',
          cancelText: '取消',
          content: '登陆后才能访问',
          showCancel: false,
          success: () => {
            wx.navigateBack()
          }
        })
      }
    })
  },
  async doneShow() {
    wx.showLoading({
      title: '',
    })
    const res = await WXAPI.orderList({
      token: wx.getStorageSync('token')
    })
    wx.hideLoading()
    if (res.code == 0) {
      const orderList = res.data.orderList
      orderList.forEach(ele => {
        if (ele.status == -1) {
          ele.statusStr = '已取消'
        }
        if (ele.status == 1 && ele.isNeedLogistics) {
          ele.statusStr = '配送中'
        }
        if (ele.status == 1 && !ele.isNeedLogistics) {
          ele.statusStr = '待取餐'
        }
        if (ele.status == 3) {
          ele.statusStr = '已完成'
        }
      })
      this.setData({
        orderList: res.data.orderList,
        logisticsMap: res.data.logisticsMap,
        goodsMap: res.data.goodsMap,
        apiOk: true
      });
      
    } else {
      this.setData({
        orderList: null,
        logisticsMap: {},
        goodsMap: {},
        apiOk: true
      });
    }
  },
  toIndexPage: function() {
    wx.switchTab({
      url: "/pages/index/index"
    });
  },
  // 删除订单
  deleteOrder: function(e){
    const that = this
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      confirmText: '确定',
      cancelText: '取消',
      content: '确定要删除该订单吗？',
      success: function (res) {
        if (res.confirm) {
          WXAPI.orderDelete(wx.getStorageSync('token'), id).then(function (res) {  
            if (res.code == 0) {
              that.onShow(); //重新获取订单列表
            }              
            
          })
        }
      }
    })
  },
  async callShop(e) {
    const shopId = e.currentTarget.dataset.shopid
    const res = await WXAPI.shopSubdetail(shopId)
    if (res.code != 0) {
      wx.showToast({
        title: res.msg,
        icon: 'none'
      })
      return
    }
    wx.makePhoneCall({
      phoneNumber: res.data.info.linkPhone,
    })
  },
})
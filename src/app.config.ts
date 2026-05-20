export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/execution/index'
  ],
  lazyCodeLoading: 'requiredComponents',
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '服装搭配',
    navigationBarTextStyle: 'black'
  },
  permission: {
    'scope.record': {
      desc: '用于记录搭配理由，帮助生成更贴近你审美的搭配建议'
    },
    'scope.writePhotosAlbum': {
      desc: '用于把拍摄的服装照片保存到手机相册'
    }
  },
  plugins: {
    WechatSI: {
      version: '0.3.7',
      provider: 'wx069ba97219f66d99'
    }
  }
})

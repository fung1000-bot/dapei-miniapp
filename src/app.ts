import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'

import './app.scss'

const CLOUD_ENV_ID = process.env.TARO_CLOUD_ENV_ID || 'xiaochengxu-d1gnauqul33de2ac9'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    if (process.env.TARO_ENV === 'weapp' && wx.cloud) {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true
      })
    }

    console.log('App launched.')
  })

  // children 是将要会渲染的页面
  return children
}
  


export default App

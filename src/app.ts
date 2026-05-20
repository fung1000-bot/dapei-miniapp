import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'

import { getCurrentOpenId } from './services/auth'
import './app.scss'

const CLOUD_ENV_ID = process.env.TARO_CLOUD_ENV_ID || 'xiaochengxu-d1gnauqul33de2ac9'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    if (process.env.TARO_ENV === 'weapp' && wx.cloud) {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true
      })

      getCurrentOpenId()
        .then(openId => {
          console.log('[auth] miniapp login success', openId)
        })
        .catch(error => {
          console.warn('[auth] miniapp login failed', error)
        })
    }

    console.log('App launched.')
  })

  // children 是将要会渲染的页面
  return children
}
  


export default App

import Taro from '@tarojs/taro'

const OPEN_ID_STORAGE_KEY = 'wechat_open_id'

type LoginFunctionResult = {
  ok?: boolean
  openId?: string
  code?: string
  message?: string
}

let cachedOpenId = ''
let loginPromise: Promise<string> | null = null

function readStoredOpenId () {
  try {
    return String(Taro.getStorageSync(OPEN_ID_STORAGE_KEY) || '')
  } catch (error) {
    return ''
  }
}

function writeStoredOpenId (openId: string) {
  cachedOpenId = openId

  try {
    Taro.setStorageSync(OPEN_ID_STORAGE_KEY, openId)
  } catch (error) {
    console.warn('[auth] failed to cache openId', error)
  }
}

export async function loginAndFetchOpenId () {
  if (process.env.TARO_ENV !== 'weapp') {
    return ''
  }

  if (!wx.cloud?.callFunction) {
    throw new Error('Cloud function is not available.')
  }

  await Taro.login()

  const result = await wx.cloud.callFunction({
    name: 'login'
  })
  const response = result?.result as LoginFunctionResult | undefined
  const openId = response?.ok && response.openId ? String(response.openId) : ''

  if (!openId) {
    throw new Error(response?.message || response?.code || 'Failed to get openId.')
  }

  writeStoredOpenId(openId)

  return openId
}

export async function getCurrentOpenId () {
  if (cachedOpenId) return cachedOpenId

  const storedOpenId = readStoredOpenId()

  if (storedOpenId) {
    cachedOpenId = storedOpenId
    return storedOpenId
  }

  if (!loginPromise) {
    loginPromise = loginAndFetchOpenId().finally(() => {
      loginPromise = null
    })
  }

  return loginPromise
}

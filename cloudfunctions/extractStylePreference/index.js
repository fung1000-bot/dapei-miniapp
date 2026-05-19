const cloud = require('wx-server-sdk')
const http = require('http')
const https = require('https')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

function postJson(url, apiKey, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const client = target.protocol === 'http:' ? http : https
    const payload = JSON.stringify(body)
    const request = client.request({
      method: 'POST',
      hostname: target.hostname,
      port: target.port || (target.protocol === 'http:' ? 80 : 443),
      path: `${target.pathname}${target.search}`,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
      }
    }, response => {
      let data = ''

      response.on('data', chunk => {
        data += chunk
      })
      response.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {}

          if (response.statusCode >= 400) {
            reject(new Error(parsed.message || `API request failed: ${response.statusCode}`))
            return
          }

          resolve(parsed)
        } catch (error) {
          reject(error)
        }
      })
    })

    request.on('error', reject)
    request.write(payload)
    request.end()
  })
}

function pickValue(response, key) {
  return response?.[key] ?? response?.data?.[key] ?? response?.result?.[key]
}

function normalizeStringList(value) {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : []
}

exports.main = async event => {
  const {
    outfitId,
    noteText = '',
    transcriptText = '',
    selectedItems = [],
    existingProfile = null
  } = event
  const apiUrl = process.env.STYLE_PREFERENCE_API_URL
  const apiKey = process.env.STYLE_PREFERENCE_API_KEY
  const model = process.env.STYLE_PREFERENCE_MODEL

  if (!outfitId) {
    return { ok: false, code: 'BAD_REQUEST', message: 'outfitId is required.' }
  }

  if (!apiUrl) {
    return { ok: false, code: 'CONFIG_MISSING', message: 'STYLE_PREFERENCE_API_URL is empty.' }
  }

  try {
    const response = await postJson(apiUrl, apiKey, {
      model,
      outfitId,
      noteText,
      transcriptText,
      selectedItems,
      existingProfile
    })
    const preferences = {
      sceneTags: normalizeStringList(pickValue(response, 'sceneTags')),
      styleTags: normalizeStringList(pickValue(response, 'styleTags')),
      colorTags: normalizeStringList(pickValue(response, 'colorTags')),
      avoidTags: normalizeStringList(pickValue(response, 'avoidTags')),
      freeText: String(pickValue(response, 'freeText') || transcriptText || noteText || '')
    }

    await db.collection('outfitRecords').where({ id: outfitId }).update({
      data: {
        extractedPreferences: preferences,
        'aiStatus.preferenceExtract': 'done'
      }
    })

    return { ok: true, outfitId, extractedPreferences: preferences }
  } catch (error) {
    await db.collection('outfitRecords').where({ id: outfitId }).update({
      data: {
        'aiStatus.preferenceExtract': 'failed'
      }
    }).catch(() => undefined)

    throw error
  }
}

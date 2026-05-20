import { useEffect, useRef, useState } from 'react'
import { Button, Camera, Image, Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

declare const requirePlugin: (pluginId: string) => any

type WechatSIStopResult = {
  tempFilePath: string
  duration: number
  fileSize: number
  result: string
}

type WechatSIManager = {
  start: (opts: { lang: string }) => void
  stop: () => void
  onStart: ((res: any) => void) | null
  onStop: ((res: WechatSIStopResult) => void) | null
  onRecognize: ((res: { result: string }) => void) | null
  onError: ((res: { retcode: number; errMsg: string }) => void) | null
}

type Screen = 'home' | 'camera' | 'captureResult' | 'match' | 'manualPick' | 'confirm'
type ClothingCategory = 'top' | 'bottom' | 'dress' | 'set' | 'unknown'
type CategorySource = 'ai' | 'manual' | 'unknown'
type RecordState = 'idle' | 'recording' | 'done'
type FlashMode = 'auto' | 'on' | 'off'
type TranscriptSource = 'pending' | 'stt' | 'manual' | 'mock'
type AiTaskStatus = 'pending' | 'done' | 'failed' | 'skipped'

type ClothingItem = {
  id: string
  label: string
  tone: string
  category: ClothingCategory
  localPath?: string
  cloudFileId?: string
  categorySource?: CategorySource
}

type WardrobeItem = {
  id: string
  ownerId: string
  shopId: string | null
  schemaVersion: number
  cloudFileId: string
  localPath: string
  albumSaved: boolean
  createdAt: string
  category: ClothingCategory
  categorySource: CategorySource
  name: string
  color: string
  price: null
  tags: string[]
  styleTags: string[]
  matchCount: number
  outfits: string[]
}

type VoiceNote = {
  cloudFileId: string
  localPath: string
  duration: number
  format: 'mp3'
}

type Transcript = {
  text: string
  source: TranscriptSource
  updatedAt: string
}

type ExtractedPreferences = {
  sceneTags: string[]
  styleTags: string[]
  colorTags: string[]
  avoidTags: string[]
  freeText: string
}

type OutfitRecord = {
  id: string
  ownerId: string
  shopId: string | null
  schemaVersion: number
  itemIds: string[]
  createdAt: string
  noteText: string
  voiceNote: VoiceNote | null
  transcript: Transcript
  extractedPreferences: ExtractedPreferences
  aiStatus: {
    stt: AiTaskStatus
    preferenceExtract: AiTaskStatus
  }
}

type TagCounter = {
  tag: string
  count: number
}

type UserStyleProfile = {
  id: string
  ownerId: string
  shopId: string | null
  schemaVersion: number
  updatedAt: string
  sceneTags: TagCounter[]
  styleTags: TagCounter[]
  colorTags: TagCounter[]
  avoidTags: TagCounter[]
  lastOutfitIds: string[]
}

const WARDROBE_COLLECTION = 'wardrobeItems'
const OUTFIT_COLLECTION = 'outfitRecords'
const PROFILE_COLLECTION = 'userStyleProfiles'
const PROFILE_ID = 'default'
const CURRENT_SCHEMA_VERSION = 1

const clothingCategories: { key: ClothingCategory, label: string }[] = [
  { key: 'top', label: '上衣' },
  { key: 'bottom', label: '下衣' },
  { key: 'dress', label: '连衣裙' },
  { key: 'set', label: '套装' },
  { key: 'unknown', label: '未识别' }
]

const clothingItems: ClothingItem[] = [
  { id: 'demo_1', label: '上衣1', tone: 'tone-1', category: 'top' },
  { id: 'demo_2', label: '上衣2', tone: 'tone-2', category: 'top' },
  { id: 'demo_3', label: '上衣3', tone: 'tone-3', category: 'top' },
  { id: 'demo_4', label: '下衣1', tone: 'tone-4', category: 'bottom' },
  { id: 'demo_5', label: '下衣2', tone: 'tone-5', category: 'bottom' },
  { id: 'demo_6', label: '连衣裙1', tone: 'tone-6', category: 'dress' },
  { id: 'demo_7', label: '连衣裙2', tone: 'tone-1', category: 'dress' },
  { id: 'demo_8', label: '套装1', tone: 'tone-2', category: 'set' },
  { id: 'demo_9', label: '套装2', tone: 'tone-3', category: 'set' }
]

const manualCategoryOptions = clothingCategories.filter(category => category.key !== 'unknown')

function getCategoryLabel (category: ClothingCategory) {
  const categoryItem = clothingCategories.find(item => item.key === category)

  return categoryItem?.label ?? '未识别'
}

function getCloudDatabase () {
  if (!wx.cloud) {
    throw new Error('Cloud development is not available.')
  }

  return wx.cloud.database()
}

async function readWardrobeItems () {
  const database = getCloudDatabase()
  const result = await database.collection(WARDROBE_COLLECTION).orderBy('createdAt', 'desc').get()
  const wardrobeItems = Array.isArray(result.data) ? result.data : []

  return wardrobeItems
    .filter(item => Boolean(item.id && item.localPath))
    .map((item): WardrobeItem => ({
      id: String(item.id),
      ownerId: String(item.ownerId || ''),
      shopId: item.shopId ? String(item.shopId) : null,
      schemaVersion: typeof item.schemaVersion === 'number' ? item.schemaVersion : CURRENT_SCHEMA_VERSION,
      cloudFileId: String(item.cloudFileId || ''),
      localPath: String(item.localPath),
      albumSaved: Boolean(item.albumSaved),
      createdAt: item.createdAt || new Date().toISOString(),
      category: item.category || 'unknown',
      categorySource: item.categorySource || 'unknown',
      name: item.name || '',
      color: item.color || '',
      price: null,
      tags: Array.isArray(item.tags) ? item.tags : [],
      styleTags: Array.isArray(item.styleTags) ? item.styleTags : [],
      matchCount: typeof item.matchCount === 'number' ? item.matchCount : 0,
      outfits: Array.isArray(item.outfits) ? item.outfits : []
    }))
}

async function addWardrobeItem (item: WardrobeItem) {
  const database = getCloudDatabase()

  await database.collection(WARDROBE_COLLECTION).add({
    data: item
  })
}

async function updateWardrobeItem (itemId: string, data: Partial<WardrobeItem>) {
  const database = getCloudDatabase()

  await database.collection(WARDROBE_COLLECTION).where({ id: itemId }).update({
    data
  })
}

async function deleteWardrobeItem (itemId: string) {
  const database = getCloudDatabase()

  await database.collection(WARDROBE_COLLECTION).where({ id: itemId }).remove()
}

function mapWardrobeItemToClothingItem (item: WardrobeItem, index: number): ClothingItem {
  return {
    id: item.id,
    label: item.name || `${getCategoryLabel(item.category)}${index + 1}`,
    tone: `tone-${(index % 6) + 1}`,
    category: item.category,
    localPath: item.cloudFileId || item.localPath,
    cloudFileId: item.cloudFileId,
    categorySource: item.categorySource
  }
}

function getRecommendationCategories (category: ClothingCategory) {
  if (category === 'top') return ['bottom', 'set'] as ClothingCategory[]
  if (category === 'bottom') return ['top', 'set'] as ClothingCategory[]
  if (category === 'dress') return ['top', 'set'] as ClothingCategory[]
  if (category === 'set') return ['top', 'bottom'] as ClothingCategory[]

  return []
}

async function readOutfitRecords () {
  const database = getCloudDatabase()
  const result = await database.collection(OUTFIT_COLLECTION).orderBy('createdAt', 'desc').get()
  const outfitRecords = Array.isArray(result.data) ? result.data : []

  return outfitRecords
    .filter(item => Boolean(item.id && Array.isArray(item.itemIds)))
    .map((item): OutfitRecord => ({
      id: String(item.id),
      ownerId: String(item.ownerId || ''),
      shopId: item.shopId ? String(item.shopId) : null,
      schemaVersion: typeof item.schemaVersion === 'number' ? item.schemaVersion : CURRENT_SCHEMA_VERSION,
      itemIds: Array.isArray(item.itemIds) ? item.itemIds.map(String) : [],
      createdAt: item.createdAt || new Date().toISOString(),
      noteText: item.noteText || '',
      voiceNote: item.voiceNote || null,
      transcript: item.transcript || {
        text: '',
        source: 'pending',
        updatedAt: ''
      },
      extractedPreferences: item.extractedPreferences || createEmptyPreferences(),
      aiStatus: item.aiStatus || {
        stt: 'pending',
        preferenceExtract: 'pending'
      }
    }))
}

async function addOutfitRecord (item: OutfitRecord) {
  const database = getCloudDatabase()

  await database.collection(OUTFIT_COLLECTION).add({
    data: item
  })
}

async function readUserStyleProfile () {
  const database = getCloudDatabase()
  const result = await database.collection(PROFILE_COLLECTION).where({ id: PROFILE_ID }).limit(1).get()
  const profile = Array.isArray(result.data) ? result.data[0] : null

  return {
    id: profile?.id || PROFILE_ID,
    ownerId: profile?.ownerId || '',
    shopId: profile?.shopId || null,
    schemaVersion: typeof profile?.schemaVersion === 'number' ? profile.schemaVersion : CURRENT_SCHEMA_VERSION,
    updatedAt: profile?.updatedAt || '',
    sceneTags: Array.isArray(profile?.sceneTags) ? profile.sceneTags : [],
    styleTags: Array.isArray(profile?.styleTags) ? profile.styleTags : [],
    colorTags: Array.isArray(profile?.colorTags) ? profile.colorTags : [],
    avoidTags: Array.isArray(profile?.avoidTags) ? profile.avoidTags : [],
    lastOutfitIds: Array.isArray(profile?.lastOutfitIds) ? profile.lastOutfitIds : []
  }
}

async function writeUserStyleProfile (profile: UserStyleProfile) {
  const database = getCloudDatabase()
  const result = await database.collection(PROFILE_COLLECTION).where({ id: PROFILE_ID }).limit(1).get()

  if (Array.isArray(result.data) && result.data.length > 0) {
    await database.collection(PROFILE_COLLECTION).where({ id: PROFILE_ID }).update({
      data: {
        ...profile,
        schemaVersion: CURRENT_SCHEMA_VERSION
      }
    })
    return
  }

  await database.collection(PROFILE_COLLECTION).add({
    data: {
      id: PROFILE_ID,
      ownerId: '',
      shopId: null,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      ...profile
    }
  })
}

function createEmptyPreferences (): ExtractedPreferences {
  return {
    sceneTags: [],
    styleTags: [],
    colorTags: [],
    avoidTags: [],
    freeText: ''
  }
}

function mergeTagCounters (currentTags: TagCounter[], nextTags: string[]) {
  const tagMap: Record<string, number> = {}

  currentTags.forEach(item => {
    tagMap[item.tag] = item.count
  })

  nextTags.forEach(tag => {
    tagMap[tag] = (tagMap[tag] || 0) + 1
  })

  return Object.keys(tagMap)
    .map(tag => ({ tag, count: tagMap[tag] }))
    .sort((a, b) => b.count - a.count)
}

export default function Index () {
  const [screen, setScreen] = useState<Screen>('home')
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null)
  const [selectedRecommendation, setSelectedRecommendation] = useState<ClothingItem | null>(null)
  const [matchCategory, setMatchCategory] = useState<ClothingCategory>('top')
  const [manualPickCategory, setManualPickCategory] = useState<ClothingCategory>('bottom')
  const [note, setNote] = useState('')
  const [recordState, setRecordState] = useState<RecordState>('idle')
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [showGuideButtons, setShowGuideButtons] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [voiceNote, setVoiceNote] = useState<VoiceNote | null>(null)
  const [finalTranscript, setFinalTranscript] = useState('')
  const [extractedPreferences, setExtractedPreferences] = useState<ExtractedPreferences>(createEmptyPreferences)
  const [flashMode, setFlashMode] = useState<FlashMode>('auto')
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([])
  const [capturedItems, setCapturedItems] = useState<WardrobeItem[]>([])
  const [isCapturePreviewOpen, setIsCapturePreviewOpen] = useState(false)
  const [capturePreviewIndex, setCapturePreviewIndex] = useState(0)
  const [isTakingPhoto, setIsTakingPhoto] = useState(false)
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const guideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const analysisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteRef = useRef('')
  const recorderManagerRef = useRef<WechatSIManager | null>(null)
  const isRecorderActiveRef = useRef(false)
  const shouldDiscardRecorderStopRef = useRef(false)
  const finalTranscriptRef = useRef('')
  const catalogItems = wardrobeItems.length > 0 ? wardrobeItems.map(mapWardrobeItemToClothingItem) : clothingItems
  const matchItems = catalogItems.filter(item => item.category === matchCategory)
  const manualPickItems = catalogItems.filter(item => item.category === manualPickCategory)
  const recommendationItems = selectedItem
    ? catalogItems.filter(item => item.id !== selectedItem.id && getRecommendationCategories(selectedItem.category).includes(item.category))
    : []
  const capturedCount = capturedItems.length
  const previewItem = capturedItems[capturePreviewIndex]

  useEffect(() => {
    refreshWardrobeItems()

    let recorderManager: WechatSIManager | null = null
    let useFallback = false

    try {
      const plugin = requirePlugin('WechatSI')
      recorderManager = plugin.getRecordRecognitionManager()
    } catch (error) {
      console.warn('[WechatSI] plugin unavailable, falling back to native recorder', error)
      useFallback = true
    }

    if (useFallback) {
      const nativeManager = Taro.getRecorderManager()
      recorderManagerRef.current = nativeManager as unknown as WechatSIManager
      nativeManager.onStop(result => {
        handleRecorderStop({ ...result, result: '' })
      })
      nativeManager.onError(() => {
        isRecorderActiveRef.current = false
        clearRecordTimers()
        setRecordState('idle')
        setIsAnalyzing(false)
        showDemoToast('录音失败，请重试')
      })
    } else if (recorderManager) {
      recorderManagerRef.current = recorderManager
      recorderManager.onStop = result => {
        handleRecorderStop(result)
      }
      recorderManager.onError = () => {
        isRecorderActiveRef.current = false
        clearRecordTimers()
        setRecordState('idle')
        setIsAnalyzing(false)
        showDemoToast('录音失败，请重试')
      }
    }

    return () => {
      clearRecordTimers()
      if (isRecorderActiveRef.current) {
        shouldDiscardRecorderStopRef.current = true
        recorderManagerRef.current?.stop()
      }
    }
  }, [])

  async function refreshWardrobeItems () {
    try {
      setWardrobeItems(await readWardrobeItems())
    } catch (error) {
      console.error('[cloud] load wardrobe items failed', error)
      showDemoToast('云端衣橱加载失败')
    }
  }

  function resetToHome () {
    setScreen('home')
    setSelectedItem(null)
    setSelectedRecommendation(null)
    setMatchCategory('top')
    setManualPickCategory('bottom')
    setNote('')
    noteRef.current = ''
    setCapturedItems([])
    setIsCapturePreviewOpen(false)
    setCapturePreviewIndex(0)
    setIsTakingPhoto(false)
    resetVoiceDemo()
  }

  function handlePickItem (item: ClothingItem) {
    setSelectedItem(item)
    setManualPickCategory(getManualPickDefaultCategory(item.category))
  }

  function handlePickRecommendation (item: ClothingItem) {
    setSelectedRecommendation(item)
    resetVoiceDemo()
    setScreen('confirm')
  }

  function handlePickManualItem (item: ClothingItem) {
    if (selectedItem?.id === item.id) return

    setSelectedRecommendation({ ...item, label: item.label || '自选单品' })
    resetVoiceDemo()
    setScreen('confirm')
  }

  function handleChangeMatchCategory (category: ClothingCategory) {
    setMatchCategory(category)
    setSelectedItem(null)
    setSelectedRecommendation(null)
  }

  function getManualPickDefaultCategory (category: ClothingCategory): ClothingCategory {
    if (category === 'top') return 'bottom'
    return 'top'
  }

  function clearRecordTimers () {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current)
      recordTimerRef.current = null
    }

    if (guideTimerRef.current) {
      clearTimeout(guideTimerRef.current)
      guideTimerRef.current = null
    }

    if (analysisTimerRef.current) {
      clearTimeout(analysisTimerRef.current)
      analysisTimerRef.current = null
    }

    if (stopFallbackTimerRef.current) {
      clearTimeout(stopFallbackTimerRef.current)
      stopFallbackTimerRef.current = null
    }
  }

  function resetVoiceDemo () {
    if (isRecorderActiveRef.current) {
      shouldDiscardRecorderStopRef.current = true
      recorderManagerRef.current?.stop()
    }

    clearRecordTimers()
    setRecordState('idle')
    setRecordSeconds(0)
    setShowGuideButtons(false)
    setIsAnalyzing(false)
    setVoiceNote(null)
    setFinalTranscript('')
    finalTranscriptRef.current = ''
    setExtractedPreferences(createEmptyPreferences())
  }

  function formatRecordTime (seconds: number) {
    const minutesText = String(Math.floor(seconds / 60)).padStart(2, '0')
    const secondsText = String(seconds % 60).padStart(2, '0')

    return `${minutesText}:${secondsText}`
  }

  function handleRecordButtonTap () {
    if (recordState === 'recording') {
      finishVoiceDemo()
      return
    }

    startVoiceDemo()
  }

  function startVoiceDemo () {
    const recorderManager = recorderManagerRef.current

    if (!recorderManager) {
      showDemoToast('录音初始化失败')
      return
    }

    clearRecordTimers()
    setRecordState('recording')
    setRecordSeconds(0)
    setShowGuideButtons(false)
    setIsAnalyzing(false)
    setVoiceNote(null)
    setExtractedPreferences(createEmptyPreferences())

    recordTimerRef.current = setInterval(() => {
      setRecordSeconds(seconds => seconds + 1)
    }, 1000)

    guideTimerRef.current = setTimeout(() => {
      setShowGuideButtons(true)
    }, 5000)

    isRecorderActiveRef.current = true

    try {
      recorderManager.start({ lang: 'zh_CN' })
    } catch (error) {
      isRecorderActiveRef.current = false
      clearRecordTimers()
      setRecordState('idle')
      showDemoToast('无法开始录音')
    }
  }

  function finishVoiceDemo () {
    clearRecordTimers()
    setShowGuideButtons(false)
    setIsAnalyzing(true)

    recorderManagerRef.current?.stop()

    // WechatSI 的 onStop 需要等 STT 完成才触发，服务不可用时永远不触发
    // 20 秒后强制复位，避免界面永久卡在"正在保存"
    stopFallbackTimerRef.current = setTimeout(() => {
      if (isRecorderActiveRef.current) {
        isRecorderActiveRef.current = false
        setRecordState('idle')
        setIsAnalyzing(false)
        showDemoToast('语音识别超时，录音未保存，请重试')
      }
    }, 20000)
  }

  async function handleRecorderStop (result: WechatSIStopResult) {
    if (!isRecorderActiveRef.current) return

    isRecorderActiveRef.current = false

    if (stopFallbackTimerRef.current) {
      clearTimeout(stopFallbackTimerRef.current)
      stopFallbackTimerRef.current = null
    }
    if (shouldDiscardRecorderStopRef.current) {
      shouldDiscardRecorderStopRef.current = false
      return
    }

    clearRecordTimers()
    setShowGuideButtons(false)

    const transcriptText = result.result || ''
    finalTranscriptRef.current = transcriptText
    setFinalTranscript(transcriptText)

    try {
      const keywordText = transcriptText || noteRef.current
      console.log('[VOICE] onStop result =', result)
      console.log('[VOICE] transcript text =', transcriptText)
      console.log('[VOICE] calling extractKeywordsDeepSeek')

      const preferencesPromise = extractKeywordsWithDeepSeek(keywordText)
      let savedVoiceNote: VoiceNote | null = null

      try {
        savedVoiceNote = await saveVoiceNoteFile(result.tempFilePath, result.duration)
      } catch (error) {
        console.error('[VOICE] save voice note error =', error)
      }

      const preferences = await preferencesPromise

      setVoiceNote(savedVoiceNote)
      setExtractedPreferences(preferences)
      setRecordState('done')
      setIsAnalyzing(false)
    } catch (error) {
      setRecordState('idle')
      setIsAnalyzing(false)
      showDemoToast('录音保存失败，请重试')
    }
  }

  async function saveVoiceNoteFile (tempFilePath: string, duration: number) {
    const voiceId = `voice_${Date.now()}`
    const cloudFileId = await uploadCloudFile(`outfits/${voiceId}.mp3`, tempFilePath)

    return {
      cloudFileId,
      localPath: tempFilePath,
      duration,
      format: 'mp3' as const
    }
  }

  async function uploadCloudFile (cloudPath: string, filePath: string) {
    if (!wx.cloud) {
      throw new Error('Cloud development is not available.')
    }

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('云端上传超时')), 30000)
    )
    const result = await Promise.race([
      wx.cloud.uploadFile({ cloudPath, filePath }) as Promise<{ fileID: string }>,
      timeoutPromise
    ])

    return result.fileID
  }

  async function extractKeywordsWithDeepSeek (text: string): Promise<ExtractedPreferences> {
    const inputText = text.trim()

    if (!inputText || !wx.cloud?.callFunction) {
      console.log('[DeepSeek] skip cloud function call', {
        hasInputText: !!inputText,
        hasCallFunction: !!wx.cloud?.callFunction
      })
      return mockExtractPreferences(text)
    }

    try {
      console.log('[DeepSeek] extract keywords start', inputText)
      const result = await wx.cloud.callFunction({
        name: 'extractKeywordsDeepSeek',
        data: {
          text: inputText
        }
      })
      const response = result?.result
      console.log('[DeepSeek] extract keywords response', response)

      if (response?.ok && response.extractedPreferences) {
        return response.extractedPreferences
      }

      console.warn('[DeepSeek] keyword extraction failed, fallback to mock', response)
      showDemoToast('关键词提取失败，已使用默认标签')
      return mockExtractPreferences(text)
    } catch (error) {
      console.error('[DeepSeek] keyword extraction error, fallback to mock', error)
      showDemoToast('关键词提取失败，已使用默认标签')
      return mockExtractPreferences(text)
    }
  }

  function mockExtractPreferences (freeText: string): ExtractedPreferences {
    return {
      sceneTags: ['通勤'],
      styleTags: ['清爽', '显瘦'],
      colorTags: ['同色系'],
      avoidTags: [],
      freeText
    }
  }

  function showDemoToast (title: string) {
    Taro.showToast({
      title,
      icon: 'none',
      duration: 1400
    })
  }

  function handleFlashModeTap () {
    const nextFlashMode: Record<FlashMode, FlashMode> = {
      auto: 'on',
      on: 'off',
      off: 'auto'
    }

    setFlashMode(nextFlashMode[flashMode])
  }

  async function handleTakePhoto () {
    if (isTakingPhoto) return

    setIsTakingPhoto(true)

    try {
      let tempImagePath = ''

      try {
        tempImagePath = await takeCameraPhoto()
      } catch (error) {
        console.error('[camera] takePhoto failed', error)
        showDemoToast('相机拍照失败，请检查相机权限')
        return
      }

      const albumSaved = await savePhotoToAlbum(tempImagePath)
      let wardrobeItem: WardrobeItem

      try {
        wardrobeItem = await savePhotoToWardrobe(tempImagePath, albumSaved)
      } catch (error) {
        console.error('[cloud] save wardrobe item failed', error)
        showDemoToast('云端保存失败，请检查集合和权限')
        return
      }

      setCapturedItems(items => [wardrobeItem, ...items])
      setCapturePreviewIndex(0)
      recognizeAndUpdateCategory(wardrobeItem.id, wardrobeItem)
      Taro.vibrateShort({ type: 'light' }).catch(() => undefined)
    } catch (error) {
      console.error('[camera] unexpected capture flow failed', error)
      showDemoToast('拍照流程异常，请重试')
    } finally {
      setIsTakingPhoto(false)
    }
  }

  function takeCameraPhoto () {
    return new Promise<string>((resolve, reject) => {
      const cameraContext = Taro.createCameraContext()

      cameraContext.takePhoto({
        quality: 'high',
        success: result => resolve(result.tempImagePath),
        fail: reject
      })
    })
  }

  async function savePhotoToAlbum (tempImagePath: string) {
    try {
      await Taro.saveImageToPhotosAlbum({ filePath: tempImagePath })
      return true
    } catch (error) {
      return false
    }
  }

  async function savePhotoToWardrobe (tempImagePath: string, albumSaved: boolean) {
    const itemId = `item_${Date.now()}`
    const cloudFileId = await uploadCloudFile(`wardrobe/${itemId}.jpg`, tempImagePath)
    const wardrobeItem: WardrobeItem = {
      id: itemId,
      ownerId: '',
      shopId: null,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      cloudFileId,
      localPath: tempImagePath,
      albumSaved,
      createdAt: new Date().toISOString(),
      category: 'unknown',
      categorySource: 'unknown',
      name: '',
      color: '',
      price: null,
      tags: [],
      styleTags: [],
      matchCount: 0,
      outfits: []
    }

    try {
      await addWardrobeItem(wardrobeItem)
    } catch (error) {
      await wx.cloud?.deleteFile({ fileList: [cloudFileId] }).catch(() => undefined)
      throw error
    }

    setWardrobeItems(items => [wardrobeItem, ...items])

    return wardrobeItem
  }

  async function recognizeAndUpdateCategory (itemId: string, currentItem?: WardrobeItem) {
    const targetItem = currentItem || [...capturedItems, ...wardrobeItems].find(item => item.id === itemId)

    if (targetItem?.cloudFileId) {
      try {
        const result = await wx.cloud?.callFunction({
          name: 'recognizeClothing',
          data: {
            itemId,
            cloudFileId: targetItem.cloudFileId
          }
        })
        const recognition = result?.result

        if (recognition?.ok) {
          const category = normalizeClothingCategory(recognition.category)
          const categorySource: CategorySource = category === 'unknown' ? 'unknown' : 'ai'

          applyWardrobeItemPatchLocally(itemId, {
            category,
            categorySource,
            tags: Array.isArray(recognition.tags) ? recognition.tags : targetItem.tags,
            color: typeof recognition.color === 'string' ? recognition.color : targetItem.color,
            name: typeof recognition.name === 'string' ? recognition.name : targetItem.name
          })
          return
        }
        console.warn('[cloud] recognize clothing returned non-ok, keep unknown', recognition)
        return
      } catch (error) {
        console.error('[cloud] recognize clothing failed, keep unknown', error)
        return
      }
    }

    const category = await mockRecognizeCategory(itemId)
    const categorySource: CategorySource = category === 'unknown' ? 'unknown' : 'ai'
    await updateWardrobeItemCategory(itemId, category, categorySource)
  }

  function normalizeClothingCategory (category: unknown): ClothingCategory {
    if (category === 'top' || category === 'bottom' || category === 'dress' || category === 'set') {
      return category
    }

    return 'unknown'
  }

  function applyWardrobeItemPatchLocally (itemId: string, patch: Partial<WardrobeItem>) {
    setWardrobeItems(items => items.map(item => item.id === itemId ? { ...item, ...patch } : item))
    setSelectedItem(item => item?.id === itemId ? { ...item, ...patch } : item)
    setSelectedRecommendation(item => item?.id === itemId ? { ...item, ...patch } : item)
    setCapturedItems(items => items.map(item => item.id === itemId ? { ...item, ...patch } : item))
  }

  function mockRecognizeCategory (itemId: string) {
    const categories: ClothingCategory[] = ['top', 'bottom', 'dress', 'set', 'unknown']
    const lastNumber = Number(itemId.replace(/\D/g, '').slice(-1))
    const category = categories[Number.isNaN(lastNumber) ? 4 : lastNumber % categories.length]

    return new Promise<ClothingCategory>(resolve => {
      setTimeout(() => resolve(category), 650)
    })
  }

  async function updateWardrobeItemCategory (
    itemId: string,
    category: ClothingCategory,
    categorySource: CategorySource
  ) {
    const currentItems = await readWardrobeItems()
    const nextItems = currentItems.map(item => {
      if (item.id !== itemId) return item

      return {
        ...item,
        category,
        categorySource,
        tags: category === 'unknown' || item.tags.includes(getCategoryLabel(category))
          ? item.tags
          : [...item.tags, getCategoryLabel(category)]
      }
    })

    const changedItem = nextItems.find(item => item.id === itemId)

    if (changedItem) {
      await updateWardrobeItem(itemId, {
        category: changedItem.category,
        categorySource: changedItem.categorySource,
        tags: changedItem.tags
      })
    }

    setWardrobeItems(nextItems)
    setSelectedItem(item => item?.id === itemId ? { ...item, category, categorySource } : item)
    setSelectedRecommendation(item => item?.id === itemId ? { ...item, category, categorySource } : item)
    setCapturedItems(items => items.map(item => {
      if (item.id !== itemId) return item

      return {
        ...item,
        category,
        categorySource
      }
    }))
  }

  function handleOpenCapturePreview () {
    if (capturedItems.length === 0) {
      showDemoToast('还没有拍摄照片')
      return
    }

    setCapturePreviewIndex(0)
    setIsCapturePreviewOpen(true)
  }

  async function handleDeletePreviewItem () {
    if (!previewItem) return

    const nextItems = capturedItems.filter(item => item.id !== previewItem.id)
    const nextWardrobeItems = wardrobeItems.filter(item => item.id !== previewItem.id)

    await deleteWardrobeItem(previewItem.id).catch(() => undefined)
    if (previewItem.cloudFileId) {
      await wx.cloud?.deleteFile({ fileList: [previewItem.cloudFileId] }).catch(() => undefined)
    }

    setWardrobeItems(nextWardrobeItems)

    setCapturedItems(nextItems)

    if (nextItems.length === 0) {
      setCapturePreviewIndex(0)
      setIsCapturePreviewOpen(false)
      return
    }

    setCapturePreviewIndex(index => Math.min(index, nextItems.length - 1))
  }

  async function handleSetManualCategory (category: ClothingCategory) {
    if (!selectedItem || selectedItem.id.startsWith('demo_')) return

    await updateWardrobeItemCategory(selectedItem.id, category, 'manual')
    setSelectedItem({
      ...selectedItem,
      category,
      categorySource: 'manual'
    })
    setMatchCategory(category)
    showDemoToast(`已归类为${getCategoryLabel(category)}`)
  }

  async function handleSaveOutfit () {
    if (!selectedItem || !selectedRecommendation) return

    const now = new Date().toISOString()
    const outfitRecord: OutfitRecord = {
      id: `outfit_${Date.now()}`,
      ownerId: '',
      shopId: null,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      itemIds: [selectedItem.id, selectedRecommendation.id],
      createdAt: now,
      noteText: note,
      voiceNote,
      transcript: {
        text: finalTranscriptRef.current,
        source: finalTranscriptRef.current ? 'stt' : (voiceNote ? 'pending' : 'mock'),
        updatedAt: finalTranscriptRef.current ? new Date().toISOString() : ''
      },
      extractedPreferences,
      aiStatus: {
        stt: finalTranscriptRef.current ? 'done' : (voiceNote ? 'pending' : 'skipped'),
        preferenceExtract: 'done'
      }
    }

    try {
      await addOutfitRecord(outfitRecord)
      const enrichedOutfitRecord = enrichOutfitRecordWithAi(outfitRecord)

      await updateWardrobeItemsForOutfit(enrichedOutfitRecord)
      await updateUserStyleProfile(enrichedOutfitRecord)
      showDemoToast('搭配已保存')
      resetToHome()
    } catch (error) {
      showDemoToast('搭配保存失败，请重试')
    }
  }

  function enrichOutfitRecordWithAi (outfitRecord: OutfitRecord): OutfitRecord {
    return {
      ...outfitRecord,
      aiStatus: {
        ...outfitRecord.aiStatus,
        stt: outfitRecord.transcript.text ? 'done' : outfitRecord.aiStatus.stt,
        preferenceExtract: 'done'
      }
    }
  }

  async function updateWardrobeItemsForOutfit (outfitRecord: OutfitRecord) {
    const nextItems = (await readWardrobeItems()).map(item => {
      if (!outfitRecord.itemIds.includes(item.id)) return item

      return {
        ...item,
        matchCount: item.matchCount + 1,
        outfits: item.outfits.includes(outfitRecord.id) ? item.outfits : [outfitRecord.id, ...item.outfits],
        styleTags: mergeStyleTags(item.styleTags, outfitRecord.extractedPreferences.styleTags)
      }
    })
    const changedItems = nextItems.filter(item => outfitRecord.itemIds.includes(item.id))

    await Promise.all(changedItems.map(item => updateWardrobeItem(item.id, {
      matchCount: item.matchCount,
      outfits: item.outfits,
      styleTags: item.styleTags
    })))
    setWardrobeItems(nextItems)
  }

  function mergeStyleTags (currentTags: string[], nextTags: string[]) {
    const tags = [...currentTags]

    nextTags.forEach(tag => {
      if (!tags.includes(tag)) tags.push(tag)
    })

    return tags
  }

  async function updateUserStyleProfile (outfitRecord: OutfitRecord) {
    const profile = await readUserStyleProfile()
    const preferences = outfitRecord.extractedPreferences
    const nextProfile: UserStyleProfile = {
      id: PROFILE_ID,
      ownerId: profile.ownerId,
      shopId: profile.shopId,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      sceneTags: mergeTagCounters(profile.sceneTags, preferences.sceneTags),
      styleTags: mergeTagCounters(profile.styleTags, preferences.styleTags),
      colorTags: mergeTagCounters(profile.colorTags, preferences.colorTags),
      avoidTags: mergeTagCounters(profile.avoidTags, preferences.avoidTags),
      lastOutfitIds: [outfitRecord.id, ...profile.lastOutfitIds.filter(id => id !== outfitRecord.id)].slice(0, 20)
    }

    await writeUserStyleProfile(nextProfile)
  }

  function handleBackToMatch () {
    resetVoiceDemo()
    setScreen('match')
  }

  function renderCategoryTabs (
    activeCategory: ClothingCategory,
    onChange: (category: ClothingCategory) => void
  ) {
    return (
      <View className='category-tabs'>
        {clothingCategories.map(category => (
          <View
            key={category.key}
            className={`category-tab ${activeCategory === category.key ? 'is-active' : ''}`}
            onTap={() => onChange(category.key)}
          >
            <Text>{category.label}</Text>
          </View>
        ))}
      </View>
    )
  }

  function renderClothingCard (item: ClothingItem, size: 'grid' | 'result' | 'recommend' | 'pair' = 'grid') {
    const isSelected = selectedItem?.id === item.id

    return (
      <View className={`clothing-card clothing-card--${size} ${item.tone} ${isSelected ? 'is-selected' : ''}`}>
        {item.localPath ? (
          <Image className='clothing-card__image' src={item.localPath} mode='aspectFill' />
        ) : (
          <>
            <View className='clothing-card__hanger' />
            <View className='clothing-card__body'>
              <View className='clothing-card__neck' />
            </View>
          </>
        )}
        {item.categorySource && (
          <Text className={`clothing-card__source clothing-card__source--${item.categorySource}`}>
            {item.categorySource === 'ai' ? 'AI' : item.categorySource === 'manual' ? '手动' : '未识别'}
          </Text>
        )}
        <Text className='clothing-card__label'>{item.label}</Text>
      </View>
    )
  }

  return (
    <View className='prototype'>
      {screen === 'home' && (
        <View className='home screen'>
          <View className='home__header'>
            <Text className='eyebrow'>v0.1 · DEMO</Text>
            <Text className='title'>今天{'\n'}搭什么？</Text>
            <Text className='subtext'>衣橱 {catalogItems.length} 件</Text>
          </View>

          <View className='home__actions'>
            <Button className='action-card action-card--camera' onTap={() => setScreen('camera')}>
              <View className='icon-cam'>
                <View className='icon-cam__bump' />
                <View className='icon-cam__body'>
                  <View className='icon-cam__lens' />
                </View>
              </View>
              <Text className='action-card__title'>拍新衣服</Text>
              <Text className='action-card__hint'>拍照后 AI 自动识别归类</Text>
            </Button>

            <Button className='action-card action-card--match' onTap={() => setScreen('match')}>
              <View className='action-card__content'>
                <Text className='action-card__title'>搭衣服</Text>
                <Text className='action-card__hint'>选单品查看推荐搭配</Text>
              </View>
              <Text className='action-card__arrow'>›</Text>
            </Button>
          </View>
        </View>
      )}

      {screen === 'camera' && (
        <View className='camera'>
          <Camera
            className='camera-view'
            devicePosition='back'
            flash={flashMode}
          />
          <View className='camera-overlay camera-overlay--top'>
            <Button className='camera-control camera-control--back' onTap={resetToHome}>返回</Button>
            <Text className='camera-count'>已拍 {capturedCount}</Text>
          </View>
          <View className='camera-overlay camera-overlay--bottom'>
            <Button className='flash-button' onTap={handleFlashModeTap}>
              {flashMode === 'auto' ? '闪光 自动' : flashMode === 'on' ? '闪光 开' : '闪光 关'}
            </Button>
            <Button
              className={`shutter-button ${isTakingPhoto ? 'is-taking' : ''}`}
              disabled={isTakingPhoto}
              onTap={handleTakePhoto}
            />
            <View className={`capture-album ${capturedCount > 0 ? 'has-photo' : ''}`} onTap={handleOpenCapturePreview}>
              {capturedItems[0] ? (
                <Image className='capture-album__image' src={capturedItems[0].localPath} mode='aspectFill' />
              ) : (
                <Text className='capture-album__empty'>相册</Text>
              )}
              {capturedCount > 0 && (
                <Text className='capture-album__count'>{capturedCount}</Text>
              )}
            </View>
          </View>

          {isCapturePreviewOpen && previewItem && (
            <View className='capture-preview'>
              <View className='capture-preview__panel'>
                <View className='capture-preview__header'>
                  <Text className='capture-preview__title'>本次拍摄 {capturedCount} 张</Text>
                  <Button className='capture-preview__close' onTap={() => setIsCapturePreviewOpen(false)}>返回拍照</Button>
                </View>

                <View className='capture-preview__main'>
                  <Image className='capture-preview__image' src={previewItem.localPath} mode='aspectFit' />
                </View>

                <View className='capture-preview__thumbs'>
                  {capturedItems.map((item, index) => (
                    <View
                      key={item.id}
                      className={`capture-preview__thumb ${index === capturePreviewIndex ? 'is-active' : ''}`}
                      onTap={() => setCapturePreviewIndex(index)}
                    >
                      <Image className='capture-preview__thumb-image' src={item.localPath} mode='aspectFill' />
                    </View>
                  ))}
                </View>

                <View className='capture-preview__actions'>
                  <Button className='capture-preview__delete' onTap={handleDeletePreviewItem}>删除这张</Button>
                  <Button className='capture-preview__keep' onTap={() => setIsCapturePreviewOpen(false)}>继续拍</Button>
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {screen === 'captureResult' && (
        <View className='capture screen'>
          <View className='topbar'>
            <Button className='plain-button' onTap={resetToHome}>返回</Button>
          </View>
          <View className='capture__content'>
            {renderClothingCard({ id: 'capture_result', label: '拍照结果', tone: 'tone-2', category: 'top' }, 'result')}
          </View>
          <Button className='primary-button' onTap={resetToHome}>完成</Button>
        </View>
      )}

      {screen === 'match' && (
        <View className='match screen'>
          <View className='match__header'>
            <Button className='plain-button' onTap={resetToHome}>返回</Button>
            <Text className='screen-title'>选择要搭配的单品</Text>
          </View>
          {renderCategoryTabs(matchCategory, handleChangeMatchCategory)}

          <View className='match__workspace'>
            <View className='grid'>
              {matchItems.length > 0 ? (
                matchItems.map(item => (
                  <View key={item.id} className='grid__cell' onTap={() => handlePickItem(item)}>
                    {renderClothingCard(item)}
                  </View>
                ))
              ) : (
                <View className='empty-state'>
                  <Text className='empty-state__title'>暂无{getCategoryLabel(matchCategory)}单品</Text>
                  <Text className='empty-state__hint'>先去拍新衣服，系统会自动归类到这里。</Text>
                </View>
              )}
            </View>
          </View>

          {selectedItem && (
            <View
              className='match__overlay'
              onTap={() => { setSelectedItem(null); setSelectedRecommendation(null) }}
            />
          )}

          <View className={`recommend-drawer ${selectedItem ? 'is-open' : ''}`}>
            <View className='recommend-drawer__handle' />
            {selectedItem?.category === 'unknown' ? (
              <>
                <View className='recommend-drawer__header'>
                  <Text className='recommend-drawer__title'>补充分类</Text>
                </View>
                <Text className='recommend-drawer__hint'>未识别单品需要先手动归类。</Text>
                <View className='manual-category-list'>
                  {manualCategoryOptions.map(category => (
                    <Button
                      key={category.key}
                      className='manual-category-button'
                      onTap={() => handleSetManualCategory(category.key)}
                    >
                      {category.label}
                    </Button>
                  ))}
                </View>
              </>
            ) : (
              <>
                <View className='recommend-drawer__header'>
                  <Text className='recommend-drawer__title'>推荐搭配</Text>
                  {selectedItem && (
                    <Text className='recommend-drawer__selected-name'>{selectedItem.label}</Text>
                  )}
                </View>
                <Text className='recommend-drawer__hint'>点击推荐单品继续</Text>
                {recommendationItems.length > 0 ? (
                  <View className='recommend-drawer__scroll'>
                    {recommendationItems.map(item => (
                      <View key={item.id} onTap={() => handlePickRecommendation(item)}>
                        {renderClothingCard(item, 'recommend')}
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className='recommend-drawer__empty'>当前分类还没有可推荐单品</Text>
                )}
                <Button
                  className='manual-pick-button'
                  disabled={!selectedItem}
                  onTap={() => setScreen('manualPick')}
                >
                  自己选一件
                </Button>
              </>
            )}
          </View>
        </View>
      )}

      {screen === 'manualPick' && selectedItem && (
        <View className='manual-pick screen'>
          <View className='match__header'>
            <Button className='plain-button' onTap={() => setScreen('match')}>返回</Button>
            <Text className='screen-title'>选择另一件搭配单品</Text>
          </View>
          {renderCategoryTabs(manualPickCategory, setManualPickCategory)}

          <View className='manual-pick__selected'>
            {selectedItem.localPath ? (
              <Image className='manual-pick__thumb' src={selectedItem.localPath} mode='aspectFill' />
            ) : (
              <View className='manual-pick__thumb-placeholder' />
            )}
            <View className='manual-pick__info'>
              <Text className='manual-pick__label'>当前已选</Text>
              <Text className='manual-pick__name'>{selectedItem.label}</Text>
            </View>
          </View>

          <View className='grid manual-pick__grid'>
            {manualPickItems.map(item => {
              const isCurrentItem = selectedItem.id === item.id

              return (
                <View
                  key={item.id}
                  className={`grid__cell ${isCurrentItem ? 'is-disabled' : ''}`}
                  onTap={() => handlePickManualItem(item)}
                >
                  {renderClothingCard(item)}
                </View>
              )
            })}
          </View>
        </View>
      )}

      {screen === 'confirm' && selectedItem && selectedRecommendation && (
        <View className='confirm screen'>
          <View className='topbar'>
            <Button className='plain-button' onTap={handleBackToMatch}>返回</Button>
          </View>
          <View className='confirm__header'>
            <Text className='title'>确认这组搭配</Text>
            <Text className='subtext'>用于用户测试的模拟保存流程</Text>
          </View>

          <View className='pair-row'>
            {renderClothingCard(selectedItem, 'pair')}
            <View className='pair-row__divider' />
            {renderClothingCard(selectedRecommendation, 'pair')}
          </View>

          <View className='confirm__form'>
            <Input
              className='note-input'
              value={note}
              placeholder='补充说明（可选）'
              onInput={event => {
                noteRef.current = event.detail.value
                setNote(event.detail.value)
              }}
            />
            <View className={`voice-demo-card voice-demo-card--${recordState}`}>
              <Text className='voice-demo-badge'>真实录音</Text>
              <Text className='voice-demo-title'>
                {recordState === 'recording' ? '正在录音...' : isAnalyzing ? '正在保存录音...' : recordState === 'done' ? (finalTranscript ? '录音完成，语音已识别' : '录音已保存') : '点击录音，说说为什么这样搭'}
              </Text>
              {recordState === 'recording' && (
                <>
                  <View className='voice-waveform'>
                    <View className='voice-waveform__bar' />
                    <View className='voice-waveform__bar' />
                    <View className='voice-waveform__bar' />
                    <View className='voice-waveform__bar' />
                    <View className='voice-waveform__bar' />
                    <View className='voice-waveform__bar' />
                    <View className='voice-waveform__bar' />
                  </View>
                  <Text className='voice-demo-timer'>{formatRecordTime(recordSeconds)}</Text>
                </>
              )}
              <Button
                className={`voice-demo-record-button ${recordState === 'recording' ? 'is-recording' : ''}`}
                onTap={handleRecordButtonTap}
              >
                {recordState === 'recording' ? (
                  <View className='stop-icon' />
                ) : (
                  <View className='mic-icon'>
                    <View className='mic-icon__body' />
                    <View className='mic-icon__stand'>
                      <View className='mic-icon__arc' />
                      <View className='mic-icon__stem' />
                      <View className='mic-icon__base' />
                    </View>
                  </View>
                )}
              </Button>
              {recordState === 'idle' && (
                <Text className='voice-demo-hint'>建议说场景、风格、颜色、避雷点，后续会用于个性化推荐。</Text>
              )}
              {recordState === 'recording' && showGuideButtons && (
                <View className='voice-guide-row'>
                  <Button className='voice-guide-button' onTap={() => showDemoToast('可以说：通勤、直播、约会')}>适合什么场合？</Button>
                  <Button className='voice-guide-button' onTap={() => showDemoToast('可以说：显瘦、清爽、高级感')}>搭配亮点？</Button>
                  <Button className='voice-guide-button' onTap={() => showDemoToast('可以说：太花、显胖、压身高')}>不喜欢什么？</Button>
                </View>
              )}
              {isAnalyzing && (
                <View className='voice-analysis'>
                  <View className='voice-analysis-spinner' />
                  <Text className='voice-analysis-text'>正在处理录音...</Text>
                </View>
              )}
              {recordState === 'done' && !isAnalyzing && (
                <View className='voice-result-card'>
                  <Text className='voice-result-title'>本次搭配偏好</Text>
                  {finalTranscript !== '' && (
                    <Text className='voice-final-transcript'>{finalTranscript}</Text>
                  )}
                  <View className='voice-result-list'>
                    <Text className='voice-result-item'>场合：{extractedPreferences.sceneTags[0] || '待提取'}</Text>
                    <Text className='voice-result-item'>风格：{extractedPreferences.styleTags[0] || '待提取'}</Text>
                    <Text className='voice-result-item'>颜色：{extractedPreferences.colorTags[0] || '待提取'}</Text>
                  </View>
                  <Text className='voice-result-summary'>
                    {voiceNote
                      ? `录音 ${Math.max(1, Math.round(voiceNote.duration / 1000))} 秒已保存${finalTranscript ? '，语音已识别' : ''}。`
                      : '录音已保存。'}
                  </Text>
                  <View className='voice-result-actions'>
                    <Button className='voice-result-button' onTap={resetVoiceDemo}>重新录音</Button>
                    <Button className='voice-result-button is-primary' onTap={() => showDemoToast('保存搭配时会写入审美画像')}>已关联</Button>
                  </View>
                </View>
              )}
            </View>
            <View className='confirm-action-bar'>
              <Button className='confirm-action-button' onTap={handleBackToMatch}>取消</Button>
              <Button
                className={`confirm-action-button is-next ${recordState === 'done' && !isAnalyzing ? 'is-active' : ''}`}
                disabled={recordState !== 'done' || isAnalyzing}
                onTap={handleSaveOutfit}
              >
                保存搭配
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

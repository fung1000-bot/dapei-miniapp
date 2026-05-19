import { useEffect, useRef, useState } from 'react'
import { Button, Camera, Image, Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

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
  categorySource?: CategorySource
}

type WardrobeItem = {
  id: string
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
  updatedAt: string
  sceneTags: TagCounter[]
  styleTags: TagCounter[]
  colorTags: TagCounter[]
  avoidTags: TagCounter[]
  lastOutfitIds: string[]
}

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

function readWardrobeItems () {
  const storageItems = Taro.getStorageSync<Partial<WardrobeItem>[]>('wardrobeItems')
  const wardrobeItems = Array.isArray(storageItems) ? storageItems : []

  return wardrobeItems
    .filter(item => Boolean(item.id && item.localPath))
    .map((item): WardrobeItem => ({
      id: String(item.id),
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

function writeWardrobeItems (items: WardrobeItem[]) {
  Taro.setStorageSync('wardrobeItems', items)
}

function mapWardrobeItemToClothingItem (item: WardrobeItem, index: number): ClothingItem {
  return {
    id: item.id,
    label: item.name || `${getCategoryLabel(item.category)}${index + 1}`,
    tone: `tone-${(index % 6) + 1}`,
    category: item.category,
    localPath: item.localPath,
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

function readOutfitRecords () {
  const storageItems = Taro.getStorageSync<Partial<OutfitRecord>[]>('outfitRecords')
  const outfitRecords = Array.isArray(storageItems) ? storageItems : []

  return outfitRecords
    .filter(item => Boolean(item.id && Array.isArray(item.itemIds)))
    .map((item): OutfitRecord => ({
      id: String(item.id),
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

function writeOutfitRecords (items: OutfitRecord[]) {
  Taro.setStorageSync('outfitRecords', items)
}

function readUserStyleProfile () {
  const profile = Taro.getStorageSync<Partial<UserStyleProfile>>('userStyleProfile')

  return {
    updatedAt: profile?.updatedAt || '',
    sceneTags: Array.isArray(profile?.sceneTags) ? profile.sceneTags : [],
    styleTags: Array.isArray(profile?.styleTags) ? profile.styleTags : [],
    colorTags: Array.isArray(profile?.colorTags) ? profile.colorTags : [],
    avoidTags: Array.isArray(profile?.avoidTags) ? profile.avoidTags : [],
    lastOutfitIds: Array.isArray(profile?.lastOutfitIds) ? profile.lastOutfitIds : []
  }
}

function writeUserStyleProfile (profile: UserStyleProfile) {
  Taro.setStorageSync('userStyleProfile', profile)
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
  const recorderManagerRef = useRef<ReturnType<typeof Taro.getRecorderManager> | null>(null)
  const catalogItems = wardrobeItems.length > 0 ? wardrobeItems.map(mapWardrobeItemToClothingItem) : clothingItems
  const matchItems = catalogItems.filter(item => item.category === matchCategory)
  const manualPickItems = catalogItems.filter(item => item.category === manualPickCategory)
  const recommendationItems = selectedItem
    ? catalogItems.filter(item => item.id !== selectedItem.id && getRecommendationCategories(selectedItem.category).includes(item.category))
    : []
  const capturedCount = capturedItems.length
  const previewItem = capturedItems[capturePreviewIndex]

  useEffect(() => {
    setWardrobeItems(readWardrobeItems())
    const recorderManager = Taro.getRecorderManager()

    recorderManagerRef.current = recorderManager
    recorderManager.onStop(result => {
      handleRecorderStop(result)
    })
    recorderManager.onError(() => {
      clearRecordTimers()
      setRecordState('idle')
      setIsAnalyzing(false)
      showDemoToast('录音失败，请重试')
    })

    return () => {
      clearRecordTimers()
      recorderManager.stop()
    }
  }, [])

  function resetToHome () {
    setScreen('home')
    setSelectedItem(null)
    setSelectedRecommendation(null)
    setMatchCategory('top')
    setManualPickCategory('bottom')
    setNote('')
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
  }

  function resetVoiceDemo () {
    clearRecordTimers()
    setRecordState('idle')
    setRecordSeconds(0)
    setShowGuideButtons(false)
    setIsAnalyzing(false)
    setVoiceNote(null)
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

    recorderManager.start({
      duration: 120000,
      format: 'mp3',
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000
    })
  }

  function finishVoiceDemo () {
    clearRecordTimers()
    setShowGuideButtons(false)
    setIsAnalyzing(true)

    recorderManagerRef.current?.stop()
  }

  async function handleRecorderStop (result: Taro.RecorderManager.OnStopCallbackResult) {
    clearRecordTimers()
    setShowGuideButtons(false)

    try {
      const savedVoiceNote = await saveVoiceNoteFile(result.tempFilePath, result.duration)
      const preferences = mockExtractPreferences(note)

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
    const savedFile = await new Promise<Taro.saveFile.SuccessCallbackResult>((resolve, reject) => {
      Taro.saveFile({
        tempFilePath,
        success: resolve,
        fail: reject
      })
    })

    return {
      localPath: savedFile.savedFilePath,
      duration,
      format: 'mp3' as const
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
      const tempImagePath = await takeCameraPhoto()
      const albumSaved = await savePhotoToAlbum(tempImagePath)
      const wardrobeItem = await savePhotoToWardrobe(tempImagePath, albumSaved)

      setCapturedItems(items => [wardrobeItem, ...items])
      setCapturePreviewIndex(0)
      recognizeAndUpdateCategory(wardrobeItem.id)
      Taro.vibrateShort({ type: 'light' }).catch(() => undefined)
    } catch (error) {
      Taro.showToast({
        title: '拍照失败，请重试',
        icon: 'none',
        duration: 1400
      })
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
    const savedFile = await new Promise<Taro.saveFile.SuccessCallbackResult>((resolve, reject) => {
      Taro.saveFile({
        tempFilePath: tempImagePath,
        success: resolve,
        fail: reject
      })
    })
    const storageItems = Taro.getStorageSync<WardrobeItem[]>('wardrobeItems')
    const wardrobeItems = Array.isArray(storageItems) ? storageItems : []
    const wardrobeItem: WardrobeItem = {
      id: `item_${Date.now()}`,
      localPath: savedFile.savedFilePath,
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

    const nextItems = [wardrobeItem, ...wardrobeItems]

    writeWardrobeItems(nextItems)
    setWardrobeItems(nextItems)

    return wardrobeItem
  }

  async function recognizeAndUpdateCategory (itemId: string) {
    const category = await mockRecognizeCategory(itemId)
    const categorySource: CategorySource = category === 'unknown' ? 'unknown' : 'ai'

    updateWardrobeItemCategory(itemId, category, categorySource)
  }

  function mockRecognizeCategory (itemId: string) {
    const categories: ClothingCategory[] = ['top', 'bottom', 'dress', 'set', 'unknown']
    const lastNumber = Number(itemId.replace(/\D/g, '').slice(-1))
    const category = categories[Number.isNaN(lastNumber) ? 4 : lastNumber % categories.length]

    return new Promise<ClothingCategory>(resolve => {
      setTimeout(() => resolve(category), 650)
    })
  }

  function updateWardrobeItemCategory (
    itemId: string,
    category: ClothingCategory,
    categorySource: CategorySource
  ) {
    const nextItems = readWardrobeItems().map(item => {
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

    writeWardrobeItems(nextItems)
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
    const storageItems = Taro.getStorageSync<WardrobeItem[]>('wardrobeItems')
    const wardrobeItems = Array.isArray(storageItems) ? storageItems : []

    const nextWardrobeItems = wardrobeItems.filter(item => item.id !== previewItem.id)

    writeWardrobeItems(nextWardrobeItems)
    setWardrobeItems(nextWardrobeItems)

    await Taro.removeSavedFile({ filePath: previewItem.localPath }).catch(() => undefined)

    setCapturedItems(nextItems)

    if (nextItems.length === 0) {
      setCapturePreviewIndex(0)
      setIsCapturePreviewOpen(false)
      return
    }

    setCapturePreviewIndex(index => Math.min(index, nextItems.length - 1))
  }

  function handleSetManualCategory (category: ClothingCategory) {
    if (!selectedItem || selectedItem.id.startsWith('demo_')) return

    updateWardrobeItemCategory(selectedItem.id, category, 'manual')
    setSelectedItem({
      ...selectedItem,
      category,
      categorySource: 'manual'
    })
    setMatchCategory(category)
    showDemoToast(`已归类为${getCategoryLabel(category)}`)
  }

  function handleSaveOutfit () {
    if (!selectedItem || !selectedRecommendation) return

    const now = new Date().toISOString()
    const outfitRecord: OutfitRecord = {
      id: `outfit_${Date.now()}`,
      itemIds: [selectedItem.id, selectedRecommendation.id],
      createdAt: now,
      noteText: note,
      voiceNote,
      transcript: {
        text: '',
        source: voiceNote ? 'pending' : 'mock',
        updatedAt: ''
      },
      extractedPreferences,
      aiStatus: {
        stt: voiceNote ? 'pending' : 'skipped',
        preferenceExtract: 'done'
      }
    }

    const nextOutfits = [outfitRecord, ...readOutfitRecords()]

    writeOutfitRecords(nextOutfits)
    updateWardrobeItemsForOutfit(outfitRecord)
    updateUserStyleProfile(outfitRecord)
    showDemoToast('搭配已保存')
    resetToHome()
  }

  function updateWardrobeItemsForOutfit (outfitRecord: OutfitRecord) {
    const nextItems = readWardrobeItems().map(item => {
      if (!outfitRecord.itemIds.includes(item.id)) return item

      return {
        ...item,
        matchCount: item.matchCount + 1,
        outfits: item.outfits.includes(outfitRecord.id) ? item.outfits : [outfitRecord.id, ...item.outfits],
        styleTags: mergeStyleTags(item.styleTags, outfitRecord.extractedPreferences.styleTags)
      }
    })

    writeWardrobeItems(nextItems)
    setWardrobeItems(nextItems)
  }

  function mergeStyleTags (currentTags: string[], nextTags: string[]) {
    const tags = [...currentTags]

    nextTags.forEach(tag => {
      if (!tags.includes(tag)) tags.push(tag)
    })

    return tags
  }

  function updateUserStyleProfile (outfitRecord: OutfitRecord) {
    const profile = readUserStyleProfile()
    const preferences = outfitRecord.extractedPreferences
    const nextProfile: UserStyleProfile = {
      updatedAt: new Date().toISOString(),
      sceneTags: mergeTagCounters(profile.sceneTags, preferences.sceneTags),
      styleTags: mergeTagCounters(profile.styleTags, preferences.styleTags),
      colorTags: mergeTagCounters(profile.colorTags, preferences.colorTags),
      avoidTags: mergeTagCounters(profile.avoidTags, preferences.avoidTags),
      lastOutfitIds: [outfitRecord.id, ...profile.lastOutfitIds.filter(id => id !== outfitRecord.id)].slice(0, 20)
    }

    writeUserStyleProfile(nextProfile)
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
            <Text className='eyebrow'>进货搭配测试原型</Text>
            <Text className='title'>今天要做什么？</Text>
          </View>

          <View className='home__actions'>
            <Button className='action-card action-card--camera' onTap={() => setScreen('camera')}>
              <Text className='action-card__icon'>CAM</Text>
              <Text className='action-card__title'>拍新衣服</Text>
              <Text className='action-card__hint'>模拟拍照并记录新货</Text>
            </Button>

            <Button className='action-card action-card--match' onTap={() => setScreen('match')}>
              <Text className='action-card__icon'>SET</Text>
              <Text className='action-card__title'>搭衣服</Text>
              <Text className='action-card__hint'>选择单品查看推荐</Text>
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
            <Button className='flash-button' onTap={handleFlashModeTap}>闪光灯 {flashMode}</Button>
            <Button
              className={`shutter-button ${isTakingPhoto ? 'is-taking' : ''}`}
              disabled={isTakingPhoto}
              onTap={handleTakePhoto}
            >
              拍照
            </Button>
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

          <View className={`match__workspace ${selectedItem ? 'has-panel' : ''}`}>
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

            <View className={`recommend-panel ${selectedItem ? 'is-open' : ''}`}>
              {selectedItem?.category === 'unknown' ? (
                <>
                  <Text className='recommend-panel__title'>补充分类</Text>
                  <Text className='recommend-panel__hint'>未识别单品需要先手动归类。</Text>
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
                  <Text className='recommend-panel__title'>推荐搭配</Text>
                  <Text className='recommend-panel__hint'>点击一个推荐单品继续</Text>
                  <View className='recommend-list'>
                    {recommendationItems.length > 0 ? (
                      recommendationItems.map(item => (
                        <View key={item.id} className='recommend-list__item' onTap={() => handlePickRecommendation(item)}>
                          {renderClothingCard(item, 'recommend')}
                        </View>
                      ))
                    ) : (
                      <Text className='recommend-panel__empty'>当前分类还没有可推荐单品</Text>
                    )}
                  </View>
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
            <Text className='manual-pick__label'>当前已选</Text>
            <Text className='manual-pick__name'>{selectedItem.label}</Text>
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
            <Text className='pair-row__plus'>+</Text>
            {renderClothingCard(selectedRecommendation, 'pair')}
          </View>

          <View className='confirm__form'>
            <Input
              className='note-input'
              value={note}
              placeholder='补充说明（可选）'
              onInput={event => setNote(event.detail.value)}
            />
            <View className={`voice-demo-card voice-demo-card--${recordState}`}>
              <Text className='voice-demo-badge'>演示版</Text>
              <Text className='voice-demo-title'>
                {recordState === 'recording' ? '模拟录音中...' : isAnalyzing ? '模拟分析中...' : recordState === 'done' ? '已生成搭配思路' : '点击模拟录音（演示版）'}
              </Text>
              {recordState === 'recording' && (
                <Text className='voice-demo-timer'>{formatRecordTime(recordSeconds)}</Text>
              )}
              <Button
                className={`voice-demo-record-button ${recordState === 'recording' ? 'is-recording' : ''}`}
                onTap={handleRecordButtonTap}
              >
                {recordState === 'recording' ? '⏹️' : '🎤'}
              </Button>
              {recordState === 'idle' && (
                <Text className='voice-demo-hint'>这是交互演示，不会真的录音</Text>
              )}
              {recordState === 'recording' && showGuideButtons && (
                <View className='voice-guide-row'>
                  <Button className='voice-guide-button' onTap={() => showDemoToast('已记录：通勤')}>适合什么场合？</Button>
                  <Button className='voice-guide-button' onTap={() => showDemoToast('已记录：颜色呼应')}>搭配亮点？</Button>
                  <Button className='voice-guide-button' onTap={() => showDemoToast('已记录：加腰带')}>还有什么可配？</Button>
                </View>
              )}
              {isAnalyzing && (
                <View className='voice-analysis'>
                  <View className='voice-analysis-spinner' />
                  <Text className='voice-analysis-text'>正在整理搭配思路</Text>
                </View>
              )}
              {recordState === 'done' && !isAnalyzing && (
                <View className='voice-result-card'>
                  <Text className='voice-result-title'>AI识别结果（演示）</Text>
                  <View className='voice-result-list'>
                    <Text className='voice-result-item'>场合：通勤</Text>
                    <Text className='voice-result-item'>亮点：颜色呼应</Text>
                    <Text className='voice-result-item'>补充：可加腰带</Text>
                  </View>
                  <Text className='voice-result-summary'>这组搭配适合日常出门，整体清爽，层次足够明确。</Text>
                  <View className='voice-result-actions'>
                    <Button className='voice-result-button' onTap={resetVoiceDemo}>重新模拟</Button>
                    <Button className='voice-result-button is-primary' onTap={() => showDemoToast('演示数据已保存')}>保存演示</Button>
                  </View>
                </View>
              )}
            </View>
            <View className='confirm-action-bar'>
              <Button className='confirm-action-button' onTap={() => showDemoToast('演示已取消')}>取消</Button>
              <Button
                className={`confirm-action-button is-next ${recordState === 'done' && !isAnalyzing ? 'is-active' : ''}`}
                disabled={recordState !== 'done' || isAnalyzing}
                onTap={() => showDemoToast('已进入下一步')}
              >
                下一步
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

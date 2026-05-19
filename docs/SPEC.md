# 服装进货搭配小程序 SPEC

## 1. 项目定位

这是一个面向线下服装店老板的微信小程序原型。核心场景是在档口进货时快速拍摄新单品、自动入库、按品类管理，并在后续搭配过程中记录老板的搭配理由和审美偏好，让系统逐步生成更贴近个人审美的搭配推荐。

当前项目重点不是完整电商系统，而是一个可测试的移动端业务闭环：

1. 拍新衣服入库。
2. 自动或手动完成衣服分类。
3. 从已入库单品中选择搭配。
4. 录音记录搭配理由。
5. 保存搭配记录和用户审美画像。

后续 UI 重设计必须保留这个业务闭环，不要改成营销页、展示页或通用相册应用。

## 2. 技术栈与运行方式

- 框架：Taro 4.2 + React 18 + TypeScript。
- 样式：Sass，页面样式位于 `src/pages/index/index.scss`。
- 当前实现：单页状态机，主要业务集中在 `src/pages/index/index.tsx`。
- 小程序配置：`src/app.config.ts`、`src/pages/index/index.config.ts`。
- 无自建后端服务，当前使用微信小程序云开发：云数据库保存业务数据，云存储保存衣服图片和录音文件。
- 已接入微信 **同声传译插件**（WechatSI，插件 ID `wx069ba97219f66d99`，版本 `0.3.7`）用于实时语音转文字，在 `src/app.config.ts` 的 `plugins` 字段中声明。
- Webpack 构建配置（`config/index.ts`）已在 `mini.webpackChain` 中加入 `DefinePlugin`，将 `process.env.NODE_ENV` / `process` 替换为字符串字面量，避免微信小程序运行时出现 `process is not defined` 错误。

常用命令：

```bash
npm run build:weapp
npm run dev:weapp
```

微信开发者工具应打开构建后的 `dist` 目录；如果打开项目根目录，需要先执行 `npm run build:weapp`。

## 3. 当前页面与交互流程

### 3.1 首页

首页只有两个主入口：

- `拍新衣服`
- `搭衣服`

首页是档口现场的快速入口，不应增加复杂导航、营销文案或学习成本。

### 3.2 拍新衣服入库

点击 `拍新衣服` 进入真实相机页。

当前能力：

- 使用 Taro/微信 `<Camera>` 组件作为全屏取景器。
- 支持后置摄像头。
- 支持闪光灯三档切换：`auto`、`on`、`off`。
- 支持连拍：拍完后继续留在取景页面，不跳出拍照流程。
- 每拍一张：
  - 调用相机拍照。
  - 尝试保存到手机相册。
- 上传到微信云存储。
- 写入云数据库 `wardrobeItems` 集合。
  - 触发轻微震动反馈。
  - 右上角已拍数量增加。
  - 右下角相册入口显示最新照片缩略图和数量。

右下角相册入口：

- 展示本次拍摄的最新照片缩略图。
- 点击后打开本次拍摄预览面板。
- 可切换本次拍摄的缩略图。
- 可删除拍废的照片。
- 删除时会从云数据库 `wardrobeItems` 中移除，并尝试删除对应云存储文件。
- 注意：已经写入系统手机相册的照片不能通过小程序静默删除。

### 3.3 衣服分类

衣服分类固定为：

- `top`：上衣
- `bottom`：下衣
- `dress`：连衣裙
- `set`：套装
- `unknown`：未识别

当前自动识别已接入云函数代理：

- 新拍衣服先保存为 `unknown`。
- 然后调用云函数 `recognizeClothing`，由云函数读取 API 环境变量并调用图片识别 API。
- 如果识别为 `unknown`，后续在搭配页提供手动补充分类入口。
- 如果云函数未配置或调用失败，前端会回退到 `mockRecognizeCategory(itemId)`，保证测试流程继续可用。

后续更换 API 服务商时，只应改云函数请求适配层，不要改变分类字段语义。

### 3.4 搭衣服

点击 `搭衣服` 进入单品选择页。

当前能力：

- 顶部有分类 tabs：上衣、下衣、连衣裙、套装、未识别。
- 优先展示云数据库中的真实入库 `wardrobeItems`。
- 如果没有真实入库数据，则展示内置 demo 占位单品，便于演示流程。
- 单品卡片展示：
  - 本地图片。
  - 品类标签。
  - 分类来源：`AI`、`手动`、`未识别`。

点击一个已识别单品：

- 该单品高亮。
- 右侧打开 `推荐搭配` 面板。
- 当前推荐逻辑是本地规则：
  - 上衣推荐下衣、套装。
  - 下衣推荐上衣、套装。
  - 连衣裙推荐上衣、套装。
  - 套装推荐上衣、下衣。
- 面板内也有 `自己选一件` 入口，用于 AI 没推荐到合适单品时的兜底。

点击一个未识别单品：

- 右侧面板切换为 `补充分类`。
- 用户可手动选择上衣、下衣、连衣裙、套装。
- 保存后该单品的 `categorySource` 变为 `manual`。

### 3.5 手动选择搭配

从推荐面板点击 `自己选一件` 进入手动选择页。

当前能力：

- 显示当前已选单品。
- 继续使用分类 tabs。
- 用户可从其他分类里选择第二件搭配单品。
- 当前已选单品不可重复选择。
- 选择后进入确认页。

### 3.6 确认搭配与真实录音

确认页展示两件已选单品，并提供：

- 补充说明输入框。
- 真实录音入口（含实时字幕）。
- 保存搭配按钮。

当前录音与 STT 能力：

- 使用微信 **同声传译插件**（WechatSI）的 `getRecordRecognitionManager()` 替代原生 `Taro.getRecorderManager()`，由微信在端侧完成实时语音识别，无需额外 API 费用。
- 录音格式：`mp3`，采样率 `16000`，单声道，码率 `48000`。
- 最长录音时长：**60 秒**（插件限制，原生方案为 120 秒）。
- 录音过程中，`onRecognize` 回调实时返回中间识别结果，页面以 `.voice-live-transcript` 样式展示实时字幕。
- 录音结束时，`onStop` 返回 `{ tempFilePath, duration, fileSize, result }`，其中 `result` 为最终完整识别文本，直接写入 `transcript.text`，`source` 置为 `stt`，`aiStatus.stt` 置为 `done`。
- 录音停止后使用 `Taro.saveFile` 保存成本地持久文件，并上传云存储保留原始音频。
- 识别完成的文字在结果卡片以 `.voice-final-transcript` 样式展示。
- 如果插件加载失败（`requirePlugin` 抛出异常），代码自动回退到原生 `Taro.getRecorderManager()`，不阻断录音流程，但没有实时字幕和自动识别。

当前偏好提取保留本地 mock 兜底：

- 录音结束后，页面先用 `mockExtractPreferences(noteText)` 生成即时反馈，避免用户等待。
- 保存搭配时调用 `extractStylePreference` 云函数。如果云函数配置完整，云端会写回真实 extractedPreferences。
- `transcribeVoice` 云函数当 `aiStatus.stt === 'done'` 时会被跳过（插件已在端侧完成），仅在回退到原生录音且无识别文字时才会被调用。
- 如果云函数未配置或失败，搭配仍保存，本地 mock 偏好继续用于当前画像沉淀。

当前保存限制：

- `保存搭配` 按钮需要录音完成后才能点击。
- 保存后会写入云数据库 `outfitRecords` 集合。
- 同时更新关联衣服的 `matchCount`、`outfits`、`styleTags`。
- 同时更新 `userStyleProfile` 审美画像。

## 4. 本地数据结构

### 4.1 wardrobeItems

云数据库集合：`wardrobeItems`

每条衣服数据：

```ts
type WardrobeItem = {
  id: string
  ownerId: string
  shopId: string | null
  schemaVersion: number
  cloudFileId: string
  localPath: string
  albumSaved: boolean
  createdAt: string
  category: 'top' | 'bottom' | 'dress' | 'set' | 'unknown'
  categorySource: 'ai' | 'manual' | 'unknown'
  name: string
  color: string
  price: null
  tags: string[]
  styleTags: string[]
  matchCount: number
  outfits: string[]
}
```

字段说明：

- `id`：本地唯一 ID，当前格式为 `item_时间戳`。
- `ownerId`：预留用户归属字段，当前未接登录时为空字符串；接微信登录后应写入用户标识。
- `shopId`：预留店铺字段，当前为 `null`；后续多店铺时写入店铺 ID。
- `schemaVersion`：数据结构版本，当前为 `1`。
- `_openid`：微信云开发在小程序端写入数据库时自动生成，不需要前端手动写入。
- `cloudFileId`：微信云存储文件 ID，作为图片长期展示和后续 AI 识别的主文件引用。
- `localPath`：当前拍摄会话里的本地临时路径，用于刚拍完的即时预览。
- `albumSaved`：是否成功保存到手机相册；用户拒绝相册权限时为 `false`。
- `category`：衣服品类。
- `categorySource`：分类来源，AI、手动或未识别。
- `tags`：通用标签，可包含品类、颜色、材质等。
- `styleTags`：搭配过程中沉淀的风格标签。
- `matchCount`：该单品参与搭配次数。
- `outfits`：关联的搭配记录 ID 列表。

### 4.2 outfitRecords

云数据库集合：`outfitRecords`

每条搭配记录：

```ts
type OutfitRecord = {
  id: string
  ownerId: string
  shopId: string | null
  schemaVersion: number
  itemIds: string[]
  createdAt: string
  noteText: string
  voiceNote: {
    cloudFileId: string
    localPath: string
    duration: number
    format: 'mp3'
  } | null
  transcript: {
    text: string
    source: 'pending' | 'stt' | 'manual' | 'mock'
    updatedAt: string
  }
  extractedPreferences: {
    sceneTags: string[]
    styleTags: string[]
    colorTags: string[]
    avoidTags: string[]
    freeText: string
  }
  aiStatus: {
    stt: 'pending' | 'done' | 'failed' | 'skipped'
    preferenceExtract: 'pending' | 'done' | 'failed' | 'skipped'
  }
}
```

字段说明：

- `itemIds`：本次搭配涉及的衣服 ID，目前是两件。
- `ownerId`：预留用户归属字段，当前未接登录时为空字符串。
- `shopId`：预留店铺字段，当前为 `null`。
- `schemaVersion`：数据结构版本，当前为 `1`。
- `_openid`：微信云开发自动生成。
- `noteText`：用户输入框里的补充说明。
- `voiceNote`：真实录音文件信息，其中 `cloudFileId` 是长期存储的主引用。
- `transcript`：语音转文字结果，当前待接 STT API。
- `extractedPreferences`：从文字或语音中提取的审美偏好。
- `aiStatus`：异步 AI 任务状态，便于后续 UI 显示处理进度或失败重试。

### 4.3 userStyleProfile

云数据库集合：`userStyleProfiles`

用户审美画像。当前单用户 Demo 使用 `id: "default"` 作为画像记录标识，后续多用户时应改为按 `openid` 或店铺/用户 ID 区分。

```ts
type UserStyleProfile = {
  id: string
  ownerId: string
  shopId: string | null
  schemaVersion: number
  updatedAt: string
  sceneTags: { tag: string; count: number }[]
  styleTags: { tag: string; count: number }[]
  colorTags: { tag: string; count: number }[]
  avoidTags: { tag: string; count: number }[]
  lastOutfitIds: string[]
}
```

字段说明：

- `id`：当前为 `default`，后续多用户时替换为用户或店铺维度 ID。
- `ownerId`：预留用户归属字段，当前未接登录时为空字符串。
- `shopId`：预留店铺字段，当前为 `null`。
- `schemaVersion`：数据结构版本，当前为 `1`。
- `_openid`：微信云开发自动生成。
- `sceneTags`：常用场景，例如通勤、直播、约会。
- `styleTags`：偏好风格，例如清爽、显瘦、高级感。
- `colorTags`：颜色偏好，例如同色系、低饱和、黑白灰。
- `avoidTags`：避雷点，例如太花、显胖、压身高。
- `lastOutfitIds`：最近保存的搭配 ID，当前最多保留 20 条。

## 5. 后续 API 接入点

当前已经预留 3 个云函数作为 API 代理：

- `recognizeClothing`：衣服图片识别。
- `transcribeVoice`：语音转文字。
- `extractStylePreference`：搭配偏好提取。

API key 不能放在小程序前端包里。正式部署时，需要在微信开发者工具/云开发控制台里给对应云函数配置运行环境变量。仓库里的 `.env.example` 只作为字段模板，`.env.development`、`.env.production`、`.env.test` 是本机填写用，已被 `.gitignore` 忽略。

需要填写的环境变量：

```bash
TARO_APP_ID=wx68b926a2b145ced0
TARO_CLOUD_ENV_ID=xiaochengxu-d1gnauqul33de2ac9

CLOTHING_RECOGNITION_API_URL=
CLOTHING_RECOGNITION_API_KEY=
CLOTHING_RECOGNITION_MODEL=

SPEECH_TO_TEXT_API_URL=
SPEECH_TO_TEXT_API_KEY=
SPEECH_TO_TEXT_MODEL=

STYLE_PREFERENCE_API_URL=
STYLE_PREFERENCE_API_KEY=
STYLE_PREFERENCE_MODEL=
```

### 5.1 衣服图片识别 API

替换位置：

- `src/pages/index/index.tsx`
- 云函数：`cloudfunctions/recognizeClothing`
- 前端入口：`recognizeAndUpdateCategory(itemId, currentItem)`

建议真实 API 输入：

```ts
{
  itemId: string
  cloudFileId: string
}
```

建议真实 API 输出：

```ts
{
  category: 'top' | 'bottom' | 'dress' | 'set' | 'unknown'
  confidence?: number
  tags?: string[]
  color?: string
  name?: string
}
```

接入要求：

- 如果 API 失败，不要阻断拍照入库。
- 失败时保持 `category: 'unknown'`、`categorySource: 'unknown'`。
- 如果置信度过低，也应进入 `unknown`，让用户手动分类。
- 返回标签可以合并到 `tags`。
- 如果云函数未配置 API URL，前端会回退到当前 mock 分类，保证测试流程继续可用。

### 5.2 Speech to Text

**当前实现：微信同声传译插件（已上线，免费）**

STT 已由 WechatSI 插件在端侧完成，无需额外 API 费用或云函数配置。`transcribeVoice` 云函数仅在插件不可用（回退到原生录音）时才会被调用。

插件接入位置：

- `src/app.config.ts`：`plugins.WechatSI` 声明。
- `src/pages/index/index.tsx`：`useEffect` 内 `requirePlugin('WechatSI').getRecordRecognitionManager()`。
- `onRecognize` → `setLiveTranscript()`（实时字幕）。
- `onStop` → `handleRecorderStop(result)`，`result.result` 即最终文字。

如果未来需要替换为自有 STT API（更高准确率、方言支持等），替换位置：

- 云函数：`cloudfunctions/transcribeVoice`
- 前端入口：`enrichOutfitRecordWithAi(...)`（目前在 `aiStatus.stt !== 'done'` 时才调用）

建议真实 API 输入：

```ts
{
  outfitId: string
  audioCloudFileId: string
  format: 'mp3'
  duration: number
}
```

建议真实 API 输出：

```ts
{
  text: string
  language?: 'zh-CN'
}
```

接入要求：

- STT 成功后更新 `outfitRecords[].transcript`：`text` 为识别文字，`source` 为 `stt`，`updatedAt` 为当前 ISO 时间。
- STT 失败时 `aiStatus.stt` 标记为 `failed`，不要丢失原始录音。
- 用户仍应能保存搭配，后续可补偿处理。

### 5.3 搭配偏好提取 API

替换位置：

- 云函数：`cloudfunctions/extractStylePreference`
- 前端入口：`enrichOutfitRecordWithAi(...)`

建议真实 API 输入：

```ts
{
  noteText: string
  transcriptText: string
  selectedItems: WardrobeItem[]
  existingProfile: UserStyleProfile
}
```

建议真实 API 输出：

```ts
{
  sceneTags: string[]
  styleTags: string[]
  colorTags: string[]
  avoidTags: string[]
  freeText: string
}
```

接入要求：

- 输出字段必须兼容 `ExtractedPreferences`。
- 提取失败时可保留空数组，不阻断保存。
- 成功后继续调用当前 `updateUserStyleProfile` 逻辑沉淀画像。
- 如果云函数未配置 API URL，前端继续使用当前本地 mock 偏好，保证流程不中断。

### 5.4 个性化搭配推荐 API

当前推荐逻辑是本地规则，未来可以替换为个性化推荐。

建议接入位置：

- 当前 `recommendationItems` 的计算逻辑。
- 可先封装为 `getRecommendationItems(selectedItem, catalogItems, userStyleProfile)`。

建议真实 API 输入：

```ts
{
  selectedItem: WardrobeItem
  wardrobeItems: WardrobeItem[]
  userStyleProfile: UserStyleProfile
}
```

建议真实 API 输出：

```ts
{
  itemIds: string[]
  reasons?: Record<string, string>
}
```

接入要求：

- 推荐为空时必须保留 `自己选一件` 兜底入口。
- API 失败时回退到本地规则推荐。
- 不要让用户在档口现场因为 AI 推荐失败而卡住。

## 6. UI 重设计边界

后续 Claude Code 可以重做 UI，但必须保留以下产品结构：

- 首页仍然是两个主入口，不要改成多 tab 首页。
- 拍照页必须优先服务“现场快速连拍”，不要增加过多弹窗、表单或二次确认。
- 右下角相册入口要保留，用于快速预览和删除本次拍废的照片。
- 搭衣服页必须有分类：上衣、下衣、连衣裙、套装、未识别。
- 未识别必须有手动分类兜底。
- 推荐搭配必须保留 `自己选一件` 入口。
- 确认页必须能记录搭配理由，并把录音和偏好写入数据结构。
- 所有页面按手机竖屏设计，优先适配微信开发者工具和真机。

设计方向建议：

- 用户是线下服装店老板，场景是档口进货，不是消费者逛商场。
- UI 应该快速、清楚、低打扰。
- 按钮和图片触控区域要大。
- 字体层级要利于站着、边走边操作时快速识别。
- 不要使用复杂装饰、营销 hero、过度卡片化布局。
- 可以更精致，但不能牺牲拍照和搭配的操作效率。

## 7. 重要权限

`src/app.config.ts` 当前声明：

```ts
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
```

重设计或 API 接入时不要删除这些权限和插件声明。

**同声传译插件接入前提**：必须在微信公众平台（mp.weixin.qq.com）→ 小程序管理后台 → 设置 → 第三方服务 → 插件管理，搜索并添加插件 `wx069ba97219f66d99`（同声传译）。添加成功后，`plugins` 字段才能在微信开发者工具中正常加载；否则会导致白屏（微信运行时在 JS 执行前加载插件，加载失败时 React 渲染器无法初始化）。

云开发控制台需要先创建以下集合：

- `wardrobeItems`
- `outfitRecords`
- `userStyleProfiles`

当前 Demo 建议集合权限先设为“仅创建者可读写”。如果后续做店铺多人协作，再升级为带 `shopId` / `ownerId` 的权限模型。

云函数需要在微信开发者工具里上传并部署：

- `recognizeClothing`
- `transcribeVoice`
- `extractStylePreference`

部署后，在每个云函数的环境变量里填写对应 API 字段。不要把真实 API key 写进 Git。

## 8. 当前非目标

以下能力当前不是本阶段目标：

- 用户登录。
- 云数据库。
- 多店铺管理。
- 商品上架、库存、销售、订单。
- 支付。
- 自建图片上传后端。
- 真正的 AI 推荐闭环训练。
- 多页面路由拆分。

如果后续需要接入后端，应先保持本地数据结构兼容，再逐步迁移。

## 9. 验收标准

### 9.1 当前本地功能验收

1. 首页可进入拍照和搭配。
2. 拍照页能打开相机。
3. 可连续拍多张。
4. 拍照后右上角数量增加，右下角相册出现缩略图。
5. 可进入本次拍摄预览并删除照片。
6. 删除后云端入库数据同步减少。
7. 入库照片能出现在搭衣服分类页。
8. 未识别单品可以手动分类。
9. 可选择推荐单品或手动选择另一件。
10. 确认页可以录音、保存录音文件、保存搭配记录。
11. 录音过程中出现实时字幕（`.voice-live-transcript`）。
12. 录音结束后显示最终识别文字（`.voice-final-transcript`）。
13. 保存搭配后，`outfitRecords` 中 `transcript.source` 为 `stt`、`aiStatus.stt` 为 `done`。
14. 保存搭配后回到首页。

### 9.2 API 接入后验收

1. 图片识别失败不阻断入库。
2. 分类低置信度时进入未识别。
3. STT 失败不丢失原始录音。
4. 偏好提取失败不阻断搭配保存。
5. 推荐 API 失败时仍有本地规则或手动选择兜底。
6. 微信开发者工具和真机均能完成主流程。

## 10. 给后续 Claude Code 的执行提醒

- 先读 `src/pages/index/index.tsx` 和本文件，再决定怎么改 UI。
- 不要先大规模重构业务逻辑。
- 如果要重做视觉，优先重写结构清晰的 JSX 和 Sass，但保持字段、storage key、API 接入点兼容。
- 不要删除本地 demo fallback，它能保证没有真实数据时仍可演示搭配流程。
- 不要删除 `unknown` 分类，它是 AI 不稳定时的关键兜底。
- 不要删除录音数据结构，它是未来个性化推荐的基础。

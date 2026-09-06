<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useTasksStore } from '@/stores/tasks'
import { useUiStore } from '@/stores/ui'
import { t } from '@/i18n'
import { engineAvailability, engineDisplayName } from '@/services/engines'
import { detectPlatform } from '@/services/bridge/platform'
import { LOCAL_MODEL_OPTIONS, type LocalLanguage } from '@/types/settings'
import AppButton from '@/components/common/AppButton.vue'
import Icon from '@/components/common/Icon.vue'

const settings = useSettingsStore()
const tasks = useTasksStore()
const ui = useUiStore()

const platform = detectPlatform()
const showKey = ref(false)

const availability = computed(() => engineAvailability(platform, settings.settings))

/** 引擎 id → 描述文案 key 的显式映射（避免字符串拼接出非法 key） */
const ENGINE_DESC_KEYS: Record<string, string> = {
  auto: 'engineAutoDesc',
  mock: 'engineMockDesc',
  'whisper-local': 'engineWhisperlocalDesc',
  siliconflow: 'engineSiliconflowDesc',
  wails: 'engineWailsDesc',
}

function engineDesc(id: string): string {
  return t(`settings.${ENGINE_DESC_KEYS[id] ?? 'engineAutoDesc'}`)
}

function onEngineChange(event: Event): void {
  settings.update({
    engine: (event.target as HTMLSelectElement).value as typeof settings.settings.engine,
  })
}

function onLocalModelChange(event: Event): void {
  settings.update({
    localModel: (event.target as HTMLSelectElement).value as typeof settings.settings.localModel,
  })
}

function onLocalLanguageChange(event: Event): void {
  settings.update({
    localLanguage: (event.target as HTMLSelectElement).value as LocalLanguage,
  })
}

function onLocaleChange(event: Event): void {
  settings.update({ locale: (event.target as HTMLSelectElement).value as 'zh-CN' | 'en-US' })
}

async function clearData(): Promise<void> {
  if (window.confirm(t('settings.clearDataConfirm'))) {
    await tasks.clearAll()
    ui.toast('success', t('toast.cleared'))
  }
}
</script>

<template>
  <div class="settings">
    <h2>{{ t('settings.title') }}</h2>

    <section class="group">
      <h3>{{ t('settings.engine') }}</h3>
      <label class="field">
        <span class="label">{{ t('settings.engineLabel') }}</span>
        <select :value="settings.settings.engine" @change="onEngineChange">
          <option
            v-for="item in [
              { id: 'auto', ready: true, supported: true, reason: 'ok' },
              ...availability,
            ]"
            :key="item.id"
            :value="item.id"
            :disabled="item.supported === false"
          >
            {{ engineDisplayName(item.id) }}
          </option>
        </select>
        <span class="desc">{{ engineDesc(settings.settings.engine) }}</span>
      </label>
      <template v-if="settings.settings.engine === 'whisper-local'">
        <label class="field">
          <span class="label">{{ t('settings.localModel') }}</span>
          <select :value="settings.settings.localModel" @change="onLocalModelChange">
            <option v-for="option in LOCAL_MODEL_OPTIONS" :key="option.id" :value="option.id">
              {{ option.label }} · {{ option.size }}
            </option>
          </select>
          <span class="desc">{{ t('settings.localModelHint') }}</span>
        </label>
        <label class="field">
          <span class="label">{{ t('settings.localLanguage') }}</span>
          <select :value="settings.settings.localLanguage" @change="onLocalLanguageChange">
            <option value="auto">{{ t('settings.languageAuto') }}</option>
            <option value="zh">{{ t('settings.languageZh') }}</option>
            <option value="en">{{ t('settings.languageEn') }}</option>
          </select>
        </label>
        <span class="desc">{{ t('settings.localDeviceNote') }}</span>
      </template>
    </section>

    <section class="group">
      <h3>{{ t('settings.api') }}</h3>
      <label class="field">
        <span class="label">{{ t('settings.apiKey') }}</span>
        <div class="key-row">
          <input
            v-model="settings.settings.apiKey"
            :type="showKey ? 'text' : 'password'"
            placeholder="sk-..."
            autocomplete="off"
            spellcheck="false"
          />
          <AppButton variant="subtle" @click="showKey = !showKey">
            <Icon :name="showKey ? 'eye-off' : 'eye'" :size="15" />
          </AppButton>
        </div>
        <span class="desc">{{ t('settings.apiKeyHint') }}</span>
      </label>
      <label class="field">
        <span class="label">{{ t('settings.baseUrl') }}</span>
        <input v-model="settings.settings.baseUrl" type="text" spellcheck="false" />
      </label>
      <label class="field">
        <span class="label">{{ t('settings.model') }}</span>
        <input v-model="settings.settings.model" type="text" spellcheck="false" />
        <span class="desc">{{ t('settings.modelHint') }}</span>
      </label>
    </section>

    <section class="group">
      <h3>{{ t('settings.appearance') }}</h3>
      <div class="inline-field">
        <span class="label">{{ t('settings.theme') }}</span>
        <div class="segment">
          <button
            type="button"
            :class="{ on: settings.settings.theme === 'dark' }"
            @click="settings.update({ theme: 'dark' })"
          >
            <Icon name="moon" :size="14" />
            {{ t('settings.themeDark') }}
          </button>
          <button
            type="button"
            :class="{ on: settings.settings.theme === 'light' }"
            @click="settings.update({ theme: 'light' })"
          >
            <Icon name="sun" :size="14" />
            {{ t('settings.themeLight') }}
          </button>
        </div>
      </div>
      <div class="inline-field">
        <span class="label">{{ t('settings.locale') }}</span>
        <select :value="settings.settings.locale" @change="onLocaleChange">
          <option value="zh-CN">简体中文</option>
          <option value="en-US">English</option>
        </select>
      </div>
      <div class="inline-field">
        <span class="label">{{ t('settings.autoScroll') }}</span>
        <button
          type="button"
          class="switch"
          :class="{ on: settings.settings.autoScrollTranscript }"
          role="switch"
          :aria-checked="settings.settings.autoScrollTranscript"
          @click="
            settings.update({ autoScrollTranscript: !settings.settings.autoScrollTranscript })
          "
        >
          <span class="knob" />
        </button>
      </div>
      <p class="desc">{{ t('settings.autoScrollDesc') }}</p>
      <div class="inline-field">
        <span class="label">{{ t('workspace.subtitleOverlay') }}</span>
        <button
          type="button"
          class="switch"
          :class="{ on: settings.settings.subtitleOverlay }"
          role="switch"
          :aria-checked="settings.settings.subtitleOverlay"
          @click="settings.update({ subtitleOverlay: !settings.settings.subtitleOverlay })"
        >
          <span class="knob" />
        </button>
      </div>
      <p class="desc">{{ t('workspace.subtitleOverlayDesc') }}</p>
    </section>

    <section class="group">
      <h3>{{ t('settings.data') }}</h3>
      <p class="desc">
        {{ tasks.persistent ? t('settings.storagePersistent') : t('settings.storageMemory') }}
        · {{ t('settings.ffmpegNote') }}
      </p>
      <AppButton variant="danger" @click="clearData">{{ t('settings.clearData') }}</AppButton>
      <p class="desc">{{ t('settings.clearDataDesc') }}</p>
    </section>
  </div>
</template>

<style scoped>
.settings {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

h2 {
  font-size: 1.35rem;
  font-weight: 750;
}

.group {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--panel);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.group h3 {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--accent-strong);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--text-muted);
}

.desc {
  font-size: 0.78rem;
  color: var(--text-faint);
}

input[type='text'],
input[type='password'],
select {
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 9px 12px;
  color: var(--text);
  font-size: 0.9rem;
  width: 100%;
}

input:focus,
select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.key-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.inline-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.inline-field select {
  width: auto;
  min-width: 130px;
}

.segment {
  display: flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.segment button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: none;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 0.84rem;
  color: var(--text-muted);
  transition:
    color var(--dur-fast) var(--ease-out),
    background var(--dur-fast) var(--ease-out);
}

.segment button.on {
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 650;
}

.switch {
  width: 44px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: var(--bg-soft);
  position: relative;
  cursor: pointer;
  transition: background 0.18s ease;
}

.switch .knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: all 0.18s ease;
}

.switch.on {
  background: var(--accent);
  border-color: var(--accent);
}

.switch.on .knob {
  left: 22px;
  background: #fff;
}
</style>

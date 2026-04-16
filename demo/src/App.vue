<script setup lang="ts">
import { ref } from 'vue'
import ImageCard from './components/ImageCard.vue'
import ZoomBugRepro from './components/ZoomBugRepro.vue'

const isDragging = ref(false)
const files = ref<File[]>([])
const showRepro = ref(false)

function onDragEnter(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function onDragLeave(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  if (e.dataTransfer?.files) {
    appendFiles(Array.from(e.dataTransfer.files))
  }
}

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    appendFiles(Array.from(input.files))
  }
}

function appendFiles(newFiles: File[]) {
  // Filter mostly image extensions, including HEIC/AVIF
  const validFiles = newFiles.filter(f => f.type.startsWith('image/') || f.name.match(/\.(heic|avif)$/i))
  files.value = [...files.value, ...validFiles]
}
</script>

<template>
  <header class="hero">
    <div class="logo">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather-image"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
      <h1>Universal Image Engine</h1>
    </div>
    <p class="subtitle">Drop any HEIC, AVIF, WebP, or JPEG below to natively decode and render it purely in the browser using WASM + Canvas testing.</p>
  </header>

  <main>
    <div 
      class="dropzone" 
      :class="{ active: isDragging }"
      @dragenter="onDragEnter"
      @dragover.prevent
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <div class="drop-content">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        <h2>Drag and drop images here</h2>
        <p>Or click to browse from your device</p>
        <label class="btn ms-btn">
          Select Files
          <input type="file" multiple accept="image/*,.heic,.avif" @change="onFileSelect" />
        </label>
      </div>
    </div>

    <div class="gallery" v-if="files.length > 0">
      <h2 class="gallery-title">Decoded Output <span>({{ files.length }})</span></h2>
      <div class="grid">
        <ImageCard v-for="(file, i) in files" :key="file.name + i" :file="file" />
      </div>
    </div>

    <div class="repro-toggle">
      <button type="button" class="btn ms-btn" @click="showRepro = !showRepro">
        {{ showRepro ? 'Hide' : 'Show' }} fit/zoom repro
      </button>
    </div>
    <ZoomBugRepro v-if="showRepro" />
  </main>
</template>

<style scoped>
.repro-toggle {
  display: flex;
  justify-content: center;
  margin: 2rem 0 1rem;
}

.hero {
  text-align: center;
  padding: 3rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: var(--accent-color);
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
}

h1 {
  font-size: 3rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #60a5fa, #c084fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
}

.subtitle {
  color: var(--text-muted);
  font-size: 1.1rem;
  max-width: 600px;
  line-height: 1.6;
}

.dropzone {
  width: 100%;
  border: 2px dashed rgba(255, 255, 255, 0.15);
  border-radius: 24px;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(8px);
  padding: 4rem 2rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.dropzone::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--accent-glow);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.dropzone.active {
  border-color: var(--accent-color);
  transform: scale(1.02);
}

.dropzone.active::before {
  opacity: 0.15;
}

.drop-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  position: relative;
  z-index: 1;
}

.drop-content svg {
  color: var(--text-muted);
  margin-bottom: 1rem;
  transition: color 0.3s ease;
}

.dropzone.active .drop-content svg {
  color: var(--accent-color);
}

.drop-content h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-main);
  margin: 0;
}

.drop-content p {
  color: var(--text-muted);
}

.btn {
  margin-top: 1.5rem;
  background: var(--accent-color);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
  transition: all 0.2s ease;
  overflow: hidden;
  position: relative;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.6);
  background: #2563eb;
}

.btn input[type="file"] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.gallery {
  margin-top: 4rem;
  animation: fadeIn 0.5s ease;
}

.gallery-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.gallery-title span {
  font-size: 1.1rem;
  color: var(--text-muted);
  background: var(--panel-bg);
  padding: 2px 10px;
  border-radius: 100px;
  border: 1px solid var(--panel-border);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 2rem;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>

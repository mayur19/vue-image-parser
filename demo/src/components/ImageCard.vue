<script setup lang="ts">
import { ref, watch } from 'vue'
import { useImage } from 'vue-image-parser'

const props = defineProps<{
  file: File
}>()

// The system manages dynamic updates behind the scenes safely!
const { loading, decoded, error, format } = useImage(() => props.file)

// Create an object URL specifically for the UniversalImage payload to consume cleanly (though it accepts File direct too, this is nice for explicit mapping)
const sourceUrl = ref('')

watch(() => props.file, (newFile) => {
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
  sourceUrl.value = URL.createObjectURL(newFile)
}, { immediate: true })

</script>

<template>
  <div class="image-card">
    <div class="preview-container">
      <div v-if="loading" class="loader-overlay">
        <div class="spinner"></div>
        <span>Processing Image...</span>
      </div>
      <div v-else-if="error" class="error-overlay">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
        <span>{{ error.message }}</span>
      </div>
      
      <!-- We leverage out UniversalImage component for actual rendering -->
      <UniversalImage 
        v-show="!error"
        :src="sourceUrl" 
        fit="cover" 
        class="rendered-image"
      />
    </div>
    
    <div class="meta-container">
      <h3 class="filename" :title="file.name">{{ file.name }}</h3>
      
      <div class="tags" v-if="decoded">
        <span class="tag format">{{ format || 'unknown' }}</span>
        <span class="tag dim">{{ decoded.width }} &times; {{ decoded.height }}</span>
      </div>
      <div class="tags" v-else>
         <span class="tag pending">Analyzing...</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.image-card {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 16px;
  overflow: hidden;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
  display: flex;
  flex-direction: column;
}

.image-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4), 0 0 20px var(--accent-glow);
  border-color: rgba(59, 130, 246, 0.4);
}

.preview-container {
  height: 220px;
  width: 100%;
  position: relative;
  background: rgba(0,0,0,0.2);
  border-bottom: 1px solid var(--panel-border);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rendered-image {
  width: 100%;
  height: 100%;
  display: block;
}

.loader-overlay, .error-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.4);
  z-index: 10;
  backdrop-filter: blur(4px);
}

.error-overlay {
  color: #ef4444;
  text-align: center;
  padding: 1rem;
  background: rgba(239, 68, 68, 0.1);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { 
  to { transform: rotate(360deg); } 
}

.meta-container {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filename {
  font-size: 0.95rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-main);
  margin: 0;
}

.tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tag {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 100px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tag.format {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.tag.dim {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.tag.pending {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-muted);
}
</style>

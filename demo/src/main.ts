import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { ImageParserPlugin } from 'vue-image-parser'

const app = createApp(App)

// Initialize the plugin so <UniversalImage> is available everywhere
app.use(ImageParserPlugin)

app.mount('#app')

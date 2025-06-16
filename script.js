class PlanBTV {
  constructor() {
    // Core properties
    this.channels = []
    this.filteredChannels = []
    this.currentChannel = null
    this.hls = null

    // UI state
    this.searchTimeout = null
    this.overlayTimeout = null
    this.focusedElement = null
    this.navigationMode = "remote"
    this.isPlaying = false
    this.volume = 1
    this.lastUpdateTime = null

    // Performance tracking
    this.loadStartTime = Date.now()
    this.channelsLoadTime = null

    // Error handling
    this.retryCount = 0
    this.maxRetries = 3

    // Auto-hide settings optimized
    this.autoHideDelay = 3000 // 3 seconds
    this.iframeAutoHideDelay = 4000 // 4 seconds
    this.cursorHideDelay = 2000 // 2 seconds for cursor
    this.cursorTimeout = null
    this.isImmersiveMode = false
    this.lastInteraction = Date.now()

    this.init()
  }

  async init() {
    try {
      this.updateLoaderProgress(10, "Inicializando aplicación...")

      await this.loadChannels()
      this.updateLoaderProgress(60, "Configurando interfaz...")

      this.setupEventListeners()
      this.setupRemoteNavigation()
      this.updateTime()
      this.setupFullscreenHandlers()

      this.updateLoaderProgress(90, "Finalizando...")

      setTimeout(() => {
        this.hideLoader()
        this.showSuccessToast("Plan B TV cargado correctamente")
      }, 800)
    } catch (error) {
      console.error("Error initializing app:", error)
      this.updateLoaderProgress(100, "Error al cargar")
      this.showError("Error al cargar la aplicación", error.message)
    }
  }

  updateLoaderProgress(percentage, text) {
    const progressBar = document.getElementById("progressBar")
    const loaderText = document.getElementById("loaderText")

    if (progressBar) {
      progressBar.style.width = `${percentage}%`
    }

    if (loaderText && text) {
      loaderText.textContent = text
    }
  }

  async loadChannels() {
    try {
      this.updateLoaderProgress(20, "Cargando canales...")

      const response = await fetch("channels.json", {
        cache: "no-cache",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      this.updateLoaderProgress(40, "Procesando canales...")

      const data = await response.json()

      if (!Array.isArray(data)) {
        throw new Error("El formato de canales no es válido")
      }

      this.channels = data.filter((channel) => this.validateChannel(channel))

      if (this.channels.length === 0) {
        throw new Error("No se encontraron canales válidos")
      }

      this.filteredChannels = [...this.channels]
      this.lastUpdateTime = new Date()

      this.updateLoaderProgress(50, "Renderizando canales...")

      this.renderChannels()
      this.updateChannelCount()
      this.populateFilters()
      this.updateLastUpdateTime()

      this.channelsLoadTime = Date.now() - this.loadStartTime
      console.log(`Channels loaded in ${this.channelsLoadTime}ms`)
    } catch (error) {
      console.error("Error loading channels:", error)

      if (this.retryCount < this.maxRetries) {
        this.retryCount++
        console.log(`Retrying... Attempt ${this.retryCount}/${this.maxRetries}`)
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return this.loadChannels()
      }

      this.loadDemoChannels()
      this.showError("Error al cargar canales", "Se han cargado canales de demostración")
    }
  }

  validateChannel(channel) {
    const required = ["id", "name", "category", "type", "url"]
    const valid = required.every((field) => channel[field])

    if (!valid) {
      console.warn("Invalid channel:", channel)
      return false
    }

    try {
      new URL(channel.url)
    } catch {
      console.warn("Invalid URL for channel:", channel.name)
      return false
    }

    return true
  }

  loadDemoChannels() {
    console.log("Loading demo channels...")

    this.channels = [
      {
        id: 1,
        name: "Canal Demo HD",
        logo: "/placeholder.svg?height=80&width=80",
        category: "Entretenimiento",
        type: "m3u8",
        url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
        description: "Canal de demostración con contenido de prueba",
      },
      {
        id: 2,
        name: "Canal Iframe Demo",
        logo: "/placeholder.svg?height=80&width=80",
        category: "Noticias",
        type: "iframe",
        url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        description: "Canal de demostración con iframe",
      },
      {
        id: 3,
        name: "Música 24/7",
        logo: "/placeholder.svg?height=80&width=80",
        category: "Música",
        type: "iframe",
        url: "https://www.youtube.com/embed/jfKfPfyJRdk",
        description: "Música las 24 horas",
      },
    ]

    this.filteredChannels = [...this.channels]
    this.lastUpdateTime = new Date()

    this.renderChannels()
    this.updateChannelCount()
    this.populateFilters()
    this.updateLastUpdateTime()
  }

  async refreshChannels() {
    const refreshBtn = document.getElementById("refreshBtn")
    const refreshIndicator = document.getElementById("refreshIndicator")

    try {
      refreshBtn.classList.add("loading")
      refreshIndicator.classList.remove("hidden")

      this.retryCount = 0
      await this.loadChannels()

      this.showSuccessToast(`${this.channels.length} canales actualizados`)
    } catch (error) {
      console.error("Error refreshing channels:", error)
      this.showError("Error al actualizar canales", error.message)
    } finally {
      refreshBtn.classList.remove("loading")
      refreshIndicator.classList.add("hidden")
    }
  }

  setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById("searchInput")
    const clearSearchBtn = document.getElementById("clearSearchBtn")

    searchInput.addEventListener("input", (e) => {
      clearTimeout(this.searchTimeout)

      if (e.target.value.trim()) {
        clearSearchBtn.classList.remove("hidden")
      } else {
        clearSearchBtn.classList.add("hidden")
      }

      this.searchTimeout = setTimeout(() => {
        this.filterChannels()
      }, 300)
    })

    clearSearchBtn.addEventListener("click", () => {
      searchInput.value = ""
      clearSearchBtn.classList.add("hidden")
      this.filterChannels()
      searchInput.focus()
    })

    // Filter functionality
    const categoryFilter = document.getElementById("categoryFilter")
    categoryFilter.addEventListener("change", () => this.filterChannels())

    // Control buttons
    document.getElementById("refreshBtn").addEventListener("click", () => {
      this.refreshChannels()
    })

    document.getElementById("fullscreenBtn").addEventListener("click", () => {
      this.toggleFullscreen()
    })

    document.getElementById("backToGrid").addEventListener("click", () => {
      this.showChannelsGrid()
    })

    // Player controls
    document.getElementById("playPauseBtn").addEventListener("click", () => {
      this.togglePlayPause()
    })

    document.getElementById("muteBtn").addEventListener("click", () => {
      this.toggleMute()
    })

    document.getElementById("volumeSlider").addEventListener("input", (e) => {
      this.setVolume(e.target.value / 100)
    })

    document.getElementById("fullscreenPlayerBtn").addEventListener("click", () => {
      this.toggleFullscreen()
    })

    // Modal controls
    document.getElementById("closeErrorModal").addEventListener("click", () => {
      this.hideError()
    })

    document.getElementById("retryBtn").addEventListener("click", () => {
      this.hideError()
      if (this.currentChannel) {
        this.playChannel(this.currentChannel)
      }
    })

    document.getElementById("selectOtherBtn").addEventListener("click", () => {
      this.hideError()
      this.showChannelsGrid()
    })

    document.getElementById("retryLoadChannels").addEventListener("click", () => {
      this.refreshChannels()
    })

    // Enhanced visibility change handling
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.currentChannel) {
        const videoPlayer = document.getElementById("videoPlayer")
        if (!videoPlayer.paused) {
          videoPlayer.pause()
        }
      }
    })

    // Enhanced player interaction detection
    const playerContainer = document.getElementById("playerContainer")

    // Optimized mouse/touch events with throttling
    let interactionThrottle = false
    const handleInteraction = () => {
      if (!interactionThrottle) {
        this.showPlayerOverlay()
        interactionThrottle = true
        setTimeout(() => {
          interactionThrottle = false
        }, 100)
      }
    }

    playerContainer.addEventListener("mousemove", handleInteraction, { passive: true })
    playerContainer.addEventListener("click", handleInteraction)
    playerContainer.addEventListener("touchstart", handleInteraction, { passive: true })
    playerContainer.addEventListener("touchmove", handleInteraction, { passive: true })

    // Keyboard interaction
    playerContainer.addEventListener("keydown", () => {
      this.showPlayerOverlay()
    })

    // Optimized resize handler
    let resizeTimeout
    window.addEventListener(
      "resize",
      () => {
        clearTimeout(resizeTimeout)
        resizeTimeout = setTimeout(() => {
          if (this.isImmersiveMode) {
            // Recalculate immersive mode dimensions
            const playerContainer = document.getElementById("playerContainer")
            playerContainer.style.width = "100vw"
            playerContainer.style.height = "100vh"
          }
        }, 250)
      },
      { passive: true },
    )

    // Connection status monitoring
    window.addEventListener("online", () => {
      document.getElementById("connectionStatus").textContent = "Conectado"
      this.updateConnectionIndicator("connected")
    })

    window.addEventListener("offline", () => {
      document.getElementById("connectionStatus").textContent = "Sin conexión"
      this.updateConnectionIndicator("error")
    })
  }

  setupFullscreenHandlers() {
    // Enhanced fullscreen event handlers
    document.addEventListener("fullscreenchange", () => {
      this.handleFullscreenChange()
    })

    document.addEventListener("webkitfullscreenchange", () => {
      this.handleFullscreenChange()
    })

    document.addEventListener("mozfullscreenchange", () => {
      this.handleFullscreenChange()
    })
  }

  handleFullscreenChange() {
    const isFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement
    )

    if (isFullscreen && this.currentChannel) {
      // Auto-show overlay when entering fullscreen
      this.showPlayerOverlay()
    }
  }

  setupRemoteNavigation() {
    document.addEventListener("keydown", (e) => {
      this.handleRemoteControl(e)
    })

    document.addEventListener("focusin", (e) => {
      this.focusedElement = e.target
    })

    // Enhanced arrow key handling
    document.addEventListener("keydown", (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault()
      }
    })
  }

  handleRemoteControl(e) {
    const { key } = e

    // Show player overlay on any key press when video is playing
    if (!document.getElementById("playerContainer").classList.contains("hidden")) {
      this.showPlayerOverlay()
    }

    switch (key) {
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
        this.handleDirectionalNavigation(key)
        e.preventDefault()
        break

      case "Enter":
      case " ":
        this.handleSelectAction()
        e.preventDefault()
        break

      case "Escape":
      case "Backspace":
        this.handleBackAction()
        e.preventDefault()
        break

      case "f":
      case "F":
        if (!e.ctrlKey && !e.metaKey) {
          this.toggleFullscreen()
          e.preventDefault()
        }
        break

      case "p":
      case "P":
        if (!document.getElementById("playerContainer").classList.contains("hidden")) {
          this.togglePlayPause()
          e.preventDefault()
        }
        break

      case "m":
      case "M":
        if (!document.getElementById("playerContainer").classList.contains("hidden")) {
          this.toggleMute()
          e.preventDefault()
        }
        break

      case "/":
        document.getElementById("searchInput").focus()
        e.preventDefault()
        break

      case "r":
      case "R":
        if (!e.ctrlKey && !e.metaKey) {
          this.refreshChannels()
          e.preventDefault()
        }
        break
    }
  }

  handleDirectionalNavigation(direction) {
    const focusableElements = this.getFocusableElements()
    const currentIndex = focusableElements.indexOf(this.focusedElement)

    if (currentIndex === -1) {
      focusableElements[0]?.focus()
      return
    }

    let nextIndex
    const isGrid = !document.getElementById("channelsGrid").classList.contains("hidden")

    if (isGrid) {
      const gridColumns = this.getGridColumns()
      nextIndex = this.calculateGridNavigation(currentIndex, direction, gridColumns, focusableElements.length)
    } else {
      nextIndex = this.calculateLinearNavigation(currentIndex, direction, focusableElements.length)
    }

    focusableElements[nextIndex]?.focus()
  }

  getFocusableElements() {
    const selectors = [
      "[data-focus]:not(.hidden):not([disabled])",
      ".channel-card:not(.hidden)",
      "input:not(.hidden):not([disabled])",
      "select:not(.hidden):not([disabled])",
      "button:not(.hidden):not([disabled])",
    ]

    return Array.from(document.querySelectorAll(selectors.join(", "))).filter(
      (el) => el.offsetParent !== null && !el.classList.contains("loading"),
    )
  }

  getGridColumns() {
    const grid = document.getElementById("channelsList")
    const gridStyle = window.getComputedStyle(grid)
    const columns = gridStyle.gridTemplateColumns.split(" ").length
    return Math.max(1, columns)
  }

  calculateGridNavigation(currentIndex, direction, columns, totalElements) {
    const row = Math.floor(currentIndex / columns)
    const col = currentIndex % columns

    switch (direction) {
      case "ArrowUp":
        return row > 0 ? currentIndex - columns : currentIndex
      case "ArrowDown":
        return row < Math.floor((totalElements - 1) / columns)
          ? Math.min(currentIndex + columns, totalElements - 1)
          : currentIndex
      case "ArrowLeft":
        return col > 0 ? currentIndex - 1 : currentIndex
      case "ArrowRight":
        return col < columns - 1 && currentIndex < totalElements - 1 ? currentIndex + 1 : currentIndex
      default:
        return currentIndex
    }
  }

  calculateLinearNavigation(currentIndex, direction, totalElements) {
    switch (direction) {
      case "ArrowUp":
      case "ArrowLeft":
        return currentIndex > 0 ? currentIndex - 1 : totalElements - 1
      case "ArrowDown":
      case "ArrowRight":
        return currentIndex < totalElements - 1 ? currentIndex + 1 : 0
      default:
        return currentIndex
    }
  }

  handleSelectAction() {
    if (this.focusedElement) {
      this.focusedElement.click()
    }
  }

  handleBackAction() {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else if (this.isImmersiveMode) {
      this.showChannelsGrid()
    } else if (!document.getElementById("channelsGrid").classList.contains("hidden")) {
      // Already on grid
    } else {
      this.showChannelsGrid()
    }
  }

  showPlayerOverlay() {
    const overlay = document.getElementById("playerOverlay")
    const playerContainer = document.getElementById("playerContainer")

    // Enhanced iframe mode detection and styling
    if (this.currentChannel && this.currentChannel.type === "iframe") {
      overlay.classList.add("iframe-mode")
    } else {
      overlay.classList.remove("iframe-mode")
    }

    overlay.classList.remove("auto-hide")
    overlay.classList.add("visible")

    // Show cursor
    playerContainer.classList.remove("cursor-hidden")
    document.body.style.cursor = "default"

    clearTimeout(this.overlayTimeout)
    clearTimeout(this.cursorTimeout)

    this.lastInteraction = Date.now()

    // Enhanced auto-hide timing based on content type
    const hideDelay =
      this.currentChannel && this.currentChannel.type === "iframe" ? this.iframeAutoHideDelay : this.autoHideDelay

    this.overlayTimeout = setTimeout(() => {
      overlay.classList.remove("visible")
      overlay.classList.add("auto-hide")
    }, hideDelay)

    // Hide cursor after additional delay
    this.cursorTimeout = setTimeout(() => {
      if (this.isImmersiveMode) {
        playerContainer.classList.add("cursor-hidden")
      }
    }, this.cursorHideDelay)
  }

  enterImmersiveMode() {
    const playerContainer = document.getElementById("playerContainer")
    playerContainer.classList.add("immersive-mode")
    this.isImmersiveMode = true

    // Hide other UI elements
    document.querySelector(".header").style.display = "none"
    document.querySelector(".status-bar").style.display = "none"

    // Optimize for performance
    document.body.style.overflow = "hidden"

    console.log("Entered immersive mode")
  }

  exitImmersiveMode() {
    const playerContainer = document.getElementById("playerContainer")
    playerContainer.classList.remove("immersive-mode", "cursor-hidden")
    this.isImmersiveMode = false

    // Show UI elements
    document.querySelector(".header").style.display = "block"
    document.querySelector(".status-bar").style.display = "block"

    // Reset body overflow
    document.body.style.overflow = "auto"
    document.body.style.cursor = "default"

    console.log("Exited immersive mode")
  }

  hidePlayerOverlay() {
    const overlay = document.getElementById("playerOverlay")
    overlay.classList.remove("visible")
    overlay.classList.remove("iframe-mode")
  }

  togglePlayPause() {
    const videoPlayer = document.getElementById("videoPlayer")
    const playIcon = document.querySelector(".play-icon")
    const pauseIcon = document.querySelector(".pause-icon")

    if (!videoPlayer.src && !this.currentChannel) return

    if (videoPlayer.paused) {
      videoPlayer
        .play()
        .then(() => {
          playIcon.classList.add("hidden")
          pauseIcon.classList.remove("hidden")
          this.isPlaying = true
        })
        .catch((e) => {
          console.error("Play failed:", e)
          this.showError("Error de reproducción", "No se pudo reproducir el video")
        })
    } else {
      videoPlayer.pause()
      playIcon.classList.remove("hidden")
      pauseIcon.classList.add("hidden")
      this.isPlaying = false
    }
  }

  toggleMute() {
    const videoPlayer = document.getElementById("videoPlayer")
    const volumeOn = document.querySelector(".volume-on")
    const volumeOff = document.querySelector(".volume-off")
    const volumeSlider = document.getElementById("volumeSlider")

    if (videoPlayer.muted) {
      videoPlayer.muted = false
      volumeOn.classList.remove("hidden")
      volumeOff.classList.add("hidden")
      volumeSlider.value = this.volume * 100
    } else {
      videoPlayer.muted = true
      volumeOn.classList.add("hidden")
      volumeOff.classList.remove("hidden")
      volumeSlider.value = 0
    }
  }

  setVolume(volume) {
    const videoPlayer = document.getElementById("videoPlayer")
    this.volume = volume
    videoPlayer.volume = volume

    const volumeOn = document.querySelector(".volume-on")
    const volumeOff = document.querySelector(".volume-off")

    if (volume === 0) {
      videoPlayer.muted = true
      volumeOn.classList.add("hidden")
      volumeOff.classList.remove("hidden")
    } else {
      videoPlayer.muted = false
      volumeOn.classList.remove("hidden")
      volumeOff.classList.add("hidden")
    }
  }

  renderChannels() {
    const channelsList = document.getElementById("channelsList")
    const noChannels = document.getElementById("noChannels")

    channelsList.innerHTML = ""

    if (this.filteredChannels.length === 0) {
      channelsList.classList.add("hidden")
      noChannels.classList.remove("hidden")
      return
    }

    channelsList.classList.remove("hidden")
    noChannels.classList.add("hidden")

    this.filteredChannels.forEach((channel, index) => {
      const channelCard = this.createChannelCard(channel, index)
      channelsList.appendChild(channelCard)
    })
  }

  createChannelCard(channel, index) {
    const card = document.createElement("div")
    card.className = "channel-card"
    card.setAttribute("data-channel-id", channel.id)
    card.setAttribute("data-focus", "channel")
    card.setAttribute("tabindex", "0")
    card.style.setProperty("--index", index)
    card.style.animationDelay = `${index * 0.08}s`

    // Enhanced logo handling with better fallback
    const logoSrc = channel.logo || "/placeholder.svg?height=80&width=80"

    card.innerHTML = `
      <div class="channel-header">
        <img src="${logoSrc}" alt="${channel.name}" class="channel-logo" 
             onerror="this.src='/placeholder.svg?height=80&width=80'">
        <div class="channel-info">
          <h3>${this.escapeHtml(channel.name)}</h3>
          <p>${this.escapeHtml(channel.description || channel.category)}</p>
        </div>
      </div>
      <div class="channel-meta">
        <div class="channel-status">
          <div class="status-dot"></div>
          <span>En línea</span>
        </div>
      </div>
    `

    card.addEventListener("click", () => {
      this.playChannel(channel)
    })

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        this.playChannel(channel)
      }
    })

    return card
  }

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }

  async playChannel(channel) {
    if (!channel || !channel.url) {
      this.showError("Canal inválido", "El canal seleccionado no tiene una URL válida")
      return
    }

    this.currentChannel = channel
    this.showPlayer()
    this.updateCurrentChannelInfo(channel)
    this.showLoadingOverlay()

    // Enter immersive mode automatically
    setTimeout(() => {
      this.enterImmersiveMode()
    }, 500)

    try {
      if (channel.type === "iframe") {
        await this.playIframeChannel(channel)
      } else {
        await this.playVideoChannel(channel)
      }
      this.hideLoadingOverlay()

      // Show overlay briefly then auto-hide
      this.showPlayerOverlay()
    } catch (error) {
      console.error("Error playing channel:", error)
      this.hideLoadingOverlay()
      this.showError(`Error al reproducir ${channel.name}`, error.message)
    }
  }

  showLoadingOverlay() {
    document.getElementById("loadingOverlay").classList.remove("hidden")
  }

  hideLoadingOverlay() {
    document.getElementById("loadingOverlay").classList.add("hidden")
  }

  async playIframeChannel(channel) {
    return new Promise((resolve, reject) => {
      const videoPlayer = document.getElementById("videoPlayer")
      const videoIframe = document.getElementById("videoIframe")
      const playerControls = document.getElementById("playerControls")
      const playerInfo = document.getElementById("playerInfo")

      // Hide video player and show iframe
      videoPlayer.classList.add("hidden")
      videoIframe.classList.remove("hidden")

      // Hide player controls and info for iframe content
      if (playerControls) playerControls.style.display = "none"
      if (playerInfo) playerInfo.style.display = "none"

      videoIframe.onload = () => {
        this.updateConnectionIndicator("connected")
        resolve()
      }

      videoIframe.onerror = () => {
        reject(new Error("Error al cargar el iframe"))
      }

      // Enhanced timeout for iframe loading
      setTimeout(() => {
        if (videoIframe.classList.contains("hidden")) {
          reject(new Error("Timeout al cargar el canal"))
        } else {
          resolve()
        }
      }, 12000)

      videoIframe.src = channel.url
    })
  }

  async playVideoChannel(channel) {
    return new Promise((resolve, reject) => {
      const videoPlayer = document.getElementById("videoPlayer")
      const videoIframe = document.getElementById("videoIframe")
      const playerControls = document.getElementById("playerControls")
      const playerInfo = document.getElementById("playerInfo")

      // Show video player and hide iframe
      videoIframe.classList.add("hidden")
      videoPlayer.classList.remove("hidden")

      // Show player controls and info for video content
      if (playerControls) playerControls.style.display = "flex"
      if (playerInfo) playerInfo.style.display = "flex"

      // Clean up previous HLS instance
      if (this.hls) {
        this.hls.destroy()
        this.hls = null
      }

      // Enhanced HLS configuration for better performance and stability
      if (channel.type === "m3u8" && typeof Hls !== "undefined" && Hls.isSupported()) {
        this.hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 60,
          maxBufferLength: 20,
          maxMaxBufferLength: 300,
          maxBufferSize: 40 * 1000 * 1000,
          maxBufferHole: 0.3,
          highBufferWatchdogPeriod: 1,
          nudgeOffset: 0.05,
          nudgeMaxRetry: 2,
          maxFragLookUpTolerance: 0.2,
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 5,
          manifestLoadingTimeOut: 8000,
          manifestLoadingMaxRetry: 3,
          levelLoadingTimeOut: 8000,
          levelLoadingMaxRetry: 3,
          fragLoadingTimeOut: 15000,
          fragLoadingMaxRetry: 4,
          // Performance optimizations
          startLevel: -1,
          autoStartLoad: true,
          debug: false,
        })

        this.hls.loadSource(channel.url)
        this.hls.attachMedia(videoPlayer)

        this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoPlayer
            .play()
            .then(() => {
              this.updateConnectionIndicator("connected")
              this.isPlaying = true
              resolve()
            })
            .catch((e) => {
              console.error("Autoplay failed:", e)
              reject(new Error("Error al iniciar la reproducción"))
            })
        })

        this.hls.on(Hls.Events.ERROR, (event, data) => {
          console.error("HLS Error:", data)
          this.updateConnectionIndicator("error")

          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log("Network error, trying to recover...")
                this.hls.startLoad()
                break
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log("Media error, trying to recover...")
                this.hls.recoverMediaError()
                break
              default:
                reject(new Error(`Error de transmisión: ${data.details}`))
                break
            }
          }
        })

        // Enhanced timeout for HLS loading
        setTimeout(() => {
          if (!this.isPlaying) {
            reject(new Error("Timeout al cargar el canal"))
          }
        }, 20000)
      } else if (videoPlayer.canPlayType("application/vnd.apple.mpegurl")) {
        // Native HLS support (Safari)
        videoPlayer.src = channel.url
        videoPlayer
          .play()
          .then(() => {
            this.updateConnectionIndicator("connected")
            this.isPlaying = true
            resolve()
          })
          .catch((e) => {
            console.error("Playback failed:", e)
            reject(new Error("Error al reproducir el canal"))
          })
      } else {
        // Fallback for direct video URLs
        videoPlayer.src = channel.url
        videoPlayer
          .play()
          .then(() => {
            this.updateConnectionIndicator("connected")
            this.isPlaying = true
            resolve()
          })
          .catch((e) => {
            console.error("Playback failed:", e)
            reject(new Error("Error al reproducir el canal"))
          })
      }

      // Enhanced video event listeners
      videoPlayer.addEventListener("loadstart", () => {
        this.updateConnectionIndicator("loading")
      })

      videoPlayer.addEventListener("canplay", () => {
        this.updateConnectionIndicator("connected")
      })

      videoPlayer.addEventListener("error", (e) => {
        console.error("Video error:", e)
        this.updateConnectionIndicator("error")
        reject(new Error("Error al cargar el video"))
      })

      videoPlayer.addEventListener("ended", () => {
        this.isPlaying = false
        const playIcon = document.querySelector(".play-icon")
        const pauseIcon = document.querySelector(".pause-icon")
        playIcon.classList.remove("hidden")
        pauseIcon.classList.add("hidden")
      })
    })
  }

  updateConnectionIndicator(status) {
    const indicator = document.getElementById("connectionIndicator")
    const bars = indicator.querySelectorAll(".signal-bar")

    // Reset all bars
    bars.forEach((bar) => (bar.style.background = "var(--text-muted)"))

    switch (status) {
      case "connected":
        bars.forEach((bar) => (bar.style.background = "var(--success-color)"))
        break
      case "loading":
        bars.forEach((bar, index) => {
          setTimeout(() => {
            bar.style.background = "var(--warning-color)"
          }, index * 150)
        })
        break
      case "error":
        bars.forEach((bar) => (bar.style.background = "var(--error-color)"))
        break
    }
  }

  showPlayer() {
    document.getElementById("playerContainer").classList.remove("hidden")
    document.getElementById("channelsGrid").classList.add("hidden")

    // Enhanced focus management for TV navigation
    setTimeout(() => {
      document.getElementById("backToGrid").focus()
    }, 200)
  }

  showChannelsGrid() {
    // Exit immersive mode first
    this.exitImmersiveMode()

    document.getElementById("playerContainer").classList.add("hidden")
    document.getElementById("channelsGrid").classList.remove("hidden")
    this.hidePlayerOverlay()

    // Enhanced cleanup
    if (this.hls) {
      this.hls.destroy()
      this.hls = null
    }

    const videoPlayer = document.getElementById("videoPlayer")
    const videoIframe = document.getElementById("videoIframe")
    const playerControls = document.getElementById("playerControls")
    const playerInfo = document.getElementById("playerInfo")

    // Reset video player
    videoPlayer.pause()
    videoPlayer.src = ""

    // Reset iframe
    videoIframe.src = "about:blank"

    // Show controls by default
    if (playerControls) playerControls.style.display = "flex"
    if (playerInfo) playerInfo.style.display = "flex"

    this.currentChannel = null
    this.isPlaying = false

    // Reset play/pause button
    const playIcon = document.querySelector(".play-icon")
    const pauseIcon = document.querySelector(".pause-icon")
    playIcon.classList.remove("hidden")
    pauseIcon.classList.add("hidden")

    // Enhanced focus management
    setTimeout(() => {
      const firstChannel = document.querySelector(".channel-card")
      if (firstChannel) firstChannel.focus()
    }, 200)
  }

  updateCurrentChannelInfo(channel) {
    const logo = document.getElementById("currentChannelLogo")
    const name = document.getElementById("currentChannelName")
    const category = document.getElementById("currentChannelCategory")

    if (logo) logo.src = channel.logo || "/placeholder.svg?height=80&width=80"
    if (name) name.textContent = channel.name
    if (category) category.textContent = channel.category
  }

  filterChannels() {
    const searchTerm = document.getElementById("searchInput").value.toLowerCase().trim()
    const categoryFilter = document.getElementById("categoryFilter").value

    this.filteredChannels = this.channels.filter((channel) => {
      const matchesSearch =
        !searchTerm ||
        channel.name.toLowerCase().includes(searchTerm) ||
        (channel.description && channel.description.toLowerCase().includes(searchTerm)) ||
        channel.category.toLowerCase().includes(searchTerm)

      const matchesCategory = !categoryFilter || channel.category === categoryFilter

      return matchesSearch && matchesCategory
    })

    this.renderChannels()
    this.updateChannelCount()
  }

  populateFilters() {
    const categories = [...new Set(this.channels.map((ch) => ch.category))].sort()
    const categoryFilter = document.getElementById("categoryFilter")

    // Clear existing options except the first one
    while (categoryFilter.children.length > 1) {
      categoryFilter.removeChild(categoryFilter.lastChild)
    }

    categories.forEach((category) => {
      const option = document.createElement("option")
      option.value = category
      option.textContent = category
      categoryFilter.appendChild(option)
    })
  }

  updateChannelCount() {
    const count = this.filteredChannels.length
    const total = this.channels.length
    const channelCount = document.getElementById("channelCount")

    if (channelCount) {
      if (count === total) {
        channelCount.textContent = `${count} canal${count !== 1 ? "es" : ""}`
      } else {
        channelCount.textContent = `${count} de ${total} canal${total !== 1 ? "es" : ""}`
      }
    }
  }

  updateLastUpdateTime() {
    const lastUpdate = document.getElementById("lastUpdate")
    if (lastUpdate && this.lastUpdateTime) {
      const timeString = this.lastUpdateTime.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      })
      lastUpdate.textContent = `Última actualización: ${timeString}`
    }
  }

  updateTime() {
    const updateClock = () => {
      const now = new Date()
      const timeString = now.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      })
      const currentTime = document.getElementById("currentTime")
      if (currentTime) {
        currentTime.textContent = timeString
      }
    }

    updateClock()
    setInterval(updateClock, 1000)
  }

  toggleFullscreen() {
    const playerContainer = document.getElementById("playerContainer")

    if (!document.fullscreenElement) {
      // Try to fullscreen the player container first, then fallback to document
      const elementToFullscreen = !playerContainer.classList.contains("hidden")
        ? playerContainer
        : document.documentElement

      elementToFullscreen.requestFullscreen().catch((e) => {
        console.error("Fullscreen failed:", e)
        this.showError("Error de pantalla completa", "No se pudo activar el modo pantalla completa")
      })
    } else {
      document.exitFullscreen().catch((e) => {
        console.error("Exit fullscreen failed:", e)
      })
    }
  }

  showError(title, message, details = null) {
    const modal = document.getElementById("errorModal")
    const errorTitle = document.getElementById("errorTitle")
    const errorMessage = document.getElementById("errorMessage")
    const errorDetails = document.getElementById("errorDetails")
    const errorDetailsText = document.getElementById("errorDetailsText")

    if (errorTitle) errorTitle.textContent = title
    if (errorMessage) errorMessage.textContent = message

    if (details && errorDetails && errorDetailsText) {
      errorDetailsText.textContent = details
      errorDetails.classList.remove("hidden")
    } else if (errorDetails) {
      errorDetails.classList.add("hidden")
    }

    modal.classList.remove("hidden")

    // Enhanced focus management
    setTimeout(() => {
      document.getElementById("retryBtn").focus()
    }, 200)
  }

  hideError() {
    document.getElementById("errorModal").classList.add("hidden")
  }

  showSuccessToast(message) {
    const toast = document.getElementById("successToast")
    const successMessage = document.getElementById("successMessage")

    if (successMessage) {
      successMessage.textContent = message
    }

    toast.classList.remove("hidden")

    // Enhanced auto-hide with animation
    setTimeout(() => {
      toast.classList.add("hidden")
    }, 4000)
  }

  hideLoader() {
    const loader = document.getElementById("loader")
    const app = document.getElementById("app")

    setTimeout(() => {
      loader.classList.add("hidden")
      app.classList.remove("hidden")

      // Enhanced initial focus management
      setTimeout(() => {
        const firstChannel = document.querySelector(".channel-card")
        if (firstChannel) firstChannel.focus()
      }, 300)
    }, 800)
  }
}

// Enhanced initialization
document.addEventListener("DOMContentLoaded", () => {
  new PlanBTV()
})

// Enhanced Service Worker registration
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("SW registered: ", registration)
      })
      .catch((registrationError) => {
        console.log("SW registration failed: ", registrationError)
      })
  })
}

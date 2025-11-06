class WebSocketTransfer {
  constructor(token) {
    this.token = token
    this.ws = null
    this.isConnected = false
    this.isCancelled = false
    this.chunkSize = 64 * 1024 // 64KB per chunk
    this.onProgress = null
    this.onError = null
    this.onComplete = null
    this.onDownloadUrlReady = null
    this.onTransferStarted = null // new: transfer_started event callback
    this.currentSession = null
    this.totalBytesSent = 0 // new：total_sent_bytes_tracking
    this.isSendingChunk = false // new：flag_whether_data_chunks_are_being_sent
  }

  // connect_to_transfer_server
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        // use_a_fixed_transfer_server_address
        const wsUrl = `wss://api.tenclass.net/transfer/?token=${encodeURIComponent(this.token)}`
        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          this.isConnected = true
          console.log('WebSocket connected to transfer server')
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event)
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.isConnected = false
          reject(new Error('WebSocket connection failed'))
        }

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason)
          this.isConnected = false
        }

        // set_connection_timeout
        setTimeout(() => {
          if (!this.isConnected) {
            this.ws.close()
            reject(new Error('WebSocket connection timeout'))
          }
        }, 10000)

      } catch (error) {
        reject(new Error(`Failed to create WebSocket connection: ${error.message}`))
      }
    })
  }

  // handle_websocket_messages
  handleMessage(event) {
    try {
      if (typeof event.data === 'string') {
        const message = JSON.parse(event.data)

        switch (message.type) {
          case 'file_created':
            if (this.currentSession) {
              this.currentSession.url = message.url
              // notify_that_the_download_url_is_ready
              if (this.onDownloadUrlReady) {
                this.onDownloadUrlReady(message.url)
              }
              // wait_for_the_transfer_started_message_before_starting_to_send_data
            }
            break

          case 'transfer_started':
            if (this.currentSession) {
              // flag_has_received_transfer_started_message
              this.currentSession.transferStarted = true

              // notify_external_listener
              if (this.onTransferStarted) {
                this.onTransferStarted()
              }

              // if_the_transfer_is_ready，start_sending_file_data
              if (this.currentSession.transferReady) {
                this.sendFileData()
              }
            }
            break

          case 'ack':
            // confirmation_received，verify_and_update_bytessent
            if (this.currentSession) {
              const { blob } = this.currentSession
              const totalSize = blob.size
              const serverBytesSent = message.bytesSent

              // verify_the_bytessent_reported_by_the_server
              if (serverBytesSent < 0) {
                console.error('Invalid server bytesSent (negative):', serverBytesSent)
                this.isSendingChunk = false // reset_send_flag
                if (this.onError) {
                  this.onError(new Error('Server returned invalid byte count'))
                }
                return
              }

              if (serverBytesSent > totalSize) {
                console.error(`Server bytesSent (${serverBytesSent}) exceeds fileSize (${totalSize})`)
                this.isSendingChunk = false // reset_send_flag
                if (this.onError) {
                  this.onError(new Error('Server byte count exceeds file size'))
                }
                return
              }

              // mark_the_current_data_block_as_having_been_sent
              this.isSendingChunk = false

              // using_bytessent_confirmed_by_the_server
              if (serverBytesSent > this.currentSession.bytesSent) {
                this.currentSession.bytesSent = serverBytesSent
              }

              // send_next_block_of_data
              this.sendFileData()
            }
            break

          case 'transfer_completed':
            // verify_transmission_integrity
            if (this.currentSession) {
              const expectedSize = this.currentSession.blob.size
              if (this.totalBytesSent !== expectedSize) {
                console.warn(`Transfer size mismatch: sent ${this.totalBytesSent} bytes, expected ${expectedSize} bytes`)
              }
            }

            if (this.onComplete) {
              this.onComplete()
            }
            break

          case 'error':
            console.error('Transfer error:', message.message)
            if (this.onError) {
              this.onError(new Error(message.message))
            }
            break
        }
      }
    } catch (error) {
      console.error('Error handling message:', error)
      if (this.onError) {
        this.onError(error)
      }
    }
  }

  // send_file_data
  async sendFileData() {
    // prevent_concurrent_sending
    if (this.isSendingChunk) {
      return
    }

    if (!this.currentSession || this.isCancelled) {
      return
    }

    const { blob } = this.currentSession
    const totalSize = blob.size
    let bytesSent = this.currentSession.bytesSent

    // strict_inspection：ensure_no_data_exceeds_file_size_is_sent
    if (bytesSent >= totalSize) {
      if (this.onProgress) {
        this.onProgress(100, 'Transfer completed, waiting for device confirmation...')
      }
      return
    }

    this.isSendingChunk = true

    // verify_again_that_bytessent_does_not_exceed_the_file_size
    if (bytesSent > totalSize) {
      console.error(`Critical error: bytesSent (${bytesSent}) exceeds fileSize (${totalSize})`)
      if (this.onError) {
        this.onError(new Error('Transfer byte count exceeds file size'))
      }
      return
    }

    // calculate_the_size_of_the_next_block，ensure_that_file_boundaries_are_not_exceeded
    const remainingBytes = Math.max(0, totalSize - bytesSent)
    const chunkSize = Math.min(this.chunkSize, remainingBytes)

    if (chunkSize <= 0) {
      return
    }

    const chunk = blob.slice(bytesSent, bytesSent + chunkSize)

    try {
      // read_file_blocks
      const arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('File read failed'))
        reader.readAsArrayBuffer(chunk)
      })

      if (this.isCancelled) {
        return
      }

      // send_binary_data
      this.ws.send(arrayBuffer)

      // update_local_bytessent_count（optimistic_update）
      const newBytesSent = bytesSent + chunkSize
      this.currentSession.bytesSent = newBytesSent
      this.totalBytesSent += chunkSize // update_the_total_number_of_bytes_sent

      // verify_that_the_updated_bytessent_does_not_exceed_the_file_size
      if (newBytesSent > totalSize) {
        console.error(`Critical error: bytesSent (${newBytesSent}) exceeds fileSize (${totalSize})`)
        if (this.onError) {
          this.onError(new Error('Transfer byte count exceeds file size'))
        }
        return
      }

      // additional_verification：the_total_number_of_bytes_sent_should_also_not_exceed_the_file_size
      if (this.totalBytesSent > totalSize) {
        console.error(`Critical error: totalBytesSent (${this.totalBytesSent}) exceeds fileSize (${totalSize})`)
        if (this.onError) {
          this.onError(new Error('Total sent bytes exceed file size'))
        }
        return
      }

      // update_progress（only_update_the_transfer_progress_part）
      const transferProgress = Math.round(newBytesSent / totalSize * 60) + 40 // 40-100 range
      const step = `Transferring... ${Math.round(newBytesSent / 1024)}KB / ${Math.round(totalSize / 1024)}KB`

      if (this.onProgress) {
        this.onProgress(transferProgress, step)
      }

    } catch (error) {
      console.error('Error sending file chunk:', error)
      this.isSendingChunk = false // reset_send_flag
      if (this.onError) {
        this.onError(error)
      }
    }
  }

  // initialize_transfer_session（only_establish_connection_and_get_url）
  async initializeSession(blob, onProgress, onError, onDownloadUrlReady) {
    return new Promise((resolve, reject) => {
      this.onProgress = onProgress
      this.onError = (error) => {
        if (onError) onError(error)
        reject(error)
      }
      this.onDownloadUrlReady = (url) => {
        if (onDownloadUrlReady) onDownloadUrlReady(url)
        resolve(url)
      }
      this.isCancelled = false

      try {
        // connect_to_websocket_server
        if (this.onProgress) {
          this.onProgress(5, 'Connecting to transfer server...')
        }

        this.connect().then(() => {
          // send_file_creation_request
          if (this.onProgress) {
            this.onProgress(10, 'Creating file session...')
          }

          const createMessage = {
            type: 'create_file',
            fileName: 'assets.bin',
            fileSize: blob.size
          }

          this.ws.send(JSON.stringify(createMessage))

          // save_blob_reference，wait_for_file_created_message
          this.currentSession = {
            blob: blob,
            bytesSent: 0,
            fileSize: blob.size,
            transferStarted: false,
            transferReady: true // set_to_true_during_initialization，because_you_can_start_transmission_after_initializesession
          }
          // reset_the_total_number_of_bytes_sent
          this.totalBytesSent = 0
        }).catch(error => {
          console.error('Transfer initialization failed:', error)
          if (this.onError) {
            this.onError(error)
          }
        })

      } catch (error) {
        console.error('Transfer initialization failed:', error)
        if (this.onError) {
          this.onError(error)
        }
      }
    })
  }

  // start_transferring_file_data（assume_the_session_has_been_initialized）
  async startTransfer(onProgress, onError, onComplete) {
    return new Promise((resolve, reject) => {
      this.onProgress = onProgress
      this.onError = (error) => {
        this.isSendingChunk = false // reset_send_flag
        if (onError) onError(error)
        reject(error)
      }
      this.onComplete = () => {
        this.isSendingChunk = false // reset_send_flag
        if (onComplete) onComplete()
        resolve()
      }

      if (!this.currentSession || !this.currentSession.blob) {
        const error = new Error('Transfer session not initialized')
        if (this.onError) this.onError(error)
        reject(error)
        return
      }

      // set_transfer_status，wait_for_transfer_started_message
      this.currentSession.transferReady = true

      // if_the_transfer_started_message_has_been_received，start_transfer
      if (this.currentSession.transferStarted) {
        this.sendFileData()
      } else {
      }
      // otherwise_wait_for_the_transfer_started_message
    })
  }

  // start_transferring_files
  async transferFile(blob, onProgress, onError, onComplete, onDownloadUrlReady) {
    // if_ondownloadurlready_callback_is_provided，use_staged_transfer
    if (onDownloadUrlReady) {
      await this.initializeSession(blob, onProgress, onError, onDownloadUrlReady)
      // return，let_the_caller_decide_when_to_start_the_transfer
      return
    }

    // otherwise，use_traditional_onetime_transfer
    this.onProgress = onProgress
    this.onError = onError
    this.onComplete = onComplete
    this.isCancelled = false

    try {
      // connect_to_websocket_server
      if (this.onProgress) {
        this.onProgress(5, 'Connecting to transfer server...')
      }

      await this.connect()

      // send_file_creation_request
      if (this.onProgress) {
        this.onProgress(10, 'Creating file session...')
      }

      const createMessage = {
        type: 'create_file',
        fileName: 'assets.bin',
        fileSize: blob.size
      }

      this.ws.send(JSON.stringify(createMessage))

      // save_blob_reference，wait_for_file_created_message
      this.currentSession = {
        blob: blob,
        bytesSent: 0,
        fileSize: blob.size,
        transferStarted: false,
        transferReady: true // directly_set_to_true_in_traditional_mode
      }

    } catch (error) {
      console.error('Transfer initialization failed:', error)
      if (this.onError) {
        this.onError(error)
      }
    }
  }

  // cancel_transfer
  cancel() {
    this.isCancelled = true
    this.isSendingChunk = false // reset_send_flag
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close()
    }
  }

  // clean_up_resources
  destroy() {
    this.cancel()
    this.onProgress = null
    this.onError = null
    this.onComplete = null
    this.onDownloadUrlReady = null
    this.onTransferStarted = null
    this.totalBytesSent = 0
    this.isSendingChunk = false
  }
}

export default WebSocketTransfer

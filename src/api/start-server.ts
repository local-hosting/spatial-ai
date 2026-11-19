import { loadSpatialConfig } from './config.js'
import { startSpatialServer } from './server.js'

const config = loadSpatialConfig()
startSpatialServer(config)
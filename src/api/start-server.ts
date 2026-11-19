import { loadSpatialDotEnv } from '../runtime/load-dotenv.js'
import { loadSpatialConfig } from './config.js'
import { startSpatialServer } from './server.js'

loadSpatialDotEnv()
const config = loadSpatialConfig()
startSpatialServer(config)
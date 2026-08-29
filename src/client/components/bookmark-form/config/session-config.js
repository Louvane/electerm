// Config for each session type to drive rendering - slim: only ssh/sftp + local/web
import { connectionMap } from '../../../common/constants'
import ssh from './ssh'
import web from './web'
import local from './local'

const sessionConfig = {
  [connectionMap.ssh]: ssh,
  [connectionMap.local]: local,
  [connectionMap.web]: web
}

export default sessionConfig

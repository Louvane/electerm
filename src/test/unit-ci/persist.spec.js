/**
 * Task 10: persistence / migration domain – unit layer
 * - sqlite wrapper: bookmark CRUD roundtrip against isolated tmp DATA_PATH
 * - migrate scripts: old-shape records survive upgrade, no field loss
 * - transfer-history store: write/read/clear
 */
process.env.NODE_ENV = 'development'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const { resolve } = require('path')
const Module = require('module')

// ─────────────────────────────────────────────────────────────────────────────
// 1. sqlite wrapper – bookmark CRUD roundtrip (isolated tmp DATA_PATH)
// ─────────────────────────────────────────────────────────────────────────────

describe('sqlite dbAction – bookmark CRUD roundtrip', () => {
  let db
  let tmpRoot

  // reversible stub cipher standing in for electron safeStorage
  const enc = s => 'b64:' + Buffer.from(s, 'utf8').toString('base64')
  const dec = s => Buffer.from(s.slice(4), 'base64').toString('utf8')

  before(async () => {
    tmpRoot = fs.mkdtempSync(resolve(os.tmpdir(), 'anchor-persist-'))
    process.env.DATA_PATH = tmpRoot
    const { createDb } = require('../../../src/app/lib/sqlite.js')
    db = createDb('/ignored-app-path', 'default_user', { enc, dec })
  })

  after(() => {
    delete process.env.DATA_PATH
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  })

  const bm = {
    _id: 'bm1',
    title: 'prod box',
    host: '10.0.0.9',
    port: 22,
    username: 'root',
    password: 's3cret',
    type: 'ssh'
  }

  it('insert + find/findOne: all fields roundtrip', async () => {
    await db.dbAction('bookmarks', 'insert', { ...bm })
    const all = await db.dbAction('bookmarks', 'find')
    assert.equal(all.length, 1)
    assert.deepEqual(all[0], bm)
    const one = await db.dbAction('bookmarks', 'findOne', { _id: 'bm1' })
    assert.deepEqual(one, bm)
  })

  it('bookmarks are encrypted at rest (enc: prefix, no plaintext password)', async () => {
    const { DatabaseSync } = require('node:sqlite')
    const raw = new DatabaseSync(resolve(tmpRoot, 'users', 'default_user', 'electerm.db'))
    const row = raw.prepare('SELECT data FROM `bookmarks` WHERE _id = ?').get('bm1')
    raw.close()
    assert.ok(row.data.startsWith('enc:'), 'stored row should carry enc: prefix')
    assert.ok(!row.data.includes('s3cret'), 'password must not be plaintext at rest')
  })

  it('update with full doc persists new values, findOne reads them back', async () => {
    const next = { ...bm, title: 'prod box renamed', port: 2222 }
    const changes = await db.dbAction('bookmarks', 'update', { _id: 'bm1' }, { ...next })
    assert.equal(changes, 1)
    const one = await db.dbAction('bookmarks', 'findOne', { _id: 'bm1' })
    assert.deepEqual(one, next)
  })

  it('remove deletes the record', async () => {
    const changes = await db.dbAction('bookmarks', 'remove', { _id: 'bm1' })
    assert.equal(changes, 1)
    const all = await db.dbAction('bookmarks', 'find')
    assert.equal(all.length, 0)
    const gone = await db.dbAction('bookmarks', 'findOne', { _id: 'bm1' })
    assert.equal(gone, null)
  })

  it('insert without _id generates an id', async () => {
    const res = await db.dbAction('bookmarks', 'insert', { title: 'no-id' })
    assert.ok(res._id)
    const one = await db.dbAction('bookmarks', 'findOne', { _id: res._id })
    assert.equal(one.title, 'no-id')
    await db.dbAction('bookmarks', 'remove', { _id: res._id })
  })

  it('unknown table is rejected', async () => {
    await assert.rejects(
      () => db.dbAction('nope', 'find'),
      /Table nope does not exist/
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. migrate scripts – old version records survive upgrade (no field loss)
// ─────────────────────────────────────────────────────────────────────────────

describe('migrate scripts – old version data survives upgrade', () => {
  let tmpRoot
  let nedbAction
  let originalLoad

  const mockApp = {
    getPath: (key) => key === 'home' ? os.homedir() : resolve(tmpRoot, key)
  }
  const noopLog = {
    info () {},
    error () {},
    warn () {},
    log () {},
    transports: {
      console: { format: '', level: '' },
      file: { level: '' }
    }
  }

  before(() => {
    tmpRoot = fs.mkdtempSync(resolve(os.tmpdir(), 'anchor-migrate-'))
    process.env.DATA_PATH = resolve(tmpRoot, 'appData')
    originalLoad = Module._load.bind(Module)
    Module._load = function (request, parent, isMain) {
      if (request === 'electron') return { app: mockApp }
      if (request === 'electron-log') return noopLog
      return originalLoad(request, parent, isMain)
    }
    nedbAction = require('../../../src/app/migrate/nedb-instance').dbAction
  })

  after(() => {
    Module._load = originalLoad
    delete process.env.DATA_PATH
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  })

  async function clearTables () {
    for (const t of ['data', 'bookmarks', 'dbUpgradeLog']) {
      const all = await nedbAction(t, 'find', {})
      for (const d of all) {
        await nedbAction(t, 'remove', { _id: d._id })
      }
    }
  }

  async function getVersion () {
    const doc = await nedbAction('data', 'findOne', { _id: 'version' })
    return doc ? doc.value : null
  }

  it('v1.25.0: syncSetting tokens renamed, sibling fields kept, version bumped', async () => {
    await clearTables()
    await nedbAction('data', 'insert', {
      _id: 'userConfig',
      theme: 'dark',
      fontSize: 16,
      syncSetting: {
        syncEncrypt: true,
        githubAccessToken: 'gh_tok',
        giteeAccessToken: 'gee_tok',
        keepMe: 'kept'
      }
    })
    await require('../../../src/app/migrate/v1.25.0.js')()
    const conf = await nedbAction('data', 'findOne', { _id: 'userConfig' })
    assert.equal(conf.theme, 'dark')
    assert.equal(conf.fontSize, 16)
    assert.equal(conf.syncSetting.githubSyncPassword, 'gh_tok')
    assert.equal(conf.syncSetting.giteeSyncPassword, 'gee_tok')
    assert.equal(conf.syncSetting.keepMe, 'kept')
    assert.equal('syncEncrypt' in conf.syncSetting, false)
    assert.equal(await getVersion(), '1.25.0')
  })

  it('v1.27.17: proxy props merged into proxy string, other fields kept', async () => {
    await clearTables()
    await nedbAction('data', 'insert', {
      _id: 'userConfig',
      terminalType: 'xterm',
      proxyIp: '10.1.1.1',
      proxyPort: 1080,
      proxyType: 5,
      proxyUsername: 'u',
      proxyPassword: 'p'
    })
    await nedbAction('bookmarks', 'insert', {
      _id: 'bkproxy',
      title: 'box',
      host: '10.2.2.2',
      username: 'root',
      proxy: {
        proxyIp: '10.3.3.3',
        proxyPort: 8080,
        proxyType: 0
      }
    })
    await require('../../../src/app/migrate/v1.27.17.js')()
    const conf = await nedbAction('data', 'findOne', { _id: 'userConfig' })
    assert.equal(conf.terminalType, 'xterm')
    assert.equal(conf.proxy, 'socks5://u:p@10.1.1.1:1080')
    assert.equal('proxyIp' in conf, false)
    assert.equal('proxyPassword' in conf, false)
    const b = await nedbAction('bookmarks', 'findOne', { _id: 'bkproxy' })
    assert.equal(b.title, 'box')
    assert.equal(b.host, '10.2.2.2')
    assert.equal(b.username, 'root')
    assert.equal(b.proxy, 'http://10.3.3.3:8080')
    assert.equal(await getVersion(), '1.27.17')
  })

  it('v1.32.36: sshTunnel fields folded into sshTunnels array, no field loss', async () => {
    await clearTables()
    await nedbAction('bookmarks', 'insert', {
      _id: 'bkssh',
      title: 'hop',
      host: '10.4.4.4',
      username: 'ops',
      sshTunnel: '10.5.5.5',
      sshTunnelRemotePort: 22,
      sshTunnelLocalPort: 2222,
      sshTunnelRemoteHost: '10.5.5.5'
    })
    await require('../../../src/app/migrate/v1.32.36.js')()
    const b = await nedbAction('bookmarks', 'findOne', { _id: 'bkssh' })
    assert.equal(b.title, 'hop')
    assert.equal(b.host, '10.4.4.4')
    assert.equal(b.username, 'ops')
    assert.deepEqual(b.sshTunnels, [{
      sshTunnel: '10.5.5.5',
      sshTunnelRemotePort: 22,
      sshTunnelLocalPort: 2222,
      sshTunnelRemoteHost: '10.5.5.5'
    }])
    assert.equal('sshTunnel' in b, false)
    assert.equal('sshTunnelRemotePort' in b, false)
    assert.equal('sshTunnelLocalPort' in b, false)
    assert.equal(await getVersion(), '1.32.36')
  })

  it('v1.3.9: legacy id field becomes _id, other fields kept', async () => {
    await clearTables()
    await nedbAction('bookmarks', 'insert', {
      _id: 'old-holder',
      id: 'legacy-1',
      title: 'legacy',
      host: '10.6.6.6'
    })
    await require('../../../src/app/migrate/v1.3.9.js')()
    const b = await nedbAction('bookmarks', 'findOne', { _id: 'legacy-1' })
    assert.equal(b.title, 'legacy')
    assert.equal(b.host, '10.6.6.6')
    const gone = await nedbAction('bookmarks', 'findOne', { _id: 'old-holder' })
    assert.equal(gone, null)
    assert.equal(await getVersion(), '1.3.9')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. transfer-history store – write/read/clear
// ─────────────────────────────────────────────────────────────────────────────

describe('transfer-history store – write/read/clear', () => {
  let Store

  before(async () => {
    globalThis.window = { store: { transferHistory: [] } }
    const ext = (await import('../../../src/client/store/transfer-history.js')).default
    Store = class Store {}
    ext(Store)
  })

  after(() => {
    delete globalThis.window
  })

  it('addTransferHistory unshifts newest first, getTransferHistory reads back', () => {
    const s = new Store()
    s.addTransferHistory({ id: 't1', file: 'a.txt' })
    s.addTransferHistory({ id: 't2', file: 'b.txt' })
    assert.deepEqual(s.getTransferHistory().map(h => h.id), ['t2', 't1'])
    assert.equal(window.store.transferHistory[0].file, 'b.txt')
  })

  it('clearTransferHistory empties history', () => {
    const s = new Store()
    s.clearTransferHistory()
    assert.deepEqual(s.getTransferHistory(), [])
  })
})

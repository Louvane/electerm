/**
 * ANCHOR 主机表单抽屉(P2)
 * 四段折叠:基本/认证/跳板链/高级。
 * 新建无默认值;分组=下拉(anchor-api.groupPaths);编辑全量预填;
 * 跳板链=引用已有主机列表,保存时解析为 connectionHoppings。
 */
import React, { useState, useEffect } from 'react'
import { CloseOutlined, PlusOutlined } from '@ant-design/icons'
import { Drawer, Select, message } from 'antd'
import {
  getBookmarks,
  upsertBookmark,
  groupPaths,
  resolveHops,
  getBookmarkGroupId
} from '../../common/anchor-api'

export default function BookmarkFormDrawer (props) {
  const { open, host, defaultGroupId, store, onClose } = props
  const [title, setTitle] = useState('')
  const [hostAddr, setHostAddr] = useState('')
  const [port, setPort] = useState('')
  const [username, setUsername] = useState('')
  const [groupId, setGroupId] = useState('')
  const [authType, setAuthType] = useState('password')
  const [password, setPassword] = useState('')
  const [hops, setHops] = useState([]) // bookmarkId 列表(有序)

  useEffect(() => {
    if (!open) return
    setTitle(host ? host.title : '')
    setHostAddr(host ? host.host : '')
    setPort(host && host.port ? String(host.port) : '22')
    setUsername(host ? host.username || '' : '')
    setGroupId(host ? getBookmarkGroupId(store, host.id) : (defaultGroupId || ''))
    setAuthType(host && host.authType ? host.authType : 'password')
    setPassword(host && host.password ? host.password : '')
    // 已有跳板链回填:按 host 匹配引用
    if (host && host.connectionHoppings && host.connectionHoppings.length) {
      const all = getBookmarks(store)
      setHops(host.connectionHoppings.map(hp => {
        const ref = all.find(b => b.host === hp.host && (b.port || 22) === (hp.port || 22))
        return ref ? ref.id : null
      }))
    } else {
      setHops([])
    }
  }, [open, host])

  function save () {
    if (!hostAddr.trim()) { message.error('地址必填'); return }
    const item = {
      title: title.trim() || hostAddr.trim(),
      host: hostAddr.trim(),
      port: Number(port) || 22,
      username: username.trim() || 'root',
      authType,
      password: authType === 'password' ? password : undefined,
      authFailConfirm: false,
      connectionHoppings: resolveHops(store, hops)
    }
    if (host) item.id = host.id
    // electerm v1.50.65+ 语义: 有跳板必须标记 hasHopping,
    // 否则主进程按直连处理, 跳板链反向执行(假通/黑洞挂起)
    if (item.connectionHoppings.length) {
      item.hasHopping = true
    }
    upsertBookmark(store, item, groupId || null)
    message.success((host ? '已保存 ' : '已创建 ') + item.title)
    onClose()
  }

  // 跳板链仅来自 ANCHOR 内部书签(已禁用 ~/.ssh/config 扫描)
  const bookmarkOpts = getBookmarks(store)
    .filter(b => b.id !== (host && host.id))
    .map(b => <Select.Option key={b.id} value={b.id}>{b.username ? `${b.username} · ` : ''}{b.host}</Select.Option>)
  const groupOpts = groupPaths(store).map(p => (
    <Select.Option key={p.id} value={p.id}>{p.path}</Select.Option>
  ))

  return (
    <Drawer
      open={open}
      onClose={onClose}
      zIndex={1100}
      styles={{ wrapper: { width: 410 } }}
      title={host ? '编辑主机 — ' + (host.title || '') : '新建主机'}
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className='anchor-btn' onClick={onClose}>取消</button>
          <button className='anchor-btn pri' onClick={save}>保存主机</button>
        </div>
      }
    >
      <details className='dr-sec' open>
        <summary>基本 <span style={{ color: 'var(--alert,#f2555a)', fontSize: 10 }}>*必填</span></summary>
        <div className='inner'>
          <div className='fld'><label>名称</label><input value={title} onChange={e => setTitle(e.target.value)} id='fName' placeholder='' /></div>
          <div className='fld'><label>地址</label><input value={hostAddr} onChange={e => setHostAddr(e.target.value)} id='fIp' placeholder='' /></div>
          <div className='fld'><label>端口</label><input value={port} onChange={e => setPort(e.target.value)} id='fPort' placeholder='' /></div>
          <div className='fld'><label>用户名</label><input value={username} onChange={e => setUsername(e.target.value)} id='fUser' placeholder='' /></div>
          <div className='fld'><label>分组</label>
            <Select
              style={{ flex: 1 }}
              value={groupId || undefined}
              placeholder='选择分组(默认未分组)'
              onChange={v => setGroupId(v)}
              allowClear
            >{groupOpts}
            </Select>
          </div>
        </div>
      </details>
      <details className='dr-sec'>
        <summary>认证</summary>
        <div className='inner'>
          <div className='fld'>
            <label>方式</label>
            <Select style={{ flex: 1 }} value={authType} onChange={v => setAuthType(v)}>
              <Select.Option value='password'>密码</Select.Option>
              <Select.Option value='privateKey'>密钥</Select.Option>
            </Select>
          </div>
          {
            authType === 'password'
              ? (
                <div className='fld'><label>密码</label><input type='password' value={password} onChange={e => setPassword(e.target.value)} placeholder='' /></div>
                )
              : (
                <div className='fld'><label>私钥</label><input placeholder='~/.ssh/id_rsa(路径)' disabled /></div>
                )
          }
        </div>
      </details>
      <details className='dr-sec'>
        <summary>跳板链</summary>
        <div className='inner'>
          <div className='jump-hint'>流量依次经过每个跳板,最后一跳之后到达目标机。</div>
          {
            hops.length
              ? hops.map((hid, i) => (
                <div className='jump-row' key={i}>
                  <span className='seq'>{i + 1}</span>
                  <Select
                    showSearch
                    filterOption={(inp, opt) => String(opt.children).toLowerCase().includes(inp.toLowerCase())}
                    style={{ flex: 1 }}
                    value={hid || undefined}
                    placeholder='选择跳板主机(仅 ANCHOR 书签)'
                    onChange={v => setHops(hs => hs.map((x, j) => j === i ? v : x))}
                  >{bookmarkOpts}
                  </Select>
                  <button className='jump-btn' title='上移' onClick={() => moveHop(i, -1)}>↑</button>
                  <button className='jump-btn' title='下移' onClick={() => moveHop(i, 1)}>↓</button>
                  <button className='jump-btn' title='移除' onClick={() => setHops(hs => hs.filter((_, j) => j !== i))}><CloseOutlined /></button>
                </div>
              ))
              : <div className='jump-hint'>无跳板,直连目标机</div>
          }
          <button className='add-jump' onClick={() => setHops(hs => [...hs, null])}><PlusOutlined /> 添加跳板(引用已有主机)</button>
        </div>
      </details>
      <details className='dr-sec'>
        <summary>高级</summary>
        <div className='inner'>
          <div className='fld'><label>编码</label><input defaultValue='UTF-8' disabled /></div>
          <div className='fld'><label>保活</label><input defaultValue='10s' disabled /></div>
        </div>
      </details>
    </Drawer>
  )

  function moveHop (i, d) {
    const j = i + d
    if (j < 0 || j >= hops.length) return
    setHops(hs => {
      const ns = [...hs]
      ;[ns[i], ns[j]] = [ns[j], ns[i]]
      return ns
    })
  }
}

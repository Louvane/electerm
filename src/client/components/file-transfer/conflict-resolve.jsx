/**
 * confirm modal for transfer conflict
 *
 */

import { Component } from 'react'
import { Button } from 'antd'
import Modal from '../common/modal'
import { isString } from 'lodash-es'
import AnimateText from '../common/animate-text'
import formatTime from '../../common/time'
import { FolderOutlined, FileOutlined } from '@ant-design/icons'
import {
  fileActions
} from '../../common/constants'
import { refsStatic, refsTransfers } from '../common/ref'

const e = window.translate

function formatTimeAuto (strOrDigit) {
  if (isString(strOrDigit)) {
    return formatTime(strOrDigit)
  }
  if (strOrDigit > 9999999999) {
    return formatTime(strOrDigit)
  }
  return formatTime(strOrDigit * 1000)
}

export default class ConfirmModalStore extends Component {
  constructor (props) {
    super(props)
    this.state = {
      transferToConfirm: null
    }
    this.queue = []
    this.queuedTransferIds = new Set()
    this.activeTransferId = null
    this.id = 'transfer-conflict'
    refsStatic.add(this.id, this)
  }

  addConflict = (transfer) => {
    const transferId = transfer?.id
    if (!transferId) {
      return
    }
    if (this.activeTransferId === transferId || this.queuedTransferIds.has(transferId)) {
      return
    }
    const globalPolicy = window._transferConflictPolicy
    if (globalPolicy && Object.values(fileActions).includes(globalPolicy)) {
      const { id, transferBatch } = transfer
      const trid = `tr-${transferBatch}-${id}`
      const currentTransfer = refsTransfers.get(trid)
      currentTransfer?.onDecision(globalPolicy)
      return
    }
    this.queue.push(transfer)
    this.queuedTransferIds.add(transferId)
    if (!this.activeTransferId) {
      this.showNext()
    }
  }

  showNext = () => {
    const next = this.queue.shift()
    if (next?.id) {
      this.queuedTransferIds.delete(next.id)
    }
    this.activeTransferId = next?.id || null
    this.setState({
      transferToConfirm: next
    })
  }

  act = (action) => {
    if (!this.state.transferToConfirm) {
      return
    }
    const { id, transferBatch } = this.state.transferToConfirm
    const toAll = action.includes('All')
    const policy = toAll ? action.replace('All', '') : action
    const trid = `tr-${transferBatch}-${id}`
    const doFilter = toAll && transferBatch

    // For "All" actions, update all existing transfers in the same batch
    if (doFilter) {
      // Update all existing transfers with same batch ID in DOM
      const prefix = `tr-${transferBatch}-`
      const pendingConflictIds = new Set([
        id,
        ...this.queue
          .filter(d => d.transferBatch === transferBatch)
          .map(d => d.id)
      ])
      for (const [key, r] of window.refsTransfers.entries()) {
        if (key.startsWith(prefix)) {
          r.resolvePolicy = policy
          const transferId = r.props.transfer?.id
          if (key !== trid && pendingConflictIds.has(transferId)) {
            r.onDecision(policy)
          }
        }
      }
      this.queue = this.queue.filter(d => d.transferBatch !== transferBatch)
    }

    // Resolve current conflict
    const currentTransfer = refsTransfers.get(trid)
    currentTransfer?.onDecision(policy)

    // Move to the next item
    this.activeTransferId = null
    this.setState({
      transferToConfirm: null
    }, this.showNext)
  }

  renderContent () {
    const {
      transferToConfirm
    } = this.state
    const {
      fromPath,
      toPath,
      fromFile: {
        isDirectory,
        name,
        modifyTime: modifyTimeFrom,
        size: sizeFrom,
        type: typeFrom
      },
      toFile: {
        modifyTime: modifyTimeTo,
        size: sizeTo,
        type: typeTo
      }
    } = transferToConfirm
    const action = isDirectory ? '合并' : '替换'
    const Icon = isDirectory ? FolderOutlined : FileOutlined
    const typeTitle = e(typeTo)
    const otherTypeTitle = e(typeFrom)
    const isDown = typeFrom === 'remote'
    const dirTag = isDown ? '↓ ' : '↑ '
    return (
      <div className='confirms-content-wrap cr-anchor'>
        <p className='cr-q'>{action}同名文件？</p>
        <div className='cr-file'>
          <div className='cr-file-head'><span className='cr-dir'>{dirTag}</span><Icon className='mg1r' /><b>{name}</b><span className='cr-side'>{isDown ? '（远端已有）' : '（本地已有）'}</span></div>
          <div className='cr-file-meta'>{e('size')}: {sizeTo} · {e('modifyTime')}: {formatTimeAuto(modifyTimeTo)}</div>
          <div className='cr-file-path'>{toPath}</div>
        </div>
        <div className='cr-file'>
          <div className='cr-file-head'><span className='cr-dir'>{isDown ? '↑ ' : '↓ '}</span><Icon className='mg1r' /><b>{name}</b><span className='cr-side'>{isDown ? '（本机来源）' : '（远端来源）'}</span></div>
          <div className='cr-file-meta'>{e('size')}: {sizeFrom} · {e('modifyTime')}: {formatTimeAuto(modifyTimeFrom)}</div>
          <div className='cr-file-path'>{fromPath}</div>
        </div>
      </div>
    )
  }

  renderFooter () {
    const {
      transferToConfirm
    } = this.state
    if (!transferToConfirm) {
      return null
    }
    const {
      fromFile: {
        isDirectory
      }
    } = transferToConfirm
    return (
      <div className='cr-footer'>
        <div className='cr-footer-row'>
          <button className='cr-btn' onClick={() => this.act(fileActions.skipAll)}>{e('cancel')}</button>
          <button className='cr-btn' onClick={() => this.act(fileActions.skip)}>{e('skip')}</button>
          <button className='cr-btn' onClick={() => this.act(fileActions.rename)}>{e('rename')}</button>
          <button className='cr-btn warn' onClick={() => this.act(fileActions.mergeOrOverwrite)}>{isDirectory ? e('merge') : e('overwrite')}</button>
        </div>
        <div className='cr-footer-row'>
          <span className='cr-batch-hint'>后续冲突：</span>
          <button className='cr-btn sm' onClick={() => this.act(fileActions.skipAll)}>{e('skipAll')}</button>
          <button className='cr-btn sm' onClick={() => this.act(fileActions.renameAll)}>{e('renameAll')}</button>
          <button className='cr-btn sm warn' title={isDirectory ? e('mergeDesc') : e('overwriteDesc')} onClick={() => this.act(fileActions.mergeOrOverwriteAll)}>{isDirectory ? e('mergeAll') : e('overwriteAll')}</button>
        </div>
      </div>
    )
  }

  render () {
    const {
      transferToConfirm
    } = this.state
    if (!transferToConfirm?.id) {
      return null
    }
    const modalProps = {
      open: true,
      width: 500,
      title: '文件冲突',
      footer: this.renderFooter(),
      onCancel: () => this.act(fileActions.cancel)
    }
    return (
      <Modal
        {...modalProps}
      >
        {this.renderContent()}
      </Modal>
    )
  }
}

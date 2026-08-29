import { useRef, useEffect } from 'react'
import { Tag, Popconfirm, Button, Alert } from 'antd'
import {
  CopyOutlined,
  PlayCircleOutlined,
  FlagOutlined,
  FlagFilled
} from '@ant-design/icons'
import getBrand from './get-brand'
import { copy } from '../../common/clipboard'
import Link from '../common/external-link'

const e = window.translate
const enableAIFlag = !!(window.et && window.et.enableAIFlag)

export default function AIOutput ({ item }) {
  const outputRef = useRef(null)
  const {
    response,
    baseURLAI,
    nameAI,
    modelAI
  } = item

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [response])

  if (!response && !(item.flagged && enableAIFlag)) {
    return null
  }

  const { brand, brandUrl } = getBrand(baseURLAI)

  function handleToggleFlag () {
    const index = window.store.aiChatHistory.findIndex(i => i.id === item.id)
    if (index === -1) return
    window.store.aiChatHistory[index].flagged = !window.store.aiChatHistory[index].flagged
    window.store.aiChatHistory = [...window.store.aiChatHistory]
  }

  function renderFlag () {
    if (!enableAIFlag) return null
    return (
      <div className={'ai-stream-output-flag' + (item.flagged ? ' is-flagged' : '')}>
        <Popconfirm
          title={item.flagged ? 'Remove the harmful-info flag?' : 'Flag this as harmful info?'}
          okText='Confirm'
          cancelText='Cancel'
          onConfirm={handleToggleFlag}
        >
          <Button
            size='small'
            type='text'
            icon={item.flagged ? <FlagFilled /> : <FlagOutlined />}
            onClick={(evt) => evt.stopPropagation()}
          />
        </Popconfirm>
      </div>
    )
  }

  function renderBrand () {
    if (!brand) return null
    const nameLabel = nameAI || modelAI
    const label = nameLabel ? `${brand}:${nameLabel}` : brand
    return (
      <div className='pd1y'>
        <Link to={brandUrl}>
          <Tag>{label}</Tag>
        </Link>
      </div>
    )
  }

  // slim: render markdown as plain text to drop react-markdown dep
  return (
    <div className='ai-stream-output' ref={outputRef}>
      {renderFlag()}
      <div className='pd1'>
        {item.flagged && enableAIFlag
          ? <Alert type='warning' message='user flagged as harmful info' />
          : (
            <>
              {renderBrand()}
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{response}</pre>
            </>
            )}
      </div>
    </div>
  )
}

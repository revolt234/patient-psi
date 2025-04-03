'use client'
import { nanoid } from 'nanoid';
import { getRandomFile } from '@/app/api/random'; // Import della funzione
import { cn } from '@/lib/utils'
import { ChatList } from '@/components/chat-list'
import { ChatPanel } from '@/components/chat-panel'
import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import { useEffect, useState } from 'react'
import { useUIState, useAIState } from 'ai/rsc'
import { Session } from '@/lib/types'
import { usePathname, useRouter } from 'next/navigation'
import { Message } from '@/lib/chat/actions'
import { useScrollAnchor } from '@/lib/hooks/use-scroll-anchor'
import { toast } from 'sonner'
import { StartSession } from './start-session'

export interface ChatProps extends React.ComponentProps<'div'> {
  initialMessages?: Message[]
  id?: string
  session?: Session
  missingKeys: string[]
}

export function Chat({ id, className, session, missingKeys }: ChatProps) {
  const router = useRouter()
  const path = usePathname()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useUIState()
  const [aiState] = useAIState()
  const [_, setNewChatId] = useLocalStorage('newChatId', id)
  const [isStarted, setIsStarted] = useState(false)

  useEffect(() => {
    setNewChatId(id)
  }, [id])
  useEffect(() => {
    missingKeys.forEach(key => {
      toast.error(`Missing ${key} environment variable!`)
    })
  }, [missingKeys])

  const { messagesRef, scrollRef, visibilityRef, isAtBottom, scrollToBottom } =
    useScrollAnchor()

  const handleStartedChange = (isStarted: boolean) => {
    setIsStarted(isStarted)
  }

  return (
    <div
      className="group w-full overflow-auto pl-0"
      ref={scrollRef}
    >
      {messages.length ? (
        <>
          <div className={cn('pb-[200px] pt-4 md:pt-10', className)} ref={messagesRef}>
            <ChatList messages={messages} isShared={false} session={session} />
            <div className="h-px w-full" ref={visibilityRef} />
          </div>
          <ChatPanel
            id={id}
            input={input}
            setInput={setInput}
            isAtBottom={isAtBottom}
            scrollToBottom={scrollToBottom}
          />
        </>
      ) : (
        <>
          {!isStarted ? (
            <div className={cn('pb-[200px] pt-4 md:pt-10', className)} ref={messagesRef}>
              <StartSession onStartedChange={handleStartedChange} />
            </div>
          ) : (
            <>
              <div className={cn('pb-[200px] pt-4 md:pt-10', className)} ref={messagesRef}>
                <div className="mx-auto max-w-2xl px-4">
                  <div className="flex flex-col gap-2 rounded-lg border bg-background p-8">
                    <h1 className="text-xl font-semibold">
                      New Session Begins
                    </h1>
                    <p className="leading-normal pt-4 font-medium text-black dark:text-white">
                      Now you may start your session by entering the first greeting in the textbox below.
                    </p>
                  </div>
                </div>
              </div>
              <ChatPanel
                id={id}
                input={input}
                setInput={setInput}
                isAtBottom={isAtBottom}
                scrollToBottom={scrollToBottom}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}

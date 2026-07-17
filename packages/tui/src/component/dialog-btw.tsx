import { ScrollBoxRenderable, TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { useSync } from "../context/sync"
import { useSDK } from "../context/sdk"
import { useTuiConfig } from "../config"
import { getScrollAcceleration } from "../util/scroll"
import { Spinner } from "./spinner"
import { createMemo, createSignal, onMount, For, Show, onCleanup } from "solid-js"
import { useBindings } from "../keymap"
import { useLocal } from "../context/local"

export type DialogBtwProps = {
  question?: string
  sessionIDOverride?: string
  parentSessionID?: string
}

// Persistent states for /btw
const [lastBtwState, setLastBtwState] = createSignal<{
  question: string
  sessionID: string
  interrupted?: boolean
  modelLabel?: string
} | null>(null)

const [isBtwVisible, setIsBtwVisible] = createSignal(false)

export { lastBtwState, isBtwVisible }

export function toggleBtwDialog(dialog: ReturnType<typeof useDialog>, parentSessionID?: string) {
  if (isBtwVisible()) {
    dialog.clear()
  } else {
    const current = lastBtwState()
    dialog.replace(() => (
      <DialogBtw
        question={current?.question}
        sessionIDOverride={current?.sessionID}
        parentSessionID={parentSessionID}
      />
    ))
  }
}

export function DialogBtw(props: DialogBtwProps) {
  const dialog = useDialog()
  const sync = useSync()
  const sdk = useSDK()
  const { theme } = useTheme()
  const tuiConfig = useTuiConfig()
  const scrollAcceleration = createMemo(() => getScrollAcceleration(tuiConfig))

  const [sessionID, setSessionID] = createSignal<string>("")
  const [error, setError] = createSignal<string>("")
  const [loading, setLoading] = createSignal(true)
  const isInterrupted = createMemo(() => !!lastBtwState()?.interrupted)
  const [modelLabel, setModelLabel] = createSignal<string>("")
  const local = useLocal()
  let scrollBox: ScrollBoxRenderable | undefined

  onMount(async () => {
    dialog.setSize("large")
    dialog.setCenter(true)
    setIsBtwVisible(true)
    
    onCleanup(() => {
      setIsBtwVisible(false)
    })

    if (props.sessionIDOverride) {
      setSessionID(props.sessionIDOverride)
      setModelLabel(lastBtwState()?.modelLabel || "")
      setLoading(false)
      return
    }

    if (!props.question) {
      setLoading(false)
      return
    }
    
    try {
      // 1. Find the current session to inherit directory & workspace
      const parentSession = props.parentSessionID ? sync.session.get(props.parentSessionID) : undefined
      const directory = parentSession?.directory
      const workspaceID = parentSession?.workspaceID
      
      // We will find a suitable agent and model
      const currentModel = local.model.current()
      const agentName = parentSession?.agent ?? local.agent.current()?.name ?? "opencode"
      const model = parentSession?.model ?? (currentModel ? {
        providerID: currentModel.providerID,
        id: currentModel.modelID,
        variant: local.model.variant.current(),
      } : {
        providerID: "opencode",
        id: "gemini-2.5-flash",
      })

      const label = `${model.id}${model.variant ? ` (${model.variant})` : ""}`
      setModelLabel(label)

      // Initialize global state early so it can be marked interrupted even before session creation
      setLastBtwState({
        question: props.question,
        sessionID: "",
        interrupted: false,
        modelLabel: label,
      })

      // 2. Create the child/side-session
      const res = await sdk.client.session.create({
        directory,
        workspace: workspaceID,
        agent: agentName,
        parentID: props.parentSessionID,
        model: {
          providerID: model.providerID,
          id: model.id,
          variant: model.variant,
        },
      })

      if (res.error) {
        setError("Failed to create side query session: " + JSON.stringify(res.error))
        setLoading(false)
        return
      }

      if (lastBtwState()?.interrupted) {
        // The user pressed ESC before the session was even fully created.
        // Abort the newly created session and don't proceed with prompting.
        sdk.client.session.abort({ sessionID: res.data.id }).catch(() => {})
        setLastBtwState(prev => prev ? { ...prev, sessionID: res.data.id } : null)
        setLoading(false)
        return
      }

      const newSessionID = res.data.id
      setSessionID(newSessionID)

      // Update global/last BTW state with the real sessionID!
      setLastBtwState(prev => prev ? { ...prev, sessionID: newSessionID } : null)

      // 3. Send the prompt to stream response!
      await sdk.client.session.prompt({
        sessionID: newSessionID,
        agent: agentName,
        model: {
          providerID: model.providerID,
          modelID: model.id,
        },
        variant: model.variant,
        parts: [
          {
            type: "text",
            text: props.question,
          }
        ],
      }, { throwOnError: true })

      setLoading(false)
    } catch (e: any) {
      setError(e.message || String(e))
      setLoading(false)
    }
  })

  // Get assistant messages & parts reactively
  const messages = createMemo(() => {
    const sId = sessionID()
    if (!sId) return []
    return sync.data.message[sId] ?? []
  })

  const assistantMessageText = createMemo(() => {
    const msgs = messages()
    const assistantMsgs = msgs.filter(m => m.role === "assistant")
    let fullText = ""
    for (const msg of assistantMsgs) {
      const parts = sync.data.part[msg.id] ?? []
      for (const part of parts) {
        if (part.type === "text") {
          fullText += part.text
        }
      }
    }
    return fullText
  })

  // Check if AI is currently streaming/generating response
  const isStreaming = createMemo(() => {
    const sId = sessionID()
    if (!sId) return !props.sessionIDOverride
    const status = sync.data.session_status[sId]
    return status?.type === "busy" || (assistantMessageText() === "" && !props.sessionIDOverride)
  })

  // Scroll bindings for the dialog so user can read with keys!
  useBindings(() => ({
    priority: 100,
    bindings: [
      {
        key: "escape",
        desc: "Interrupt and close BTW Side Query",
        group: "Dialog",
        cmd: () => {
          const streaming = isStreaming()
          setLastBtwState(prev => prev ? { ...prev, interrupted: prev.interrupted || streaming } : null)
          if (sessionID()) {
            sdk.client.session.abort({ sessionID: sessionID() }).catch(() => {})
          }
          dialog.clear()
        },
      },
      {
        key: "ctrl+b",
        desc: "Hide BTW Side Query (Keep running)",
        group: "Dialog",
        cmd: () => dialog.clear(),
      },
      {
        key: "up",
        desc: "Scroll up",
        group: "Dialog",
        cmd: () => scrollBox?.scrollBy(-1),
      },
      {
        key: "down",
        desc: "Scroll down",
        group: "Dialog",
        cmd: () => scrollBox?.scrollBy(1),
      },
      {
        key: "k",
        desc: "Scroll up",
        group: "Dialog",
        cmd: () => scrollBox?.scrollBy(-1),
      },
      {
        key: "j",
        desc: "Scroll down",
        group: "Dialog",
        cmd: () => scrollBox?.scrollBy(1),
      },
      {
        key: "pageup",
        desc: "Scroll page up",
        group: "Dialog",
        cmd: () => scrollBox?.scrollBy(-10),
      },
      {
        key: "pagedown",
        desc: "Scroll page down",
        group: "Dialog",
        cmd: () => scrollBox?.scrollBy(10),
      },
    ]
  }))

  return (
    <box paddingLeft={2} paddingRight={2} gap={1} minHeight={15}>
      {/* Header */}
      <box flexDirection="row" justifyContent="space-between" border={["bottom"]} borderColor={theme.border} paddingBottom={1}>
        <box flexDirection="row" gap={1} alignItems="flex-end">
          <text attributes={TextAttributes.BOLD} fg={theme.accent}>
            [BTW]
          </text>
          <text attributes={TextAttributes.BOLD} fg={theme.text}>
            Quick Side Query
          </text>
          <Show when={modelLabel()}>
            <box paddingLeft={2}>
              <text fg={theme.textMuted} attributes={TextAttributes.DIM}>
                Agent: {modelLabel()}
              </text>
            </box>
          </Show>
        </box>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc to close
        </text>
      </box>

      {/* Guide screen when no query exists */}
      <Show when={!props.question && !props.sessionIDOverride && !lastBtwState()}>
        <box padding={2} gap={1} flexGrow={1} justifyContent="center" alignItems="center">
          <text fg={theme.textMuted} wrapMode="word" attributes={TextAttributes.ITALIC}>
            No previous side query.
          </text>
          <text fg={theme.textMuted} wrapMode="word">
            Type "/btw &lt;question&gt;" in the main input to ask one!
          </text>
        </box>
      </Show>

      {/* Question panel */}
      <Show when={props.question || props.sessionIDOverride || lastBtwState()}>
        <box paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1} backgroundColor={theme.backgroundElement}>
          <text fg={theme.textMuted} attributes={TextAttributes.ITALIC} wrapMode="word">
            Q: {props.question ?? lastBtwState()?.question}
          </text>
        </box>
      </Show>

      {/* Response content */}
      <Show when={error()}>
        <box padding={1}>
          <text fg={theme.error} wrapMode="word">{error()}</text>
        </box>
      </Show>

      <Show when={!error() && (props.question || props.sessionIDOverride || lastBtwState())}>
        <box flexGrow={1} minHeight={10} maxHeight={25}>
          <scrollbox
            ref={(r: ScrollBoxRenderable) => (scrollBox = r)}
            scrollAcceleration={scrollAcceleration()}
            stickyScroll={true}
            stickyStart="bottom"
            flexGrow={1}
            viewportOptions={{
              paddingRight: 1,
            }}
            verticalScrollbarOptions={{
              visible: true,
              trackOptions: {
                backgroundColor: theme.backgroundElement,
                foregroundColor: theme.borderActive,
              },
            }}
          >
            <Show when={loading() || isStreaming()}>
              <box flexDirection="row" gap={1} padding={1}>
                <Spinner />
                <text fg={theme.textMuted}>{assistantMessageText() ? "Streaming response..." : "Thinking..."}</text>
              </box>
            </Show>
            <Show when={assistantMessageText()}>
              <box paddingLeft={1} paddingRight={1}>
                <text fg={theme.text} wrapMode="word">
                  {assistantMessageText()}
                </text>
              </box>
            </Show>
          </scrollbox>
        </box>
      </Show>

      {/* Interrupted message */}
      <Show when={isInterrupted()}>
        <box paddingLeft={1} paddingRight={1} paddingBottom={1}>
          <text fg={theme.error} attributes={TextAttributes.BOLD}>
            Agent stream cancelled
          </text>
        </box>
      </Show>

      {/* Footer */}
      <box flexDirection="column" border={["top"]} borderColor={theme.border} paddingTop={1} paddingBottom={1} gap={1}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.textMuted}>Use ↑/↓ or j/k to scroll</text>
          <box
            paddingLeft={3}
            paddingRight={3}
            backgroundColor={theme.primary}
            onMouseUp={() => dialog.clear()}
          >
            <text fg={theme.selectedListItemText}>Close</text>
          </box>
        </box>
      </box>
    </box>
  )
}

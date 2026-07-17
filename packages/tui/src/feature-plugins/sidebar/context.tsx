import type { AssistantMessage } from "@opencode-ai/sdk/v2"
import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo, Show } from "solid-js"

const id = "internal:sidebar-context"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

function View(props: { api: TuiPluginApi; session_id: string }) {
  const theme = () => props.api.theme.current
  const msg = createMemo(() => props.api.state.session.messages(props.session_id))
  const session = createMemo(() => props.api.state.session.get(props.session_id))
  const cost = createMemo(() => session()?.cost ?? 0)
  const allSessions = createMemo(() => props.api.state.session.list())

  const subagentCost = createMemo(() => {
    const list = allSessions()
    let total = 0
    const queue = [props.session_id]
    const visited = new Set<string>()

    while (queue.length > 0) {
      const currentID = queue.shift()!
      if (visited.has(currentID)) continue
      visited.add(currentID)

      for (const s of list) {
        if (s.parentID === currentID && s.id !== props.session_id) {
          total += s.cost ?? 0
          queue.push(s.id)
        }
      }
    }
    return total
  })

  const hasSubagents = createMemo(() => subagentCost() > 0)
  const totalCost = createMemo(() => cost() + subagentCost())

  const state = createMemo(() => {
    const last = msg().findLast((item): item is AssistantMessage => item.role === "assistant" && item.tokens.output > 0)
    if (!last) {
      return {
        tokens: 0,
        percent: null,
      }
    }

    const tokens =
      last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
    const model = props.api.state.provider.find((item) => item.id === last.providerID)?.models[last.modelID]
    return {
      tokens,
      percent: model?.limit.context ? Math.round((tokens / model.limit.context) * 100) : null,
    }
  })

  return (
    <box>
      <text fg={theme().text}>
        <b>Context</b>
      </text>
      <text fg={theme().textMuted}>{state().tokens.toLocaleString()} tokens</text>
      <text fg={theme().textMuted}>{state().percent ?? 0}% used</text>
      <Show
        when={hasSubagents()}
        fallback={<text fg={theme().textMuted}>{money.format(cost())} spent</text>}
      >
        <box marginTop={1}>
          <text fg={theme().textMuted}>
            Main Agent: <span style={{ fg: theme().text }}>{money.format(cost())}</span>
          </text>
          <text fg={theme().textMuted}>
            Sub-agents: <span style={{ fg: theme().text }}>{money.format(subagentCost())}</span>
          </text>
          <text fg={theme().textMuted}>
            Total Cost: <span style={{ fg: theme().warning }}>{money.format(totalCost())}</span>
          </text>
        </box>
      </Show>
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 100,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} session_id={props.session_id} />
      },
    },
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin

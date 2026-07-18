import { DialogSelect, type DialogSelectOption } from "../ui/dialog-select"
import { createMemo } from "solid-js"
import { useDialog } from "../ui/dialog"
import type { PromptInfo } from "../prompt/history"

export type DialogPromptHistoryProps = {
  history: PromptInfo[]
  onSelect: (item: PromptInfo) => void
}

export function DialogPromptHistory(props: DialogPromptHistoryProps) {
  const dialog = useDialog()
  dialog.setSize("large")

  const options = createMemo<DialogSelectOption<PromptInfo>[]>(() => {
    // Show most recent first, deduplicate by input text
    const seen = new Set<string>()
    const unique: PromptInfo[] = []
    for (let i = props.history.length - 1; i >= 0; i--) {
      const item = props.history[i]
      if (!item || seen.has(item.input)) continue
      seen.add(item.input)
      unique.push(item)
    }
    return unique.map((item) => ({
      title: item.input.replace(/\s+/g, " ").trim(),
      value: item,
      category: "History",
      onSelect: () => {
        props.onSelect(item)
        dialog.clear()
      },
    }))
  })

  return (
    <DialogSelect
      title="Prompt History"
      placeholder="Search history..."
      options={options()}
    />
  )
}

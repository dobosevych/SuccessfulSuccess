"use client"

import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ParticipantInput } from "@/lib/types"

type Props = {
  value: ParticipantInput[]
  onChange: (participants: ParticipantInput[]) => void
  errors?: Record<number, string | undefined>
}

export function ParticipantsInput({ value, onChange, errors }: Props) {
  const update = (index: number, patch: Partial<ParticipantInput>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const addRow = () => onChange([...value, { name: "", email: "" }])
  const removeRow = (index: number) => onChange(value.filter((_, i) => i !== index))

  return (
    <div className="space-y-2">
      <Label>Participants</Label>
      <div className="space-y-2">
        {value.map((participant, index) => (
          <div key={index} className="space-y-1">
            <div className="flex items-start gap-2">
              <Input
                aria-label={`Participant ${index + 1} name`}
                placeholder="Name"
                value={participant.name}
                onChange={(event) => update(index, { name: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    addRow()
                  }
                }}
              />
              <Input
                aria-label={`Participant ${index + 1} email`}
                placeholder="Email (optional)"
                type="email"
                value={participant.email ?? ""}
                onChange={(event) => update(index, { email: event.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove participant ${index + 1}`}
                onClick={() => removeRow(index)}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
            {errors?.[index] ? (
              <p className="text-destructive text-sm">{errors[index]}</p>
            ) : null}
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="size-4" aria-hidden />
        Add participant
      </Button>
    </div>
  )
}

// Mirrors the Pydantic schemas in backend/app/schemas/meeting.py.

export type Participant = {
  id: string
  name: string
  email: string | null
  position: number
}

export type Meeting = {
  id: string
  name: string
  description: string | null
  location: string | null
  starts_at: string
  ends_at: string
  participants: Participant[]
  created_at: string
  updated_at: string
}

export type MeetingList = {
  items: Meeting[]
  total: number
  limit: number
  offset: number
  date: string
}

export type ParticipantInput = {
  name: string
  email?: string | null
}

export type MeetingCreateInput = {
  name: string
  description?: string | null
  location?: string | null
  starts_at: string
  ends_at: string
  participants: ParticipantInput[]
}

export type ApiErrorDetail = {
  field: string
  message: string
}

export type ApiErrorBody = {
  error: {
    code: string
    message: string
    details: ApiErrorDetail[]
  }
}

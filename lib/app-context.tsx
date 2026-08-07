"use client"

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { Patient, mockPatients } from '@/lib/mock-data'
import { supabase } from '@/lib/supabaseClient'
import { User as SupabaseUser } from '@supabase/supabase-js'

interface Note {
  id: string
  patientId: string
  author: string
  role: string
  content: string
  time: string
  tags: string[]
}

interface AppContextType {
  notes: Note[]
  addNote: (patientId: string, content: string, author: string, tags: string[]) => void
  getNotes: (patientId: string) => Note[]
  patients: Patient[]
  selectedPatientId: string
  setSelectedPatientId: (id: string) => void
  user: SupabaseUser | null
  signOut: () => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [patients, setPatients] = useState<Patient[]>(mockPatients)
  const [selectedPatientId, setSelectedPatientId] = useState<string>("")
  const [user, setUser] = useState<SupabaseUser | null>(null)

  useEffect(() => {
    const getSession = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
            setUser(session.user)
        }
    }
    getSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      authListener?.subscription.unsubscribe()
    }
  }, [])

  const addNote = (patientId: string, content: string, author: string, tags: string[]) => {
    const newNote: Note = {
      id: Math.random().toString(36).substr(2, 9),
      patientId,
      author,
      role: "User",
      content,
      time: "Just now",
      tags,
    }
    setNotes((prev) => [newNote, ...prev])
  }

  const getNotes = (patientId: string) => {
    return notes.filter((note) => note.patientId === patientId)
  }

  const signOut = async () => {
      await supabase.auth.signOut()
      setUser(null)
  }

  return (
    <AppContext.Provider value={{ 
        notes, 
        addNote, 
        getNotes, 
        patients, 
        selectedPatientId, 
        setSelectedPatientId, 
        user, 
        signOut 
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (context === undefined) {
    return {
        notes: [],
        addNote: () => {},
        getNotes: () => [],
        patients: [] as Patient[],
        selectedPatientId: "",
        setSelectedPatientId: () => {},
        user: null,
        signOut: () => {}
    }
  }
  return context
}

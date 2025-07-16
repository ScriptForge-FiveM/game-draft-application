import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Edit3, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface TeamNameEditorProps {
  teamId: string
  currentName: string
  onNameUpdated: (newName: string) => void
}

export function TeamNameEditor({ teamId, currentName, onNameUpdated }: TeamNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [newName, setNewName] = useState(currentName)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!newName.trim() || newName === currentName) {
      setIsEditing(false)
      setNewName(currentName)
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('teams')
        .update({ name: newName.trim() })
        .eq('id', teamId)

      if (error) throw error

      onNameUpdated(newName.trim())
      setIsEditing(false)
      toast.success('Nome squadra aggiornato!')
    } catch (error) {
      console.error('Error updating team name:', error)
      toast.error('Errore nell\'aggiornamento del nome')
      setNewName(currentName)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setNewName(currentName)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyPress}
          className="px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm font-semibold min-w-0 flex-1"
          autoFocus
          maxLength={20}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="p-1 text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
          title="Salva"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={handleCancel}
          disabled={saving}
          className="p-1 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
          title="Annulla"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-2 group">
      <span className="font-semibold text-white">{currentName}</span>
      <button
        onClick={() => setIsEditing(true)}
        className="p-1 text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
        title="Modifica nome squadra"
      >
        <Edit3 className="h-3 w-3" />
      </button>
    </div>
  )
}